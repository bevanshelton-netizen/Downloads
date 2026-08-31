#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.7 authenticated control envelopes.

Authenticates controller commands and node acknowledgements. It deliberately
executes no remote command and does not enable scheduling or public readiness.
"""

from __future__ import annotations

import argparse
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import tempfile

import multinode

COMMAND_SCHEMA = "izakhono.control-command.v1"
ACK_SCHEMA = "izakhono.control-ack.v1"
ALGORITHM = "ed25519"
ALLOWED_ACTIONS = {"status", "inventory", "health"}


def die(message: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {message}")


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_time(value: object, name: str) -> datetime:
    if not isinstance(value, str):
        die(f"{name} must be ISO-8601 text")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        die(f"invalid {name}")
    if parsed.tzinfo is None:
        die(f"{name} requires a timezone")
    return parsed.astimezone(timezone.utc)


def controller_paths(state_dir: Path) -> tuple[Path, Path, Path]:
    identity = state_dir / "identity"
    return identity / "private.pem", identity / "public.pem", identity / "controller-id"


def key_fingerprint(public_pem: bytes) -> str:
    return hashlib.sha256(public_pem).hexdigest()


def controller_id(public_pem: bytes) -> str:
    return "izc-" + key_fingerprint(public_pem)[:24]


def controller_init(state_dir: Path) -> str:
    multinode.ensure_openssl()
    private_key, public_key, id_file = controller_paths(state_dir)
    private_key.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(private_key.parent, 0o700)
    if private_key.exists() or public_key.exists() or id_file.exists():
        if not (private_key.exists() and public_key.exists() and id_file.exists()):
            die("partial controller identity exists; refuse to overwrite")
        derived = controller_id(public_key.read_bytes())
        if id_file.read_text(encoding="utf-8").strip() != derived:
            die("controller id does not match public key")
        return derived
    multinode.run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(private_key)])
    os.chmod(private_key, 0o600)
    multinode.run(["openssl", "pkey", "-in", str(private_key), "-pubout", "-out", str(public_key)])
    os.chmod(public_key, 0o644)
    value = controller_id(public_key.read_bytes())
    id_file.write_text(value + "\n", encoding="utf-8")
    os.chmod(id_file, 0o644)
    return value


def sign(private_key: Path, payload: bytes) -> bytes:
    return multinode.sign_descriptor(private_key, payload)


def verify(public_pem: bytes, payload: bytes, signature: bytes) -> None:
    multinode.ensure_openssl()
    with tempfile.TemporaryDirectory(prefix="izakhono-control-verify-") as tmp:
        pub = Path(tmp) / "public.pem"
        data = Path(tmp) / "payload.json"
        sig = Path(tmp) / "payload.sig"
        pub.write_bytes(public_pem)
        data.write_bytes(payload)
        sig.write_bytes(signature)
        multinode.run([
            "openssl", "pkeyutl", "-verify", "-rawin", "-pubin",
            "-inkey", str(pub), "-in", str(data), "-sigfile", str(sig),
        ])


def decode_signature(value: object) -> bytes:
    if not isinstance(value, str):
        die("signature must be base64 text")
    try:
        return base64.b64decode(value, validate=True)
    except Exception:
        die("invalid base64 signature")


def load_object(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read {path}: {exc}")
    if not isinstance(value, dict):
        die("signed envelope must be a JSON object")
    return value


def write_object(path: Path, value: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def make_command(state_dir: Path, node_id: str, action: str, ttl: int, output: Path) -> str:
    if action not in ALLOWED_ACTIONS:
        die("v1.7 allows only status, inventory and health")
    if ttl < 1 or ttl > 900:
        die("TTL must be 1..900 seconds")
    cid = controller_init(state_dir)
    private_key, public_key, _ = controller_paths(state_dir)
    issued = utcnow()
    command_id = "cmd-" + secrets.token_hex(16)
    payload: dict[str, object] = {
        "schema": COMMAND_SCHEMA,
        "command_id": command_id,
        "controller_id": cid,
        "target_node_id": node_id,
        "action": action,
        "issued_at": iso(issued),
        "expires_at": iso(issued + timedelta(seconds=ttl)),
        "nonce": secrets.token_hex(16),
        "remote_execution": False,
        "schedulable": False,
        "public_ready": False,
    }
    envelope: dict[str, object] = {
        "schema": COMMAND_SCHEMA,
        "signature_algorithm": ALGORITHM,
        "payload": payload,
        "controller_public_key_pem": public_key.read_text(encoding="utf-8"),
        "signature_b64": base64.b64encode(sign(private_key, canonical(payload))).decode("ascii"),
    }
    write_object(output, envelope)
    return command_id


def validate_command(envelope: dict[str, object], pinned_controller_pub: bytes, expected_node_id: str) -> dict[str, object]:
    if envelope.get("schema") != COMMAND_SCHEMA or envelope.get("signature_algorithm") != ALGORITHM:
        die("unsupported command envelope")
    payload = envelope.get("payload")
    embedded_pub = envelope.get("controller_public_key_pem")
    if not isinstance(payload, dict) or not isinstance(embedded_pub, str):
        die("malformed command envelope")
    if payload.get("schema") != COMMAND_SCHEMA:
        die("command schema mismatch")
    if embedded_pub.encode("utf-8") != pinned_controller_pub:
        die("controller key is not the node's pinned controller")
    if payload.get("controller_id") != controller_id(pinned_controller_pub):
        die("controller id mismatch")
    if payload.get("target_node_id") != expected_node_id:
        die("command target mismatch")
    if payload.get("action") not in ALLOWED_ACTIONS:
        die("command action is not allowed")
    if payload.get("remote_execution") is not False or payload.get("schedulable") is not False or payload.get("public_ready") is not False:
        die("command crossed the v1.7 safety boundary")
    issued = parse_time(payload.get("issued_at"), "issued_at")
    expires = parse_time(payload.get("expires_at"), "expires_at")
    if expires <= issued or (expires - issued).total_seconds() > 900:
        die("invalid command validity window")
    current = utcnow()
    if issued > current + timedelta(seconds=60):
        die("command is issued too far in the future")
    if expires < current:
        die("command has expired")
    verify(pinned_controller_pub, canonical(payload), decode_signature(envelope.get("signature_b64")))
    return payload


def claim_command(seen_dir: Path, command_id: object) -> None:
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
        handle.write(iso(utcnow()) + "\n")


def make_ack(node_state: Path, command_file: Path, pinned_controller_key: Path, seen_dir: Path, output: Path) -> str:
    node_private, node_public, node_id_file = multinode.identity_paths(node_state)
    if not (node_private.exists() and node_public.exists() and node_id_file.exists()):
        die("v1.6 node identity is missing")
    node_public_pem = node_public.read_bytes()
    node_id = node_id_file.read_text(encoding="utf-8").strip()
    if node_id != multinode.expected_node_id(node_public_pem):
        die("node identity fingerprint mismatch")
    payload = validate_command(load_object(command_file), pinned_controller_key.read_bytes(), node_id)
    claim_command(seen_dir, payload.get("command_id"))
    ack_payload: dict[str, object] = {
        "schema": ACK_SCHEMA,
        "command_id": payload["command_id"],
        "controller_id": payload["controller_id"],
        "node_id": node_id,
        "action": payload["action"],
        "accepted_at": iso(utcnow()),
        "status": "verified_not_executed",
        "remote_execution": False,
        "schedulable": False,
        "public_ready": False,
    }
    ack: dict[str, object] = {
        "schema": ACK_SCHEMA,
        "signature_algorithm": ALGORITHM,
        "payload": ack_payload,
        "node_public_key_pem": node_public.read_text(encoding="utf-8"),
        "signature_b64": base64.b64encode(sign(node_private, canonical(ack_payload))).decode("ascii"),
    }
    write_object(output, ack)
    return str(payload["command_id"])


def validate_ack(ack: dict[str, object], expected_node_pub: bytes, expected_command_id: str) -> dict[str, object]:
    if ack.get("schema") != ACK_SCHEMA or ack.get("signature_algorithm") != ALGORITHM:
        die("unsupported acknowledgement")
    payload = ack.get("payload")
    embedded_pub = ack.get("node_public_key_pem")
    if not isinstance(payload, dict) or not isinstance(embedded_pub, str):
        die("malformed acknowledgement")
    if embedded_pub.encode("utf-8") != expected_node_pub:
        die("acknowledgement node key mismatch")
    if payload.get("node_id") != multinode.expected_node_id(expected_node_pub):
        die("acknowledgement node id mismatch")
    if payload.get("command_id") != expected_command_id:
        die("acknowledgement command id mismatch")
    if payload.get("status") != "verified_not_executed":
        die("v1.7 acknowledgement cannot claim execution")
    if payload.get("remote_execution") is not False or payload.get("schedulable") is not False or payload.get("public_ready") is not False:
        die("acknowledgement crossed the v1.7 safety boundary")
    verify(expected_node_pub, canonical(payload), decode_signature(ack.get("signature_b64")))
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD v1.7 authenticated control channel")
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("controller-init")
    init.add_argument("--state-dir", type=Path, required=True)

    create = sub.add_parser("command-create")
    create.add_argument("--controller-state-dir", type=Path, required=True)
    create.add_argument("--target-node-id", required=True)
    create.add_argument("--action", choices=sorted(ALLOWED_ACTIONS), required=True)
    create.add_argument("--ttl-seconds", type=int, default=300)
    create.add_argument("--output", type=Path, required=True)

    verify_cmd = sub.add_parser("command-verify")
    verify_cmd.add_argument("command_file", type=Path)
    verify_cmd.add_argument("--trusted-controller-key", type=Path, required=True)
    verify_cmd.add_argument("--expected-node-id", required=True)

    ack = sub.add_parser("node-ack")
    ack.add_argument("command_file", type=Path)
    ack.add_argument("--node-state-dir", type=Path, required=True)
    ack.add_argument("--trusted-controller-key", type=Path, required=True)
    ack.add_argument("--seen-dir", type=Path, required=True)
    ack.add_argument("--output", type=Path, required=True)

    verify_ack = sub.add_parser("ack-verify")
    verify_ack.add_argument("ack_file", type=Path)
    verify_ack.add_argument("--node-public-key", type=Path, required=True)
    verify_ack.add_argument("--expected-command-id", required=True)

    args = parser.parse_args()
    if args.command == "controller-init":
        value = controller_init(args.state_dir)
        print(f"controller_id={value}")
        print(f"public_key={controller_paths(args.state_dir)[1]}")
    elif args.command == "command-create":
        command_id = make_command(args.controller_state_dir, args.target_node_id, args.action, args.ttl_seconds, args.output)
        print(f"command_id={command_id}")
        print("remote_execution=false")
    elif args.command == "command-verify":
        payload = validate_command(load_object(args.command_file), args.trusted_controller_key.read_bytes(), args.expected_node_id)
        print(f"verified_command={payload['command_id']}")
        print("remote_execution=false")
    elif args.command == "node-ack":
        command_id = make_ack(args.node_state_dir, args.command_file, args.trusted_controller_key, args.seen_dir, args.output)
        print(f"ack_command_id={command_id}")
        print("status=verified_not_executed")
    elif args.command == "ack-verify":
        payload = validate_ack(load_object(args.ack_file), args.node_public_key.read_bytes(), args.expected_command_id)
        print(f"verified_ack={payload['command_id']}")
        print("status=verified_not_executed")


if __name__ == "__main__":
    main()
