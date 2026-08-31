#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.10 controlled local execution candidate.

This layer adds an explicitly local, owner-activated, reversible container execution
path for tightly constrained proof workloads. It does not add a network listener,
remote shell, automatic scheduling, failover, or public-ready claims.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

PERMIT_SCHEMA = "izakhono.local-execution-permit.v1"
ALGORITHM = "ed25519"
MAX_TTL_MINUTES = 15
MAX_CPU_MILLIS = 1000
MAX_MEMORY_MB = 512
MAX_DISK_MB = 64


def die(message: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {message}")


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str], *, input_bytes: bytes | None = None, capture: bool = True) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(
            cmd,
            input=input_bytes,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            check=True,
        )
    except FileNotFoundError:
        die(f"required command not found: {cmd[0]}")
    except subprocess.CalledProcessError as exc:
        detail = ""
        if exc.stderr:
            detail = exc.stderr.decode("utf-8", "replace").strip()
        die(f"command failed: {' '.join(cmd)}{': ' + detail if detail else ''}")


def node_paths(node_state_dir: Path) -> tuple[Path, Path, Path]:
    identity = node_state_dir / "identity"
    return identity / "private.pem", identity / "public.pem", identity / "node-id"


def require_node_identity(node_state_dir: Path) -> tuple[Path, Path, str]:
    priv, pub, node_id_file = node_paths(node_state_dir)
    if not (priv.exists() and pub.exists() and node_id_file.exists()):
        die("complete v1.6 node identity is required")
    node_id = node_id_file.read_text(encoding="utf-8").strip()
    if not node_id.startswith("izn-"):
        die("invalid local node id")
    expected = "izn-" + hashlib.sha256(pub.read_bytes()).hexdigest()[:24]
    if node_id != expected:
        die("local node id does not match public key fingerprint")
    return priv, pub, node_id


def require_local_activation(proof_dir: Path) -> None:
    if not (proof_dir / "READY").exists():
        die("v1.10 execution requires a real-node READY marker; LOCAL_READY is not sufficient")
    activation = proof_dir / "ALLOW_LOCAL_EXECUTION"
    if not activation.exists():
        die("local execution is disabled; owner must create ALLOW_LOCAL_EXECUTION on the node")
    if activation.read_text(encoding="utf-8", errors="replace").strip() != "enabled=true":
        die("ALLOW_LOCAL_EXECUTION must contain exactly enabled=true")


def verify_v19_bundle(bundle_path: Path, lifecycle_tool: Path) -> dict:
    if not lifecycle_tool.exists():
        die(f"v1.9 lifecycle verifier not found: {lifecycle_tool}")
    run(["python3", str(lifecycle_tool), "verify", str(bundle_path)])
    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read workload bundle: {exc}")
    manifest = bundle.get("manifest")
    if not isinstance(manifest, dict):
        die("signed workload manifest missing")
    spec = manifest.get("spec")
    if not isinstance(spec, dict):
        die("signed workload spec missing")
    return manifest


def validate_proof_workload(spec: dict) -> None:
    if int(spec.get("cpu_millis", 0)) > MAX_CPU_MILLIS:
        die(f"v1.10 proof workload cpu_millis exceeds {MAX_CPU_MILLIS}")
    if int(spec.get("memory_mb", 0)) > MAX_MEMORY_MB:
        die(f"v1.10 proof workload memory_mb exceeds {MAX_MEMORY_MB}")
    if int(spec.get("disk_mb", 0)) > MAX_DISK_MB:
        die(f"v1.10 proof workload disk_mb exceeds {MAX_DISK_MB}")
    if spec.get("ports"):
        die("v1.10 proof workload cannot publish ports")
    if spec.get("privileged", False) or spec.get("host_network", False) or spec.get("host_mounts"):
        die("unsafe host access is forbidden")
    if spec.get("rootfs_read_only", True) is not True:
        die("proof workload root filesystem must be read-only")


def sign_bytes(private_key: Path, data: bytes) -> bytes:
    with tempfile.TemporaryDirectory(prefix="izakhono-local-sign-") as td:
        p_data = Path(td) / "data.json"
        p_sig = Path(td) / "data.sig"
        p_data.write_bytes(data)
        run(["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", str(private_key), "-in", str(p_data), "-out", str(p_sig)])
        return p_sig.read_bytes()


