#!/usr/bin/env python3
"""Temporary public HTTPS proof for IZAKHONO EDGE bootstrap.

Uses a Cloudflare Quick Tunnel only as an external transport test. The tunnel is
short-lived, has a random hostname, and is explicitly not production eligible.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import queue
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.I)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def digest(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def load_json(path: Path) -> dict:
    if not path.is_file():
        raise RuntimeError(f"required receipt missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_receipts(identity_path: Path, runtime_path: Path) -> tuple[dict, dict, str]:
    identity = load_json(identity_path)
    runtime = load_json(runtime_path)

    if identity.get("schema") != "izakhono.sovereign-node/v1":
        raise RuntimeError("unexpected sovereign identity schema")
    if identity.get("node_name") != "ISN-01":
        raise RuntimeError("edge proof is restricted to ISN-01")
    if identity.get("workload_project") != "kora-network" or identity.get("workload_proof") != "verified":
        raise RuntimeError("ISN-01 does not contain a verified KORA workload proof")
    if identity.get("public_ready") is not False or identity.get("commercial_ready") is not False:
        raise RuntimeError("identity receipt already overstates readiness")

    if runtime.get("schema") != "izakhono.sovereign-runtime/v1":
        raise RuntimeError("unexpected sovereign runtime schema")
    if runtime.get("node_name") != "ISN-01" or runtime.get("project") != "kora-network":
        raise RuntimeError("runtime receipt does not belong to ISN-01/KORA")
    if runtime.get("public_scope") != "loopback-only":
        raise RuntimeError("runtime origin must remain loopback-only")
    if runtime.get("public_ready") is not False or runtime.get("commercial_ready") is not False:
        raise RuntimeError("runtime receipt already overstates readiness")
    r = runtime.get("runtime") or {}
    if r.get("health_passed") is not True:
        raise RuntimeError("runtime receipt does not contain passing health")
    if r.get("loopback_host") != "127.0.0.1":
        raise RuntimeError("runtime origin is not loopback-only")
    port = int(r.get("loopback_port", 0))
    health = str(r.get("health_path", ""))
    if not (1024 <= port <= 65535) or not health.startswith("/"):
        raise RuntimeError("invalid runtime endpoint in receipt")
    return identity, runtime, f"http://127.0.0.1:{port}{health}"


def http_ok(url: str, timeout: float) -> tuple[bool, int | None, str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "IZAKHONO-EDGE-proof/1"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read(4096)
            return 200 <= r.status < 400, r.status, hashlib.sha256(body).hexdigest()
    except urllib.error.HTTPError as e:
        body = e.read(4096)
        return False, e.code, hashlib.sha256(body).hexdigest()
    except Exception:
        return False, None, ""


def start_reader(proc: subprocess.Popen[str], q: queue.Queue[str]) -> threading.Thread:
    def worker():
        if proc.stdout is None:
            return
        for line in proc.stdout:
            q.put(line.rstrip("\n"))
    t = threading.Thread(target=worker, daemon=True)
    t.start()
    return t


def discover_url(proc: subprocess.Popen[str], timeout: float) -> tuple[str, list[str]]:
    q: queue.Queue[str] = queue.Queue()
    start_reader(proc, q)
    deadline = time.monotonic() + timeout
    lines: list[str] = []
    while time.monotonic() < deadline:
        if proc.poll() is not None and q.empty():
            raise RuntimeError(f"cloudflared exited before publishing a URL; output={lines[-20:]}")
        try:
            line = q.get(timeout=0.25)
        except queue.Empty:
            continue
        lines.append(line)
        match = URL_RE.search(line)
        if match:
            return match.group(0).lower(), lines
    raise RuntimeError(f"timed out waiting for Quick Tunnel URL; output={lines[-20:]}")


def verify_public(base_url: str, health_path: str, timeout: float) -> tuple[int, str]:
    deadline = time.monotonic() + timeout
    url = base_url.rstrip("/") + health_path
    last_status = None
    while time.monotonic() < deadline:
        ok, status, body_sha = http_ok(url, min(8.0, timeout))
        last_status = status
        if ok and status is not None:
            return status, body_sha
        time.sleep(1.0)
    raise RuntimeError(f"public HTTPS health did not pass; last_status={last_status}")


def main() -> int:
    ap = argparse.ArgumentParser(description="IZAKHONO EDGE temporary public proof")
    ap.add_argument("--identity", default="/var/lib/izakhono-cloud/SOVEREIGN-NODE.json")
    ap.add_argument("--runtime", default="/var/lib/izakhono-cloud/runtime/kora-network.json")
    ap.add_argument("--cloudflared", default="cloudflared")
    ap.add_argument("--activation-file", default="/etc/izakhono-cloud/ALLOW_EDGE_QUICK_PROOF")
    ap.add_argument("--out", default="/var/lib/izakhono-cloud/edge/kora-quick-proof.json")
    ap.add_argument("--startup-timeout", type=float, default=45.0)
    ap.add_argument("--verify-timeout", type=float, default=60.0)
    args = ap.parse_args()

    try:
        activation = Path(args.activation_file).resolve()
        if not activation.is_file():
            raise RuntimeError(f"explicit edge-proof activation marker missing: {activation}")
        identity_path = Path(args.identity).resolve()
        runtime_path = Path(args.runtime).resolve()
        identity, runtime, local_health_url = validate_receipts(identity_path, runtime_path)

        ok, local_status, _ = http_ok(local_health_url, 5.0)
        if not ok:
            raise RuntimeError(f"local runtime health failed before edge proof: status={local_status}")

        version = subprocess.run(
            [args.cloudflared, "--version"],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        ).stdout.strip()

        origin = local_health_url.rsplit((runtime.get("runtime") or {})["health_path"], 1)[0]
        proc = subprocess.Popen(
            [args.cloudflared, "tunnel", "--no-autoupdate", "--url", origin],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
        )
        try:
            public_base, output_lines = discover_url(proc, args.startup_timeout)
            health_path = (runtime.get("runtime") or {})["health_path"]
            status, body_sha = verify_public(public_base, health_path, args.verify_timeout)

            proof = {
                "schema": "izakhono.edge-bootstrap-proof/v1",
                "node_name": "ISN-01",
                "project": "kora-network",
                "verified_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "identity_receipt_sha256": sha256(identity_path),
                "runtime_receipt_sha256": sha256(runtime_path),
                "local_origin": origin,
                "local_health_path": health_path,
                "transport": "cloudflare_quick_tunnel",
                "cloudflared_version": version,
                "public_url": public_base,
                "public_health_status": status,
                "public_health_body_sha256": body_sha,
                "public_https_roundtrip_verified": True,
                "verification_scope": "same-node_public_network_roundtrip",
                "external_transport_owner_controlled": False,
                "stable_hostname": False,
                "production_eligible": False,
                "public_ready": False,
                "commercial_ready": False,
                "captured_cloudflared_lines": output_lines[-12:],
            }
            proof["proof_sha256"] = digest(proof)
            out = Path(args.out).resolve()
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(proof, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            print(out)
            print(f"IZAKHONO EDGE QUICK HTTPS PROOF: PASS {public_base}")
            return 0
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
    except (RuntimeError, ValueError, subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
