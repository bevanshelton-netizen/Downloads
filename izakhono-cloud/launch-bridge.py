#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.17 zero-cost launch bridge.

Runs a project as a native loopback-only process so Docker and a public IP are
not required for the bootstrap stage. Public access is intentionally delegated
to an outbound tunnel layer and remains separately verified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
MAX_ARGS = 32
MAX_ARG_LEN = 512


def canon(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest(value: object) -> str:
    return hashlib.sha256(canon(value)).hexdigest()


def fail(message: str) -> None:
    raise ValueError(message)


def safe_relative(value: str, field: str) -> str:
    p = Path(value)
    if not value or p.is_absolute() or ".." in p.parts:
        fail(f"{field} must be a safe repository-relative path")
    return value


def validate_command(value: object) -> list[str]:
    if not isinstance(value, list) or not value or len(value) > MAX_ARGS:
        fail(f"command must be a non-empty argv array with at most {MAX_ARGS} entries")
    out: list[str] = []
    for arg in value:
        if not isinstance(arg, str) or not arg or len(arg) > MAX_ARG_LEN or "\x00" in arg:
            fail("command arguments must be non-empty strings without NUL bytes")
        out.append(arg)
    return out


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"file not found: {path}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON: {exc}")
    if not isinstance(value, dict):
        fail("JSON root must be an object")
    return value


def build_plan(manifest: dict, manifest_path: Path) -> dict:
    if manifest.get("schema") != "izakhono.launch-bridge/v1":
        fail("schema must be izakhono.launch-bridge/v1")
    project = manifest.get("project")
    if not isinstance(project, str) or not SLUG_RE.fullmatch(project):
        fail("project must be a lowercase slug")
    workdir = safe_relative(manifest.get("workdir", "."), "workdir")
    command = validate_command(manifest.get("command"))
    port = manifest.get("port")
    if not isinstance(port, int) or not (1024 <= port <= 65535):
        fail("port must be an integer from 1024 to 65535")
    health = manifest.get("health_path", "/health")
    if not isinstance(health, str) or not health.startswith("/") or any(c in health for c in "\r\n"):
        fail("health_path must be a safe absolute HTTP path")
    startup = manifest.get("startup_timeout_seconds", 30)
    if not isinstance(startup, int) or not (1 <= startup <= 120):
        fail("startup_timeout_seconds must be 1..120")
    source = {"manifest_path": manifest_path.as_posix(), "workdir": workdir, "command": command}
    normalized = {
        "schema": "izakhono.launch-bridge/v1",
        "project": project,
        "source": source,
        "runtime": {"mode": "native_process", "listen_host": "127.0.0.1", "port": port, "health_path": health, "startup_timeout_seconds": startup, "docker_required": False, "public_ip_required": False, "inbound_firewall_opening_required": False},
        "ingress": {"mode": "outbound_tunnel", "tunnel_credentials_in_plan": False, "custom_domain_required_for_production": True, "external_https_verification_required": True},
        "truth_boundary": {"bootstrap_path": True, "owner_runtime_executed": False, "public_https_verified": False, "independent_cloud_complete": False, "commercial_ready": False},
    }
    normalized["manifest_sha256"] = digest(manifest)
    normalized["plan_sha256"] = digest(normalized)
    return normalized


def validate_plan(plan: dict) -> dict:
    expected = plan.get("plan_sha256")
    if not isinstance(expected, str) or not SHA_RE.fullmatch(expected): fail("plan_sha256 missing or invalid")
    body = dict(plan); body.pop("plan_sha256", None)
    if digest(body) != expected: fail("plan_sha256 mismatch")
    if plan.get("schema") != "izakhono.launch-bridge/v1": fail("unsupported plan schema")
    runtime = plan.get("runtime", {})
    if runtime.get("mode") != "native_process" or runtime.get("listen_host") != "127.0.0.1": fail("native runtime must be loopback-only")
    if runtime.get("docker_required") is not False or runtime.get("public_ip_required") is not False: fail("launch bridge invariant failed")
    validate_command(plan.get("source", {}).get("command")); safe_relative(plan.get("source", {}).get("workdir", ""), "workdir")
    return plan