def verify_signature(public_key: Path, data: bytes, signature: bytes) -> None:
    with tempfile.TemporaryDirectory(prefix="izakhono-local-verify-") as td:
        p_data = Path(td) / "data.json"
        p_sig = Path(td) / "data.sig"
        p_data.write_bytes(data)
        p_sig.write_bytes(signature)
        run(["openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(public_key), "-in", str(p_data), "-sigfile", str(p_sig)])


def authorize(bundle: Path, lifecycle_tool: Path, node_state_dir: Path, proof_dir: Path, output: Path, ttl_minutes: int) -> None:
    if ttl_minutes < 1 or ttl_minutes > MAX_TTL_MINUTES:
        die(f"permit ttl must be between 1 and {MAX_TTL_MINUTES} minutes")
    require_local_activation(proof_dir)
    priv, pub, node_id = require_node_identity(node_state_dir)
    manifest = verify_v19_bundle(bundle, lifecycle_tool)
    spec = manifest["spec"]
    validate_proof_workload(spec)
    if spec.get("target_node_id") != node_id:
        die("signed workload target does not match this local node")

    issued = now()
    permit = {
        "schema": PERMIT_SCHEMA,
        "node_id": node_id,
        "workload_id": spec["workload_id"],
        "bundle_sha256": sha256_file(bundle),
        "issued_at": iso(issued),
        "expires_at": iso(issued + timedelta(minutes=ttl_minutes)),
        "nonce": secrets.token_hex(16),
        "mode": "local_isolated_candidate",
        "network": "none",
        "remote_execution": False,
        "automatic_failover": False,
        "public_ready": False,
        "commercial_ready": False,
    }
    signature = sign_bytes(priv, canonical(permit))
    payload = {
        "schema": PERMIT_SCHEMA,
        "algorithm": ALGORITHM,
        "permit": permit,
        "node_public_key": pub.read_text(encoding="utf-8"),
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(output, 0o600)
    print(f"permit={output}")
    print(f"workload_id={spec['workload_id']}")
    print("execution_scope=local_isolated_candidate")
    print("public_ready=false")


def parse_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        die("invalid permit timestamp")


def verify_permit(permit_path: Path, bundle: Path, node_state_dir: Path) -> dict:
    _, local_pub, node_id = require_node_identity(node_state_dir)
    try:
        payload = json.loads(permit_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read execution permit: {exc}")
    if payload.get("schema") != PERMIT_SCHEMA or payload.get("algorithm") != ALGORITHM:
        die("unsupported execution permit")
    permit = payload.get("permit")
    pub_text = payload.get("node_public_key")
    sig_b64 = payload.get("signature_b64")
    if not isinstance(permit, dict) or not isinstance(pub_text, str) or not isinstance(sig_b64, str):
        die("malformed execution permit")
    if pub_text.encode("utf-8") != local_pub.read_bytes():
        die("execution permit was not signed by this node identity")
    if permit.get("node_id") != node_id:
        die("execution permit targets a different node")
    for key in ("remote_execution", "automatic_failover", "public_ready", "commercial_ready"):
        if permit.get(key) is not False:
            die(f"execution permit violates truth boundary: {key}")
    if permit.get("mode") != "local_isolated_candidate" or permit.get("network") != "none":
        die("execution permit is not isolated-local mode")
    if permit.get("bundle_sha256") != sha256_file(bundle):
        die("execution permit does not match signed workload bundle")
    expires = parse_timestamp(str(permit.get("expires_at", "")))
    if now() >= expires:
        die("execution permit has expired")
    try:
        signature = base64.b64decode(sig_b64, validate=True)
    except Exception:
        die("invalid execution permit signature encoding")
    verify_signature(local_pub, canonical(permit), signature)
    return permit


def runtime_command(spec: dict, execution_id: str, runtime_bin: str) -> list[str]:
    cpu = max(0.001, int(spec["cpu_millis"]) / 1000.0)
    return [
        runtime_bin, "create",
        "--name", f"izakhono-proof-{execution_id}",
        "--read-only",
        "--network", "none",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges:true",
        "--pids-limit", "128",
        "--memory", f"{int(spec['memory_mb'])}m",
        "--cpus", f"{cpu:.3f}",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        spec["image"],
    ]


def execute(permit_path: Path, bundle: Path, lifecycle_tool: Path, node_state_dir: Path, proof_dir: Path, execution_dir: Path, execute_local: bool) -> None:
    require_local_activation(proof_dir)
    permit = verify_permit(permit_path, bundle, node_state_dir)
    manifest = verify_v19_bundle(bundle, lifecycle_tool)
    spec = manifest["spec"]
    validate_proof_workload(spec)
    if spec.get("target_node_id") != permit.get("node_id") or spec.get("workload_id") != permit.get("workload_id"):
        die("permit and workload identity do not match")

    execution_id = hashlib.sha256(canonical(permit)).hexdigest()[:20]
    target = execution_dir / execution_id
    consumed = execution_dir / "consumed-nonces" / str(permit["nonce"])
    if consumed.exists():
        die("execution permit nonce has already been consumed")

    runtime_bin = os.environ.get("IZAKHONO_RUNTIME_BIN", "docker")
    create_cmd = runtime_command(spec, execution_id, runtime_bin)
    plan = {
        "execution_id": execution_id,
        "workload_id": spec["workload_id"],
        "node_id": permit["node_id"],
        "runtime": runtime_bin,
        "create_argv": create_cmd,
        "start_argv": [runtime_bin, "start", f"izakhono-proof-{execution_id}"],
        "rollback_argv": [runtime_bin, "rm", "-f", f"izakhono-proof-{execution_id}"],
        "network": "none",
        "public_ready": False,
        "commercial_ready": False,
    }

    if not execute_local:
        print(json.dumps({**plan, "execution_performed": False, "state": "validated_not_executed"}, indent=2, sort_keys=True))
        return

    if shutil.which(runtime_bin) is None and os.path.sep not in runtime_bin:
        die(f"container runtime not found: {runtime_bin}")
    run([runtime_bin, "info"])
    consumed.parent.mkdir(parents=True, exist_ok=True)
    consumed.write_text(iso(now()) + "\n", encoding="utf-8")
    target.mkdir(parents=True, exist_ok=False)
    try:
        run(create_cmd)
        run(plan["start_argv"])
    except SystemExit:
        try:
            run(plan["rollback_argv"])
        except SystemExit:
            pass
        raise
    state = {
        **plan,
        "state": "executed_local_candidate",
        "executed_at": iso(now()),
        "automatic_failover": False,
        "public_ready": False,
        "commercial_ready": False,
    }
    (target / "state.json").write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"execution_id={execution_id}")
    print("state=executed_local_candidate")
    print("public_ready=false")


def rollback(execution_id: str, execution_dir: Path) -> None:
    target = execution_dir / execution_id
    state_path = target / "state.json"
    if not state_path.exists():
        die("execution state not found")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    if state.get("state") != "executed_local_candidate":
        die("execution is not in rollback-eligible state")
    argv = state.get("rollback_argv")
    if not isinstance(argv, list) or not all(isinstance(x, str) for x in argv):
        die("rollback command missing from state")
    run(argv)
    state["state"] = "rolled_back_local"
    state["rolled_back_at"] = iso(now())
    state["public_ready"] = False
    state["commercial_ready"] = False
    state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("state=rolled_back_local")
    print("public_ready=false")


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD controlled local execution candidate")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("authorize")
    p.add_argument("bundle", type=Path)
    p.add_argument("--lifecycle-tool", type=Path, required=True)
    p.add_argument("--node-state-dir", type=Path, required=True)
    p.add_argument("--proof-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--ttl-minutes", type=int, default=5)

    p = sub.add_parser("verify-permit")
    p.add_argument("permit", type=Path)
    p.add_argument("bundle", type=Path)
    p.add_argument("--node-state-dir", type=Path, required=True)

    p = sub.add_parser("execute")
    p.add_argument("permit", type=Path)
    p.add_argument("bundle", type=Path)
    p.add_argument("--lifecycle-tool", type=Path, required=True)
    p.add_argument("--node-state-dir", type=Path, required=True)
    p.add_argument("--proof-dir", type=Path, required=True)
    p.add_argument("--execution-dir", type=Path, required=True)
    p.add_argument("--execute-local", action="store_true", help="explicitly allow local isolated execution")

    p = sub.add_parser("rollback")
    p.add_argument("--execution-id", required=True)
    p.add_argument("--execution-dir", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "authorize":
        authorize(args.bundle, args.lifecycle_tool, args.node_state_dir, args.proof_dir, args.output, args.ttl_minutes)
    elif args.command == "verify-permit":
        permit = verify_permit(args.permit, args.bundle, args.node_state_dir)
        print(f"verified_workload={permit['workload_id']}")
        print("public_ready=false")
    elif args.command == "execute":
        execute(args.permit, args.bundle, args.lifecycle_tool, args.node_state_dir, args.proof_dir, args.execution_dir, args.execute_local)
    elif args.command == "rollback":
        rollback(args.execution_id, args.execution_dir)


if __name__ == "__main__":
    main()
