#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.15 owner-node alpha deployment orchestrator.

This is a deliberately constrained one-project deployment path:
manifest -> deterministic plan -> local Docker build -> isolated loopback health test
-> reversible candidate receipt.

It does not change public DNS/TLS, expose a public listener, or claim public/commercial
readiness. Public promotion stays blocked until the existing owner-node and HTTPS proof
gates are satisfied.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLANNER = HERE / "deploy-plane.py"


def load_planner():
    spec = importlib.util.spec_from_file_location("izakhono_deploy_plane", PLANNER)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load deployment planner")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def run(argv: list[str], *, cwd: Path | None = None, capture: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        cwd=str(cwd) if cwd else None,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def docker_available() -> bool:
    try:
        run(["docker", "version", "--format", "{{.Server.Version}}"])
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def repo_root(manifest: Path, explicit: Path | None) -> Path:
    if explicit:
        return explicit.resolve()
    p = manifest.resolve().parent
    while p != p.parent:
        if (p / ".git").exists() or (p / "izakhono-cloud").is_dir():
            return p
        p = p.parent
    return Path.cwd().resolve()


def ensure_inside(root: Path, candidate: Path, label: str) -> Path:
    root = root.resolve()
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"{label} escapes repository root") from exc
    return candidate


def wait_health(url: str, timeout: float) -> tuple[bool, str]:
    deadline = time.monotonic() + timeout
    last = "not attempted"
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                body = response.read(2048).decode("utf-8", "replace")
                if 200 <= response.status < 400:
                    return True, f"HTTP {response.status}: {body[:200]}"
                last = f"HTTP {response.status}"
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = str(exc)
        time.sleep(0.5)
    return False, last


def container_logs(container_id: str) -> str:
    p = subprocess.run(
        ["docker", "logs", "--tail", "120", container_id],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    return (p.stdout or "").strip()[-8000:]


def build_and_probe(plan: dict, root: Path, *, timeout: float) -> dict:
    source = plan["source"]
    build_context = ensure_inside(root, root / source["build_context"], "build_context")
    dockerfile = ensure_inside(root, root / source["dockerfile_path"], "dockerfile_path")
    if not build_context.exists():
        raise ValueError(f"build context does not exist: {build_context}")
    if not dockerfile.is_file():
        raise ValueError(f"Dockerfile does not exist: {dockerfile}")

    image_tag = plan["build"]["image_tag"]
    run(["docker", "build", "--pull=false", "-f", str(dockerfile), "-t", image_tag, str(build_context)], capture=False)
    image_id = run(["docker", "image", "inspect", image_tag, "--format", "{{.Id}}"]).stdout.strip()
    if not image_id.startswith("sha256:"):
        raise RuntimeError("Docker did not return an immutable local image id")

    name = f"izakhono-probe-{plan['project']}-{plan['plan_sha256'][:10]}"
    port = str(plan["runtime"]["container_port"])
    health_path = plan["runtime"]["health_path"]
    container_id = ""
    try:
        result = run([
            "docker", "run", "-d", "--name", name,
            "--read-only",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges",
            "--pids-limit", "128",
            "--memory", "512m",
            "--cpus", "1.0",
            # Keep the image root read-only while allowing disposable runtime state
            # commonly needed by Nginx/Node and similar containers.
            "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=64m",
            "--tmpfs", "/run:rw,nosuid,nodev,size=16m",
            "--tmpfs", "/var/cache:rw,nosuid,nodev,size=64m",
            "-e", "HOME=/tmp",
            "-p", f"127.0.0.1::{port}",
            image_id,
        ])
        container_id = result.stdout.strip()
        mapping = run(["docker", "port", container_id, f"{port}/tcp"]).stdout.strip().splitlines()[0]
        host_port = mapping.rsplit(":", 1)[-1]
        url = f"http://127.0.0.1:{host_port}{health_path}"
        passed, detail = wait_health(url, timeout)
        inspect = json.loads(run(["docker", "inspect", container_id]).stdout)[0]
        host_config = inspect.get("HostConfig", {})
        proof = {
            "schema": "izakhono.alpha-probe/v1",
            "project": plan["project"],
            "plan_sha256": plan["plan_sha256"],
            "local_image_id": image_id,
            "container_id": container_id,
            "health_url_scope": "loopback-only",
            "health_path": health_path,
            "health_passed": passed,
            "health_detail": detail,
            "runtime_isolation": {
                "readonly_rootfs": bool(host_config.get("ReadonlyRootfs")),
                "privileged": bool(host_config.get("Privileged")),
                "cap_drop": host_config.get("CapDrop") or [],
                "security_opt": host_config.get("SecurityOpt") or [],
                "pids_limit": host_config.get("PidsLimit"),
                "memory": host_config.get("Memory"),
                "nano_cpus": host_config.get("NanoCpus"),
                "tmpfs": host_config.get("Tmpfs") or {},
            },
            "truth_boundary": {
                "owner_node_public_https_verified": False,
                "public_ready": False,
                "commercial_ready": False,
            },
        }
        proof["proof_sha256"] = hashlib.sha256(canonical(proof)).hexdigest()
        if not passed:
            logs = container_logs(container_id)
            suffix = f"; container logs: {logs}" if logs else ""
            raise RuntimeError(f"health gate failed: {detail}{suffix}")
        return proof
    finally:
        if container_id:
            subprocess.run(["docker", "rm", "-f", container_id], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    ap = argparse.ArgumentParser(description="IZAKHONO CLOUD owner-node alpha deployment orchestrator")
    ap.add_argument("manifest", type=Path)
    ap.add_argument("--repo-root", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--execute-local", action="store_true", help="Build and health-probe using the local Docker engine")
    ap.add_argument("--activation-file", type=Path, default=Path("/var/lib/izakhono-cloud/READY"))
    ap.add_argument("--ci-proof", action="store_true", help="Allow Docker software-path proof without claiming owner hardware")
    ap.add_argument("--health-timeout", type=float, default=30.0)
    args = ap.parse_args()

    planner = load_planner()
    try:
        manifest_data = planner.load_manifest(args.manifest)
        plan = planner.build_plan(manifest_data)
        root = repo_root(args.manifest, args.repo_root)
        result: dict = {"plan": plan, "execution": None}
        if args.execute_local:
            if not docker_available():
                raise ValueError("Docker server is unavailable")
            if not args.ci_proof and not args.activation_file.is_file():
                raise ValueError(f"owner-node READY marker required: {args.activation_file}")
            proof = build_and_probe(plan, root, timeout=max(2.0, min(args.health_timeout, 120.0)))
            proof["execution_context"] = "ci_software_path" if args.ci_proof else "owner_node_candidate"
            proof["owner_controlled_hardware_verified"] = False
            result["execution"] = proof
        result["receipt_sha256"] = hashlib.sha256(canonical(result)).hexdigest()
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
