#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.6 signed node enrollment foundation.

This deliberately provides identity + signed candidate registration only.
It does not enable remote root execution, scheduling, failover or public-ready claims.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

SCHEMA = "izakhono.node-enrollment.v1"
ALGORITHM = "ed25519"


def die(message: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {message}")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def run(cmd: list[str], *, input_bytes: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(cmd, input=input_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except FileNotFoundError:
        die(f"required command not found: {cmd[0]}")
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", "replace").strip()
        die(f"command failed: {' '.join(cmd)}{': ' + detail if detail else ''}")


def ensure_openssl() -> None:
    if shutil.which("openssl") is None:
        die("openssl is required")


def identity_paths(state_dir: Path) -> tuple[Path, Path, Path]:
    identity = state_dir / "identity"
    return identity / "private.pem", identity / "public.pem", identity / "node-id"


def public_fingerprint(public_pem: bytes) -> str:
    return hashlib.sha256(public_pem).hexdigest()


def expected_node_id(public_pem: bytes) -> str:
    return "izn-" + public_fingerprint(public_pem)[:24]


def init_identity(state_dir: Path) -> str:
    ensure_openssl()
    private_key, public_key, node_id_file = identity_paths(state_dir)
    private_key.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(private_key.parent, 0o700)

    if private_key.exists() or public_key.exists() or node_id_file.exists():
        if not (private_key.exists() and public_key.exists() and node_id_file.exists()):
            die("partial node identity exists; refuse to overwrite")
        public_pem = public_key.read_bytes()
        derived = expected_node_id(public_pem)
        stored = node_id_file.read_text(encoding="utf-8").strip()
        if stored != derived:
            die("stored node id does not match public key fingerprint")
        return stored

    run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(private_key)])
    os.chmod(private_key, 0o600)
    run(["openssl", "pkey", "-in", str(private_key), "-pubout", "-out", str(public_key)])
    os.chmod(public_key, 0o644)
    public_pem = public_key.read_bytes()
    node_id = expected_node_id(public_pem)
    node_id_file.write_text(node_id + "\n", encoding="utf-8")
    os.chmod(node_id_file, 0o644)
    return node_id


def read_os_name() -> str:
    path = Path("/etc/os-release")
    if not path.exists():
        return platform.system()
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"')
    return values.get("PRETTY_NAME") or values.get("NAME") or platform.system()


def proof_state(proof_state_dir: Path) -> str:
    # READY is a runtime proof marker, not an independent public-internet proof.
    if (proof_state_dir / "READY").exists():
        return "runtime_ready"
    if (proof_state_dir / "LOCAL_READY").exists():
        return "local_ready"
    return "unproven"


def build_descriptor(state_dir: Path, proof_state_dir: Path) -> dict[str, object]:
    private_key, public_key, node_id_file = identity_paths(state_dir)
    if not (private_key.exists() and public_key.exists() and node_id_file.exists()):
        die("node identity has not been initialized")
    public_pem = public_key.read_bytes()
    node_id = node_id_file.read_text(encoding="utf-8").strip()
    if node_id != expected_node_id(public_pem):
        die("node identity fingerprint mismatch")

    state = proof_state(proof_state_dir)
    if state == "unproven":
        die("node must have READY or LOCAL_READY before enrollment export")

    return {
        "schema": SCHEMA,
        "node_id": node_id,
        "public_key_sha256": public_fingerprint(public_pem),
        "hostname": socket.gethostname(),
        "architecture": platform.machine(),
        "os": read_os_name(),
        "owner_hosted": True,
        "proof_state": state,
        # v1.6 enrollment never promotes public readiness. That remains an external gate.
        "public_ready": False,
        "trust_state": "candidate",
        "issued_at": utc_now(),
    }


def sign_descriptor(private_key: Path, descriptor_bytes: bytes) -> bytes:
    ensure_openssl()
    with tempfile.TemporaryDirectory(prefix="izakhono-sign-") as tmp:
        data = Path(tmp) / "descriptor.json"
        sig = Path(tmp) / "descriptor.sig"
        data.write_bytes(descriptor_bytes)
        run([
            "openssl", "pkeyutl", "-sign", "-rawin",
            "-inkey", str(private_key), "-in", str(data), "-out", str(sig),
        ])
        return sig.read_bytes()


def export_bundle(state_dir: Path, proof_state_dir: Path, output: Path) -> None:
    private_key, public_key, _ = identity_paths(state_dir)
    descriptor = build_descriptor(state_dir, proof_state_dir)
    descriptor_bytes = canonical(descriptor)
    signature = sign_descriptor(private_key, descriptor_bytes)
    bundle = {
        "schema": SCHEMA,
        "signature_algorithm": ALGORITHM,
        "descriptor": descriptor,
        "public_key_pem": public_key.read_text(encoding="utf-8"),
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(output.suffix + ".tmp")
    tmp.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, output)
    print(f"enrollment_bundle={output}")
    print(f"node_id={descriptor['node_id']}")
    print("trust_state=candidate")
    print("public_ready=false")