def health_url(plan: dict) -> str:
    r = plan["runtime"]; return f"http://127.0.0.1:{r['port']}{r['health_path']}"


def wait_health(plan: dict, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + plan["runtime"]["startup_timeout_seconds"]
    url = health_url(plan); last = "not attempted"
    while time.monotonic() < deadline:
        if process.poll() is not None: fail(f"child exited before health pass with code {process.returncode}")
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if 200 <= response.status < 300: return
                last = f"HTTP {response.status}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc: last = str(exc)
        time.sleep(0.25)
    fail(f"health check timed out: {last}")


def start_process(plan: dict, repo_root: Path) -> subprocess.Popen[bytes]:
    workdir = (repo_root / plan["source"]["workdir"]).resolve(); root = repo_root.resolve()
    try: workdir.relative_to(root)
    except ValueError: fail("resolved workdir escaped repository root")
    if not workdir.is_dir(): fail(f"workdir does not exist: {workdir}")
    env = os.environ.copy(); env.update({"HOST":"127.0.0.1","HOSTNAME":"127.0.0.1","PORT":str(plan["runtime"]["port"]),"IZAKHONO_PROJECT":plan["project"],"IZAKHONO_RUNTIME_MODE":"launch-bridge"})
    creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) if os.name == "nt" else 0
    kwargs = {} if os.name == "nt" else {"start_new_session": True}
    return subprocess.Popen(plan["source"]["command"], cwd=str(workdir), env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=creationflags, **kwargs)


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None: return
    try:
        if os.name == "nt": process.send_signal(getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM))
        else: os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except Exception:
        process.kill()
        try: process.wait(timeout=3)
        except Exception: pass


def receipt(plan: dict, pid: int, proof_only: bool) -> dict:
    value = {"schema":"izakhono.launch-receipt/v1","project":plan["project"],"plan_sha256":plan["plan_sha256"],"runtime_mode":"native_process","listen_host":"127.0.0.1","port":plan["runtime"]["port"],"health_path":plan["runtime"]["health_path"],"local_health_passed":True,"docker_used":False,"public_ip_used":False,"proof_only":proof_only,"pid_recorded":pid,"public_https_verified":False,"commercial_ready":False}
    value["receipt_sha256"] = digest(value); return value


def cmd_plan(args: argparse.Namespace) -> int:
    manifest = load_json(args.manifest); plan = build_plan(manifest, args.manifest); text = json.dumps(plan, indent=2, sort_keys=True) + "\n"
    if args.out: args.out.write_text(text, encoding="utf-8")
    else: sys.stdout.write(text)
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    plan = validate_plan(load_json(args.plan)); process = start_process(plan, args.repo_root.resolve())
    try:
        wait_health(plan, process); rec = receipt(plan, process.pid, args.proof_only); text = json.dumps(rec, indent=2, sort_keys=True) + "\n"
        if args.receipt: args.receipt.write_text(text, encoding="utf-8")
        else: sys.stdout.write(text); sys.stdout.flush()
        if args.proof_only: return 0
        return process.wait()
    finally:
        if args.proof_only: stop_process(process)


def main() -> int:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD zero-cost native launch bridge"); sub = parser.add_subparsers(dest="command_name", required=True)
    p = sub.add_parser("plan"); p.add_argument("manifest", type=Path); p.add_argument("--out", type=Path); p.set_defaults(func=cmd_plan)
    r = sub.add_parser("run"); r.add_argument("plan", type=Path); r.add_argument("--repo-root", type=Path, default=Path(".")); r.add_argument("--receipt", type=Path); r.add_argument("--proof-only", action="store_true"); r.set_defaults(func=cmd_run)
    args = parser.parse_args()
    try: return args.func(args)
    except (ValueError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr); return 2

if __name__ == "__main__": raise SystemExit(main())
