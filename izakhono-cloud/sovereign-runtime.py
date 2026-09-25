#!/usr/bin/env python3
"""Persistent loopback runtime for IZAKHONO Sovereign Node ISN-01.

This layer turns a previously proven workload into a continuously running local service.
It never exposes ports publicly and never changes DNS/TLS. Public promotion remains a
separate IZAKHONO EDGE gate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

STATE_ROOT = Path(os.environ.get("IZAKHONO_RUNTIME_STATE_ROOT", "/var/lib/izakhono-cloud/runtime"))
NODE_NAME = "ISN-01"
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")


def run(argv: list[str], *, capture: bool = True, check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(
        argv,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if check and p.returncode:
        raise RuntimeError((p.stderr or p.stdout or "").strip() or f"command failed: {argv}")
    return p


def docker_available() -> None:
    p = run(["docker", "version", "--format", "{{.Server.Version}}"])
    if not p.stdout.strip():
        raise RuntimeError("Docker server did not report a version")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def load_manifest(root: Path, rel: str) -> tuple[Path, dict]:
    root = root.resolve()
    manifest = (root / rel).resolve()
    try:
        manifest.relative_to(root)
    except ValueError as exc:
        raise ValueError("manifest must remain inside repo root") from exc
    if not manifest.is_file():
        raise ValueError(f"manifest not found: {manifest}")
    data = json.loads(manifest.read_text(encoding="utf-8"))
    slug = str(data.get("slug", "")).strip().lower()
    if not NAME_RE.fullmatch(slug):
        raise ValueError("invalid manifest slug")
    port = int(data.get("container_port", 0))
    if not (1 <= port <= 65535):
        raise ValueError("invalid container port")
    health = str(data.get("health_path", "/"))
    if not health.startswith("/") or any(x in health for x in ("\n", "\r", " ")):
        raise ValueError("invalid health path")
    context = (root / str(data.get("build_context", ""))).resolve()
    dockerfile = (root / str(data.get("dockerfile_path", ""))).resolve()
    for label, path in (("build context", context), ("Dockerfile", dockerfile)):
        try:
            path.relative_to(root)
        except ValueError as exc:
            raise ValueError(f"{label} escapes repo root") from exc
    if not context.exists() or not dockerfile.is_file():
        raise ValueError("build context or Dockerfile missing")
    data["_context"] = str(context)
    data["_dockerfile"] = str(dockerfile)
    return manifest, data


def git_commit(root: Path) -> str | None:
    p = run(["git", "-C", str(root), "rev-parse", "HEAD"], check=False)
    v = (p.stdout or "").strip().lower()
    return v if re.fullmatch(r"[0-9a-f]{40}", v) else None


def wait_health(url: str, timeout: float) -> tuple[bool, str]:
    deadline = time.monotonic() + timeout
    last = "not attempted"
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                body = r.read(2048).decode("utf-8", "replace")
                if 200 <= r.status < 400:
                    return True, f"HTTP {r.status}: {body[:200]}"
                last = f"HTTP {r.status}"
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = str(exc)
        time.sleep(0.5)
    return False, last


def docker_logs(name: str) -> str:
    p = run(["docker", "logs", "--tail", "120", name], check=False)
    return ((p.stdout or "") + (p.stderr or "")).strip()[-8000:]


def normalized_run_args(name: str, image_id: str, host_port: int | None, container_port: int, restart: bool) -> list[str]:
    args = [
        "docker", "run", "-d", "--name", name,
        "--read-only",
        "--cap-drop", "ALL",
        "--cap-add", "CHOWN",
        "--cap-add", "SETUID",
        "--cap-add", "SETGID",
        "--security-opt", "no-new-privileges",
        "--pids-limit", "128",
        "--memory", "512m",
        "--cpus", "1.0",
        "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=64m",
        "--tmpfs", "/run:rw,nosuid,nodev,size=16m",
        "-e", "HOME=/tmp",
    ]
    if restart:
        args += ["--restart", "unless-stopped"]
    if host_port is None:
        args += ["-p", f"127.0.0.1::{container_port}"]
    else:
        args += ["-p", f"127.0.0.1:{host_port}:{container_port}"]
    args.append(image_id)
    return args


def mapped_port(name: str, container_port: int) -> int:
    line = run(["docker", "port", name, f"{container_port}/tcp"]).stdout.strip().splitlines()[0]
    return int(line.rsplit(":", 1)[-1])


def inspect_container(name: str) -> dict | None:
    p = run(["docker", "inspect", name], check=False)
    if p.returncode:
        return None
    return json.loads(p.stdout)[0]


def remove_container(name: str) -> None:
    run(["docker", "rm", "-f", name], check=False)


def probe_candidate(image_id: str, slug: str, container_port: int, health: str, timeout: float) -> dict:
    name = f"izakhono-{NODE_NAME.lower()}-{slug}-candidate"
    remove_container(name)
    run(normalized_run_args(name, image_id, None, container_port, False))
    try:
        port = mapped_port(name, container_port)
        url = f"http://127.0.0.1:{port}{health}"
        passed, detail = wait_health(url, timeout)
        if not passed:
            raise RuntimeError(f"candidate health failed: {detail}; logs: {docker_logs(name)}")
        info = inspect_container(name) or {}
        host = info.get("HostConfig", {})
        if not host.get("ReadonlyRootfs") or host.get("Privileged"):
            raise RuntimeError("candidate isolation validation failed")
        return {"health_passed": True, "health_detail": detail, "loopback_port": port}
    finally:
        remove_container(name)


def launch_final(name: str, image_id: str, host_port: int, container_port: int, health: str, timeout: float) -> dict:
    remove_container(name)
    run(normalized_run_args(name, image_id, host_port, container_port, True))
    url = f"http://127.0.0.1:{host_port}{health}"
    passed, detail = wait_health(url, timeout)
    if not passed:
        logs = docker_logs(name)
        remove_container(name)
        raise RuntimeError(f"persistent runtime health failed: {detail}; logs: {logs}")
    inspect = inspect_container(name) or {}
    return {
        "container_name": name,
        "container_id": inspect.get("Id"),
        "image_id": image_id,
        "loopback_host": "127.0.0.1",
        "loopback_port": host_port,
        "health_path": health,
        "health_passed": True,
        "restart_policy": ((inspect.get("HostConfig") or {}).get("RestartPolicy") or {}).get("Name"),
    }


def deploy(args: argparse.Namespace) -> int:
    activation = Path(args.activation_file)
    if not activation.is_file():
        raise RuntimeError(f"owner activation marker missing: {activation}")
    docker_available()
    root = Path(args.repo_root).resolve()
    manifest_path, data = load_manifest(root, args.manifest)
    slug = data["slug"]
    stable_name = f"izakhono-{NODE_NAME.lower()}-{slug}"
    state_path = STATE_ROOT / f"{slug}.json"
    STATE_ROOT.mkdir(parents=True, exist_ok=True)

    source_commit = git_commit(root)
    build_key = {
        "manifest_sha256": sha256_bytes(manifest_path.read_bytes()),
        "source_commit": source_commit,
        "node": NODE_NAME,
    }
    tag = f"izakhono/{NODE_NAME.lower()}/{slug}:{sha256_bytes(canonical(build_key))[:16]}"

    run([
        "docker", "build", "--pull=false",
        "-f", data["_dockerfile"],
        "-t", tag,
        data["_context"],
    ], capture=False)
    image_id = run(["docker", "image", "inspect", tag, "--format", "{{.Id}}"]).stdout.strip()
    if not image_id.startswith("sha256:"):
        raise RuntimeError("Docker image is not pinned by immutable local ID")

    probe_candidate(image_id, slug, int(data["container_port"]), data["health_path"], args.health_timeout)

    previous = inspect_container(stable_name)
    previous_image = previous.get("Image") if previous else None
    if previous:
        remove_container(stable_name)

    try:
        runtime = launch_final(
            stable_name,
            image_id,
            args.host_port,
            int(data["container_port"]),
            data["health_path"],
            args.health_timeout,
        )
    except Exception:
        if previous_image:
            try:
                launch_final(
                    stable_name,
                    previous_image,
                    args.host_port,
                    int(data["container_port"]),
                    data["health_path"],
                    args.health_timeout,
                )
            except Exception as rollback_exc:
                raise RuntimeError(f"new runtime failed and rollback also failed: {rollback_exc}")
        raise

    receipt = {
        "schema": "izakhono.sovereign-runtime/v1",
        "node_name": NODE_NAME,
        "project": slug,
        "manifest": args.manifest,
        "source_commit": source_commit,
        "activation_marker": str(activation),
        "image_tag": tag,
        "image_id": image_id,
        "previous_image_id": previous_image,
        "runtime": runtime,
        "public_scope": "loopback-only",
        "public_ready": False,
        "commercial_ready": False,
    }
    receipt["receipt_sha256"] = sha256_bytes(canonical(receipt))
    state_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(state_path)
    print(f"{NODE_NAME} {slug} PERSISTENT RUNTIME: PASS")
    print(f"local_url=http://127.0.0.1:{args.host_port}{data['health_path']}")
    return 0


def status(args: argparse.Namespace) -> int:
    state = STATE_ROOT / f"{args.project}.json"
    if not state.is_file():
        raise RuntimeError(f"runtime state not found: {state}")
    data = json.loads(state.read_text(encoding="utf-8"))
    runtime = data["runtime"]
    name = runtime["container_name"]
    inspect = inspect_container(name)
    if not inspect or not (inspect.get("State") or {}).get("Running"):
        raise RuntimeError(f"runtime container is not running: {name}")
    url = f"http://127.0.0.1:{runtime['loopback_port']}{runtime['health_path']}"
    passed, detail = wait_health(url, args.health_timeout)
    if not passed:
        raise RuntimeError(f"runtime health failed: {detail}")
    out = {
        "node_name": data["node_name"],
        "project": data["project"],
        "container_name": name,
        "image_id": inspect.get("Image"),
        "loopback_url": url,
        "health_passed": True,
        "public_ready": False,
        "commercial_ready": False,
    }
    print(json.dumps(out, indent=2, sort_keys=True))
    return 0


def rollback(args: argparse.Namespace) -> int:
    state = STATE_ROOT / f"{args.project}.json"
    if not state.is_file():
        raise RuntimeError(f"runtime state not found: {state}")
    data = json.loads(state.read_text(encoding="utf-8"))
    previous = data.get("previous_image_id")
    if not previous:
        raise RuntimeError("no previous image recorded for rollback")
    runtime = data["runtime"]
    launch_final(
        runtime["container_name"],
        previous,
        int(runtime["loopback_port"]),
        int(args.container_port),
        runtime["health_path"],
        args.health_timeout,
    )
    print(f"{NODE_NAME} {args.project} ROLLBACK: PASS")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="IZAKHONO Sovereign persistent runtime")
    sp = ap.add_subparsers(dest="cmd", required=True)

    d = sp.add_parser("deploy")
    d.add_argument("manifest")
    d.add_argument("--repo-root", default=".")
    d.add_argument("--activation-file", default="/var/lib/izakhono-cloud/READY")
    d.add_argument("--host-port", type=int, default=18080)
    d.add_argument("--health-timeout", type=float, default=45.0)

    s = sp.add_parser("status")
    s.add_argument("--project", required=True)
    s.add_argument("--health-timeout", type=float, default=10.0)

    r = sp.add_parser("rollback")
    r.add_argument("--project", required=True)
    r.add_argument("--container-port", type=int, required=True)
    r.add_argument("--health-timeout", type=float, default=30.0)

    args = ap.parse_args()
    try:
        if args.cmd == "deploy":
            if not (1024 <= args.host_port <= 65535):
                raise ValueError("host port must be 1024..65535")
            return deploy(args)
        if args.cmd == "status":
            return status(args)
        return rollback(args)
    except (ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
