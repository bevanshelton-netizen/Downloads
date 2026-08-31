#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.7 authenticated control-channel foundation.

This module proves controller -> node authenticity and node -> controller
acknowledgement without enabling remote shell execution, workload scheduling,
failover, or public-ready promotion.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone

COMMAND_SCHEMA = "izakhono.control-command.v1"
ACK_SCHEMA = "izakhono.control-ack.v1"
ALGORITHM = "ed25519"
ALLOWED_ACTIONS = {"status", "inventory", "health"}


def die(message: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {message}")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_time(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        die(f"{field} must be an ISO-8601 string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        die(f"invalid {field}")
    if parsed.tzinfo is None:
        die(f"{field} must include timezone")
    return parsed.astimezone(timezone.utc)


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
    return identity / "private.pem", identity / "public.pem", identity / "id"


def fingerprint(public_pem: bytes) -> str:
    return hashlib.sha256(public_pem).hexdigest()


def expected_id(prefix: str, public_pem: bytes) -> str:
    return prefix + fingerprint(public_pem)[:24]


def init_identity(state_dir: Path, prefix: str) -> str:
    ensure_openssl()
    private_key, public_key, id_file = identity_paths(state_dir)
    private_key.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(private_key.parent, 0o700)

    if private_key.exists() or public_key.exists() or id_file.exists():
        if not (private_key.exists() and public_key.exists() and id_file.exists()):
            die("partial identity exists; refuse to overwrite")
        public_pem = public_key.read_bytes()
        expected = expected_id(prefix, public_pem)
        stored = id_file.read_text(encoding="utf-8").strip()
        if stored != expected:
            die("stored identity does not match public key")
        return stored

    run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(private_key)])
    os.chmod(private_key, 0o600)
    run(["openssl", "pkey", "-in", str(private_key), "-pubout", "-out", str(public_key)])
    os.chmod(public_key, 0o644)
    public_pem = public_key.read_bytes()
    identity_id = expected_id(prefix, public_pem)
    id_file.write_text(identity_id + "\n", encoding="utf-8")
    os.chmod(id_file, 0o644)
    return identity_id


def sign(private_key: Path, payload: bytes) -> bytes:
    ensure_openssl()
    with tempfile.TemporaryDirectory(prefix="izakhono-control-sign-") as tmp:
        data = Path(tmp) / "payload"
        sig = Path(tmp) / "signature"
        data.write_bytes(payload)
        run(["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", str(private_key), "-in", str(data), "-out", str(sig)])
        return sig.read_bytes()