def validate_bundle(bundle: dict[str, object]) -> tuple[dict[str, object], str, bytes]:
    if bundle.get("schema") != SCHEMA or bundle.get("signature_algorithm") != ALGORITHM:
        die("unsupported enrollment bundle schema or signature algorithm")
    descriptor = bundle.get("descriptor")
    public_key_pem = bundle.get("public_key_pem")
    signature_b64 = bundle.get("signature_b64")
    if not isinstance(descriptor, dict) or not isinstance(public_key_pem, str) or not isinstance(signature_b64, str):
        die("malformed enrollment bundle")
    if descriptor.get("schema") != SCHEMA:
        die("descriptor schema mismatch")
    if descriptor.get("owner_hosted") is not True:
        die("only owner-hosted candidate nodes are accepted by v1.6")
    if descriptor.get("public_ready") is not False:
        die("v1.6 enrollment cannot assert public readiness")
    if descriptor.get("trust_state") != "candidate":
        die("v1.6 enrollment accepts candidate nodes only")
    if descriptor.get("proof_state") not in {"local_ready", "runtime_ready"}:
        die("node lacks an accepted proof marker")

    public_bytes = public_key_pem.encode("utf-8")
    fingerprint = public_fingerprint(public_bytes)
    if descriptor.get("public_key_sha256") != fingerprint:
        die("public key fingerprint mismatch")
    if descriptor.get("node_id") != expected_node_id(public_bytes):
        die("node id does not match public key")
    try:
        signature = base64.b64decode(signature_b64, validate=True)
    except Exception:
        die("invalid base64 signature")
    return descriptor, public_key_pem, signature


def verify_bundle(bundle_path: Path) -> dict[str, object]:
    ensure_openssl()
    try:
        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read enrollment bundle: {exc}")
    if not isinstance(bundle, dict):
        die("enrollment bundle must be a JSON object")
    descriptor, public_key_pem, signature = validate_bundle(bundle)
    with tempfile.TemporaryDirectory(prefix="izakhono-verify-") as tmp:
        pub = Path(tmp) / "public.pem"
        data = Path(tmp) / "descriptor.json"
        sig = Path(tmp) / "descriptor.sig"
        pub.write_text(public_key_pem, encoding="utf-8")
        data.write_bytes(canonical(descriptor))
        sig.write_bytes(signature)
        run([
            "openssl", "pkeyutl", "-verify", "-rawin", "-pubin",
            "-inkey", str(pub), "-in", str(data), "-sigfile", str(sig),
        ])
    return descriptor


def register_bundle(bundle_path: Path, registry_dir: Path) -> None:
    descriptor = verify_bundle(bundle_path)
    node_id = str(descriptor["node_id"])
    node_dir = registry_dir / "nodes" / node_id
    node_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(registry_dir, 0o700)
    os.chmod(registry_dir / "nodes", 0o700)
    os.chmod(node_dir, 0o700)

    target = node_dir / "enrollment.json"
    data = bundle_path.read_bytes()
    tmp = node_dir / "enrollment.json.tmp"
    tmp.write_bytes(data)
    os.chmod(tmp, 0o600)
    os.replace(tmp, target)
    (node_dir / "registered-at").write_text(utc_now() + "\n", encoding="utf-8")
    (node_dir / "trust-state").write_text("candidate\n", encoding="utf-8")
    print(f"registered_node={node_id}")
    print("trust_state=candidate")
    print("schedulable=false")
    print("public_ready=false")


def list_nodes(registry_dir: Path) -> None:
    rows: list[dict[str, object]] = []
    nodes_dir = registry_dir / "nodes"
    if nodes_dir.exists():
        for node_dir in sorted(p for p in nodes_dir.iterdir() if p.is_dir()):
            bundle_path = node_dir / "enrollment.json"
            if not bundle_path.exists():
                continue
            try:
                descriptor = verify_bundle(bundle_path)
            except SystemExit as exc:
                rows.append({"node_id": node_dir.name, "status": "invalid", "error": str(exc)})
                continue
            rows.append({
                "node_id": descriptor["node_id"],
                "hostname": descriptor["hostname"],
                "architecture": descriptor["architecture"],
                "proof_state": descriptor["proof_state"],
                "trust_state": "candidate",
                "schedulable": False,
                "public_ready": False,
            })
    print(json.dumps(rows, indent=2, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD signed multi-node enrollment")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="create or validate the node ED25519 identity")
    p_init.add_argument("--state-dir", type=Path, default=Path("/var/lib/izakhono-cloud/node"))

    p_export = sub.add_parser("export", help="export a signed candidate enrollment bundle")
    p_export.add_argument("--state-dir", type=Path, default=Path("/var/lib/izakhono-cloud/node"))
    p_export.add_argument("--proof-state-dir", type=Path, default=Path("/var/lib/izakhono-cloud"))
    p_export.add_argument("--output", type=Path, required=True)

    p_verify = sub.add_parser("verify", help="verify a signed enrollment bundle")
    p_verify.add_argument("bundle", type=Path)

    p_register = sub.add_parser("register", help="verify and register a candidate node")
    p_register.add_argument("bundle", type=Path)
    p_register.add_argument("--registry-dir", type=Path, default=Path("/var/lib/izakhono-cloud/registry"))

    p_list = sub.add_parser("list", help="list registered candidate nodes")
    p_list.add_argument("--registry-dir", type=Path, default=Path("/var/lib/izakhono-cloud/registry"))

    args = parser.parse_args()
    if args.command == "init":
        print(f"node_id={init_identity(args.state_dir)}")
    elif args.command == "export":
        init_identity(args.state_dir)
        export_bundle(args.state_dir, args.proof_state_dir, args.output)
    elif args.command == "verify":
        descriptor = verify_bundle(args.bundle)
        print(f"verified_node={descriptor['node_id']}")
        print("public_ready=false")
    elif args.command == "register":
        register_bundle(args.bundle, args.registry_dir)
    elif args.command == "list":
        list_nodes(args.registry_dir)


if __name__ == "__main__":
    main()