def verify(public_pem: bytes, payload: bytes, signature: bytes) -> None:
    ensure_openssl()
    with tempfile.TemporaryDirectory(prefix="izakhono-control-verify-") as tmp:
        pub = Path(tmp) / "public.pem"
        data = Path(tmp) / "payload"
        sig = Path(tmp) / "signature"
        pub.write_bytes(public_pem)
        data.write_bytes(payload)
        sig.write_bytes(signature)
        run(["openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(pub), "-in", str(data), "-sigfile", str(sig)])


def decode_signature(value: object) -> bytes:
    if not isinstance(value, str):
        die("signature must be base64 text")
    try:
        return base64.b64decode(value, validate=True)
    except Exception:
        die("invalid base64 signature")


def load_json(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read {path}: {exc}")
    if not isinstance(value, dict):
        die("signed envelope must be a JSON object")
    return value


def atomic_json(path: Path, value: dict[str, object], mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(tmp, mode)
    os.replace(tmp, path)


def make_command(controller_state: Path, target_node_id: str, action: str, ttl_seconds: int, output: Path) -> None:
    if action not in ALLOWED_ACTIONS:
        die("v1.7 permits only status, inventory, and health actions")
    if ttl_seconds < 1 or ttl_seconds > 900:
        die("command TTL must be between 1 and 900 seconds")
    controller_id = init_identity(controller_state, "izc-")
    private_key, public_key, _ = identity_paths(controller_state)
    issued = now_utc()
    payload: dict[str, object] = {
        "schema": COMMAND_SCHEMA,
        "command_id": "cmd-" + secrets.token_hex(16),
        "controller_id": controller_id,
        "target_node_id": target_node_id,
        "action": action,
        "issued_at": iso(issued),
        "expires_at": iso(issued + timedelta(seconds=ttl_seconds)),
        "nonce": secrets.token_hex(16),
        "remote_execution": False,
        "schedulable": False,
        "public_ready": False,
    }
    signature = sign(private_key, canonical(payload))
    envelope: dict[str, object] = {
        "schema": COMMAND_SCHEMA,
        "signature_algorithm": ALGORITHM,
        "payload": payload,
        "controller_public_key_pem": public_key.read_text(encoding="utf-8"),
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    atomic_json(output, envelope)
    print(f"command_id={payload['command_id']}")
    print(f"controller_id={controller_id}")
    print(f"target_node_id={target_node_id}")
    print("remote_execution=false")


def validate_command(envelope: dict[str, object], trusted_controller_pub: bytes, expected_node_id: str, *, enforce_time: bool = True) -> dict[str, object]:
    if envelope.get("schema") != COMMAND_SCHEMA or envelope.get("signature_algorithm") != ALGORITHM:
        die("unsupported control command schema or signature algorithm")
    payload = envelope.get("payload")
    embedded_pub = envelope.get("controller_public_key_pem")
    if not isinstance(payload, dict) or not isinstance(embedded_pub, str):
        die("malformed command envelope")
    if payload.get("schema") != COMMAND_SCHEMA:
        die("command payload schema mismatch")
    if payload.get("target_node_id") != expected_node_id:
        die("command target does not match this node")
    if payload.get("action") not in ALLOWED_ACTIONS:
        die("command action is not allowed in v1.7")
    if payload.get("remote_execution") is not False or payload.get("schedulable") is not False or payload.get("public_ready") is not False:
        die("v1.7 command attempted to cross the safety boundary")
    if embedded_pub.encode("utf-8") != trusted_controller_pub:
        die("controller public key does not match the node's pinned trust key")
    expected_controller_id = expected_id("izc-", trusted_controller_pub)
    if payload.get("controller_id") != expected_controller_id:
        die("controller id does not match pinned key")
    issued = parse_time(payload.get("issued_at"), "issued_at")
    expires = parse_time(payload.get("expires_at"), "expires_at")
    if expires <= issued:
        die("command expiry must be later than issue time")
    if (expires - issued).total_seconds() > 900:
        die("command validity window exceeds 900 seconds")
    if enforce_time:
        current = now_utc()
        if issued > current + timedelta(seconds=60):
            die("command issue time is too far in the future")
        if expires < current:
            die("command has expired")
    signature = decode_signature(envelope.get("signature_b64"))
    verify(trusted_controller_pub, canonical(payload), signature)
    return payload


def claim_once(seen_dir: Path, command_id: object) -> None:
    if not isinstance(command_id, str) or not command_id.startswith("cmd-"):
        die("invalid command id")
    seen_dir.mkdir(parents=True, exist_ok=True)
    os.chmod(seen_dir, 0o700)
    marker = seen_dir / command_id
    try:
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        die("command replay detected")
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(iso(now_utc()) + "\n")


def make_ack(node_state: Path, command_path: Path, trusted_controller_key: Path, seen_dir: Path, output: Path) -> None:
    node_private, node_public, node_id_file = identity_paths(node_state)
    if not (node_private.exists() and node_public.exists() and node_id_file.exists()):
        die("node identity is missing; initialize/enroll the node first")
    node_id = node_id_file.read_text(encoding="utf-8").strip()
    node_public_pem = node_public.read_bytes()
    # v1.6 node IDs use the same SHA-256 fingerprint rule and izn- prefix.
    if node_id != expected_id("izn-", node_public_pem):
        die("node identity fingerprint mismatch")
    trusted_controller_pub = trusted_controller_key.read_bytes()
    envelope = load_json(command_path)
    payload = validate_command(envelope, trusted_controller_pub, node_id)
    claim_once(seen_dir, payload.get("command_id"))

    ack_payload: dict[str, object] = {
        "schema": ACK_SCHEMA,
        "command_id": payload["command_id"],
        "controller_id": payload["controller_id"],
        "node_id": node_id,
        "action": payload["action"],
        "accepted_at": iso(now_utc()),
        "status": "verified_not_executed",
        "remote_execution": False,
        "schedulable": False,
        "public_ready": False,
    }
    signature = sign(node_private, canonical(ack_payload))
    ack: dict[str, object] = {
        "schema": ACK_SCHEMA,
        "signature_algorithm": ALGORITHM,
        "payload": ack_payload,
        "node_public_key_pem": node_public.read_text(encoding="utf-8"),
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    atomic_json(output, ack)
    print(f"ack_command_id={payload['command_id']}")
    print(f"node_id={node_id}")
    print("status=verified_not_executed")


def verify_ack(ack_path: Path, expected_node_pub_path: Path, expected_command_id: str) -> dict[str, object]:
    ack = load_json(ack_path)
    if ack.get("schema") != ACK_SCHEMA or ack.get("signature_algorithm") != ALGORITHM:
        die("unsupported acknowledgement schema or signature algorithm")
    payload = ack.get("payload")
    embedded_pub = ack.get("node_public_key_pem")
    if not isinstance(payload, dict) or not isinstance(embedded_pub, str):
        die("malformed acknowledgement")
    expected_pub = expected_node_pub_path.read_bytes()
    if embedded_pub.encode("utf-8") != expected_pub:
        die("acknowledgement node key mismatch")
    if payload.get("node_id") != expected_id("izn-", expected_pub):
        die("acknowledgement node id mismatch")
    if payload.get("command_id") != expected_command_id:
        die("acknowledgement command id mismatch")
    if payload.get("status") != "verified_not_executed":
        die("v1.7 acknowledgement cannot claim command execution")
    if payload.get("remote_execution") is not False or payload.get("schedulable") is not False or payload.get("public_ready") is not False:
        die("acknowledgement crossed the v1.7 safety boundary")
    signature = decode_signature(ack.get("signature_b64"))
    verify(expected_pub, canonical(payload), signature)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD v1.7 authenticated control channel")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("controller-init")
    p_init.add_argument("--state-dir", type=Path, required=True)

    p_create = sub.add_parser("command-create")
    p_create.add_argument("--controller-state-dir", type=Path, required=True)
    p_create.add_argument("--target-node-id", required=True)
    p_create.add_argument("--action", choices=sorted(ALLOWED_ACTIONS), required=True)
    p_create.add_argument("--ttl-seconds", type=int, default=300)
    p_create.add_argument("--output", type=Path, required=True)

    p_verify = sub.add_parser("command-verify")
    p_verify.add_argument("command_file", type=Path)
    p_verify.add_argument("--trusted-controller-key", type=Path, required=True)
    p_verify.add_argument("--expected-node-id", required=True)

    p_ack = sub.add_parser("node-ack")
    p_ack.add_argument("command_file", type=Path)
    p_ack.add_argument("--node-state-dir", type=Path, required=True)
    p_ack.add_argument("--trusted-controller-key", type=Path, required=True)
    p_ack.add_argument("--seen-dir", type=Path, required=True)
    p_ack.add_argument("--output", type=Path, required=True)

    p_ack_verify = sub.add_parser("ack-verify")
    p_ack_verify.add_argument("ack_file", type=Path)
    p_ack_verify.add_argument("--node-public-key", type=Path, required=True)
    p_ack_verify.add_argument("--expected-command-id", required=True)

    args = parser.parse_args()
    if args.command == "controller-init":
        controller_id = init_identity(args.state_dir, "izc-")
        print(f"controller_id={controller_id}")
        print(f"public_key={identity_paths(args.state_dir)[1]}")
    elif args.command == "command-create":
        make_command(args.controller_state_dir, args.target_node_id, args.action, args.ttl_seconds, args.output)
    elif args.command == "command-verify":
        payload = validate_command(load_json(args.command_file), args.trusted_controller_key.read_bytes(), args.expected_node_id)
        print(f"verified_command={payload['command_id']}")
        print("remote_execution=false")
    elif args.command == "node-ack":
        make_ack(args.node_state_dir, args.command_file, args.trusted_controller_key, args.seen_dir, args.output)
    elif args.command == "ack-verify":
        payload = verify_ack(args.ack_file, args.node_public_key, args.expected_command_id)
        print(f"verified_ack={payload['command_id']}")
        print("status=verified_not_executed")


if __name__ == "__main__":
    main()
