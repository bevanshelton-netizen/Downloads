#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.14 live node-control challenge protocol.

A separate verifier issues a short-lived signed challenge. The target node answers
with its own ED25519 identity key. The verifier then signs a receipt proving live
possession of the node key at challenge time.

This does NOT prove physical ownership, physical presence, public reachability,
commercial readiness, or public readiness.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

CHALLENGE_SCHEMA = "izakhono.live-control-challenge.v1"
RESPONSE_SCHEMA = "izakhono.live-control-response.v1"
FINAL_SCHEMA = "izakhono.live-control-verification.v1"
ALGORITHM = "ed25519"
MAX_TTL_MINUTES = 15


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
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(command: list[str]) -> None:
    try:
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        die(f"required command not found: {command[0]}")
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", "replace").strip() if exc.stderr else ""
        die(f"command failed: {' '.join(command)}{': ' + detail if detail else ''}")


def read_json(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read {label}: {exc}")
    if not isinstance(value, dict):
        die(f"{label} must be a JSON object")
    return value


def sign(private_key: Path, data: bytes) -> bytes:
    with tempfile.TemporaryDirectory(prefix="izakhono-v114-sign-") as td:
        data_path = Path(td) / "data"
        sig_path = Path(td) / "signature"
        data_path.write_bytes(data)
        run(["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", str(private_key), "-in", str(data_path), "-out", str(sig_path)])
        return sig_path.read_bytes()


def verify_signature(public_key_text: str, data: bytes, signature: bytes) -> None:
    with tempfile.TemporaryDirectory(prefix="izakhono-v114-verify-") as td:
        pub_path = Path(td) / "public.pem"
        data_path = Path(td) / "data"
        sig_path = Path(td) / "signature"
        pub_path.write_text(public_key_text, encoding="utf-8")
        data_path.write_bytes(data)
        sig_path.write_bytes(signature)
        run(["openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(pub_path), "-in", str(data_path), "-sigfile", str(sig_path)])


def decode_signature(value: object) -> bytes:
    if not isinstance(value, str):
        die("signature is missing")
    try:
        return base64.b64decode(value, validate=True)
    except Exception:
        die("invalid signature encoding")


def parse_time(value: object, label: str) -> datetime:
    if not isinstance(value, str):
        die(f"{label} is missing")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        die(f"invalid {label}")
    if parsed.tzinfo is None:
        die(f"{label} must include timezone")
    return parsed.astimezone(timezone.utc)


def verifier_identity(state: Path) -> tuple[Path, str, str]:
    private_key = state / "private.pem"
    public_key = state / "public.pem"
    verifier_id_file = state / "verifier-id"
    if not (private_key.exists() and public_key.exists() and verifier_id_file.exists()):
        die("complete v1.13 verifier identity is required")
    public_text = public_key.read_text(encoding="utf-8")
    expected = "izv-" + hashlib.sha256(public_text.encode("utf-8")).hexdigest()[:24]
    stored = verifier_id_file.read_text(encoding="utf-8").strip()
    if stored != expected:
        die("verifier id does not match public key")
    return private_key, public_text, stored


def node_identity(state: Path) -> tuple[Path, str, str]:
    identity = state / "identity"
    private_key = identity / "private.pem"
    public_key = identity / "public.pem"
    node_id_file = identity / "node-id"
    if not (private_key.exists() and public_key.exists() and node_id_file.exists()):
        die("complete node identity is required")
    if os.stat(private_key).st_mode & 0o077:
        die("node private key permissions are too broad")
    public_text = public_key.read_text(encoding="utf-8")
    expected = "izn-" + hashlib.sha256(public_text.encode("utf-8")).hexdigest()[:24]
    stored = node_id_file.read_text(encoding="utf-8").strip()
    if stored != expected:
        die("node id does not match public key")
    return private_key, public_text, stored


def verify_external_receipt(receipt: Path, attestation: Path, runtime_proof: Path, verifier_tool: Path) -> dict:
    if not verifier_tool.exists():
        die("v1.13 verifier tool is missing")
    run([
        "python3", str(verifier_tool), "verify", str(receipt),
        "--attestation", str(attestation), "--runtime-proof", str(runtime_proof),
    ])
    payload = read_json(receipt, "external verifier receipt")
    body = payload.get("receipt")
    if not isinstance(body, dict):
        die("external verifier receipt body missing")
    if body.get("verification_level") != "external_cryptographic_verification":
        die("unexpected v1.13 verification level")
    for key in ("hardware_control_independently_witnessed", "independent_hardware_verified", "public_ready", "commercial_ready"):
        if body.get(key) is not False:
            die(f"v1.13 receipt exceeds truth boundary: {key}")
    return payload


def verify_challenge_payload(path: Path, *, require_unexpired: bool = True) -> tuple[dict, str]:
    payload = read_json(path, "challenge")
    if payload.get("schema") != CHALLENGE_SCHEMA or payload.get("algorithm") != ALGORITHM:
        die("unsupported challenge")
    challenge = payload.get("challenge")
    verifier_public_key = payload.get("verifier_public_key")
    if not isinstance(challenge, dict) or not isinstance(verifier_public_key, str):
        die("malformed challenge")
    for key in ("physical_presence_verified", "physical_ownership_verified", "independent_hardware_verified", "public_ready", "commercial_ready"):
        if challenge.get(key) is not False:
            die(f"challenge violates truth boundary: {key}")
    if challenge.get("verification_goal") != "live_node_key_possession":
        die("unsupported challenge goal")
    expected_verifier = "izv-" + hashlib.sha256(verifier_public_key.encode("utf-8")).hexdigest()[:24]
    if challenge.get("verifier_id") != expected_verifier:
        die("challenge verifier id mismatch")
    if not isinstance(challenge.get("node_id"), str) or not challenge["node_id"].startswith("izn-"):
        die("invalid challenge node id")
    issued = parse_time(challenge.get("issued_at"), "issued_at")
    expires = parse_time(challenge.get("expires_at"), "expires_at")
    if expires <= issued or expires - issued > timedelta(minutes=MAX_TTL_MINUTES):
        die("challenge validity window is invalid")
    if require_unexpired and now() >= expires:
        die("challenge has expired")
    signature = decode_signature(payload.get("signature_b64"))
    verify_signature(verifier_public_key, canonical(challenge), signature)
    return challenge, verifier_public_key


def issue_challenge(receipt: Path, attestation: Path, runtime_proof: Path, verifier_tool: Path, verifier_state: Path, output: Path, ttl_minutes: int) -> None:
    if ttl_minutes < 1 or ttl_minutes > MAX_TTL_MINUTES:
        die(f"ttl must be between 1 and {MAX_TTL_MINUTES} minutes")
    external = verify_external_receipt(receipt, attestation, runtime_proof, verifier_tool)
    private_key, verifier_public_key, verifier_id = verifier_identity(verifier_state)
    if external.get("verifier_public_key") != verifier_public_key:
        die("challenge must be issued by the verifier identity that signed the v1.13 receipt")
    body = external["receipt"]
    issued = now()
    nonce = secrets.token_hex(24)
    node_id = body.get("node_id")
    challenge_id = "izc-" + hashlib.sha256(f"{node_id}:{nonce}".encode()).hexdigest()[:24]
    challenge = {
        "schema": CHALLENGE_SCHEMA,
        "challenge_id": challenge_id,
        "nonce": nonce,
        "verifier_id": verifier_id,
        "node_id": node_id,
        "issued_at": iso(issued),
        "expires_at": iso(issued + timedelta(minutes=ttl_minutes)),
        "external_receipt_sha256": sha256_file(receipt),
        "attestation_sha256": sha256_file(attestation),
        "runtime_proof_sha256": sha256_file(runtime_proof),
        "verification_goal": "live_node_key_possession",
        "remote_execution": False,
        "physical_presence_verified": False,
        "physical_ownership_verified": False,
        "independent_hardware_verified": False,
        "public_ready": False,
        "commercial_ready": False,
    }
    signature = sign(private_key, canonical(challenge))
    payload = {
        "schema": CHALLENGE_SCHEMA,
        "algorithm": ALGORITHM,
        "challenge": challenge,
        "verifier_public_key": verifier_public_key,
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"challenge={output}")
    print(f"challenge_id={challenge_id}")
    print("verification_goal=live_node_key_possession")
    print("physical_ownership_verified=false")
    print("public_ready=false")


def respond(challenge_path: Path, node_state: Path, output: Path) -> None:
    challenge, _ = verify_challenge_payload(challenge_path)
    private_key, node_public_key, node_id = node_identity(node_state)
    if challenge.get("node_id") != node_id:
        die("challenge targets a different node")
    response = {
        "schema": RESPONSE_SCHEMA,
        "challenge_id": challenge["challenge_id"],
        "challenge_sha256": sha256_file(challenge_path),
        "node_id": node_id,
        "responded_at": iso(now()),
        "node_key_possession_response": True,
        "physical_presence_verified": False,
        "physical_ownership_verified": False,
        "independent_hardware_verified": False,
        "public_ready": False,
        "commercial_ready": False,
    }
    signature = sign(private_key, canonical(response))
    payload = {
        "schema": RESPONSE_SCHEMA,
        "algorithm": ALGORITHM,
        "response": response,
        "node_public_key": node_public_key,
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(output, 0o600)
    print(f"response={output}")
    print(f"node_id={node_id}")
    print("node_key_possession_response=true")
    print("physical_ownership_verified=false")


def verify_response_payload(response_path: Path, challenge_path: Path) -> tuple[dict, str]:
    challenge, _ = verify_challenge_payload(challenge_path)
    payload = read_json(response_path, "node response")
    if payload.get("schema") != RESPONSE_SCHEMA or payload.get("algorithm") != ALGORITHM:
        die("unsupported node response")
    response = payload.get("response")
    node_public_key = payload.get("node_public_key")
    if not isinstance(response, dict) or not isinstance(node_public_key, str):
        die("malformed node response")
    for key in ("physical_presence_verified", "physical_ownership_verified", "independent_hardware_verified", "public_ready", "commercial_ready"):
        if response.get(key) is not False:
            die(f"node response violates truth boundary: {key}")
    if response.get("node_key_possession_response") is not True:
        die("node did not assert key-possession response")
    expected_node = "izn-" + hashlib.sha256(node_public_key.encode("utf-8")).hexdigest()[:24]
    if response.get("node_id") != expected_node or response.get("node_id") != challenge.get("node_id"):
        die("node response identity mismatch")
    if response.get("challenge_id") != challenge.get("challenge_id"):
        die("challenge id mismatch")
    if response.get("challenge_sha256") != sha256_file(challenge_path):
        die("challenge hash mismatch")
    responded = parse_time(response.get("responded_at"), "responded_at")
    issued = parse_time(challenge.get("issued_at"), "issued_at")
    expires = parse_time(challenge.get("expires_at"), "expires_at")
    if responded < issued or responded >= expires:
        die("response timestamp falls outside challenge window")
    signature = decode_signature(payload.get("signature_b64"))
    verify_signature(node_public_key, canonical(response), signature)
    return response, node_public_key


def finalize(challenge_path: Path, response_path: Path, receipt: Path, attestation: Path, runtime_proof: Path, verifier_tool: Path, verifier_state: Path, output: Path) -> None:
    challenge, challenge_verifier_key = verify_challenge_payload(challenge_path)
    response, node_public_key = verify_response_payload(response_path, challenge_path)
    external = verify_external_receipt(receipt, attestation, runtime_proof, verifier_tool)
    private_key, verifier_public_key, verifier_id = verifier_identity(verifier_state)
    if challenge_verifier_key != verifier_public_key or external.get("verifier_public_key") != verifier_public_key:
        die("verifier identity changed across proof chain")
    receipt_body = external.get("receipt")
    if not isinstance(receipt_body, dict) or receipt_body.get("node_id") != challenge.get("node_id"):
        die("external receipt node does not match challenge")
    if challenge.get("external_receipt_sha256") != sha256_file(receipt):
        die("challenge external receipt binding mismatch")
    if challenge.get("attestation_sha256") != sha256_file(attestation):
        die("challenge attestation binding mismatch")
    if challenge.get("runtime_proof_sha256") != sha256_file(runtime_proof):
        die("challenge runtime proof binding mismatch")

    final = {
        "schema": FINAL_SCHEMA,
        "generated_at": iso(now()),
        "verifier_id": verifier_id,
        "node_id": challenge["node_id"],
        "challenge_id": challenge["challenge_id"],
        "challenge_sha256": sha256_file(challenge_path),
        "response_sha256": sha256_file(response_path),
        "external_receipt_sha256": sha256_file(receipt),
        "attestation_sha256": sha256_file(attestation),
        "runtime_proof_sha256": sha256_file(runtime_proof),
        "node_public_key_sha256": hashlib.sha256(node_public_key.encode("utf-8")).hexdigest(),
        "challenge_signature_valid": True,
        "node_response_signature_valid": True,
        "live_challenge_verified": True,
        "node_key_possession_verified": True,
        "verification_level": "live_node_key_control_verified",
        "physical_presence_independently_witnessed": False,
        "physical_ownership_independently_verified": False,
        "independent_hardware_verified": False,
        "public_ready": False,
        "commercial_ready": False,
        "secrets_included": False,
    }
    signature = sign(private_key, canonical(final))
    payload = {
        "schema": FINAL_SCHEMA,
        "algorithm": ALGORITHM,
        "verification": final,
        "verifier_public_key": verifier_public_key,
        "signature_b64": base64.b64encode(signature).decode("ascii"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"verification_receipt={output}")
    print("verification_level=live_node_key_control_verified")
    print("node_key_possession_verified=true")
    print("physical_ownership_independently_verified=false")
    print("independent_hardware_verified=false")
    print("public_ready=false")


def verify_final(path: Path, challenge_path: Path, response_path: Path, receipt: Path, attestation: Path, runtime_proof: Path) -> None:
    payload = read_json(path, "live control verification receipt")
    if payload.get("schema") != FINAL_SCHEMA or payload.get("algorithm") != ALGORITHM:
        die("unsupported live control verification receipt")
    body = payload.get("verification")
    verifier_public_key = payload.get("verifier_public_key")
    if not isinstance(body, dict) or not isinstance(verifier_public_key, str):
        die("malformed live control verification receipt")
    if body.get("verification_level") != "live_node_key_control_verified":
        die("unexpected final verification level")
    if body.get("live_challenge_verified") is not True or body.get("node_key_possession_verified") is not True:
        die("final receipt lacks live key-control proof")
    for key in ("physical_presence_independently_witnessed", "physical_ownership_independently_verified", "independent_hardware_verified", "public_ready", "commercial_ready", "secrets_included"):
        if body.get(key) is not False:
            die(f"final receipt violates truth boundary: {key}")
    expected_verifier = "izv-" + hashlib.sha256(verifier_public_key.encode("utf-8")).hexdigest()[:24]
    if body.get("verifier_id") != expected_verifier:
        die("final verifier id mismatch")
    expected_hashes = {
        "challenge_sha256": sha256_file(challenge_path),
        "response_sha256": sha256_file(response_path),
        "external_receipt_sha256": sha256_file(receipt),
        "attestation_sha256": sha256_file(attestation),
        "runtime_proof_sha256": sha256_file(runtime_proof),
    }
    for key, expected in expected_hashes.items():
        if body.get(key) != expected:
            die(f"final receipt binding mismatch: {key}")
    signature = decode_signature(payload.get("signature_b64"))
    verify_signature(verifier_public_key, canonical(body), signature)
    print(f"verified_node={body.get('node_id')}")
    print("verification_level=live_node_key_control_verified")
    print("node_key_possession_verified=true")
    print("physical_ownership_independently_verified=false")
    print("public_ready=false")


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD live node-control challenge")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("issue-challenge")
    p.add_argument("--receipt", type=Path, required=True)
    p.add_argument("--attestation", type=Path, required=True)
    p.add_argument("--runtime-proof", type=Path, required=True)
    p.add_argument("--verifier-tool", type=Path, required=True)
    p.add_argument("--verifier-state-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--ttl-minutes", type=int, default=5)

    p = sub.add_parser("respond")
    p.add_argument("challenge", type=Path)
    p.add_argument("--node-state-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)

    p = sub.add_parser("finalize")
    p.add_argument("--challenge", type=Path, required=True)
    p.add_argument("--response", type=Path, required=True)
    p.add_argument("--receipt", type=Path, required=True)
    p.add_argument("--attestation", type=Path, required=True)
    p.add_argument("--runtime-proof", type=Path, required=True)
    p.add_argument("--verifier-tool", type=Path, required=True)
    p.add_argument("--verifier-state-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)

    p = sub.add_parser("verify-final")
    p.add_argument("receipt", type=Path)
    p.add_argument("--challenge", type=Path, required=True)
    p.add_argument("--response", type=Path, required=True)
    p.add_argument("--external-receipt", type=Path, required=True)
    p.add_argument("--attestation", type=Path, required=True)
    p.add_argument("--runtime-proof", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "issue-challenge":
        issue_challenge(args.receipt, args.attestation, args.runtime_proof, args.verifier_tool, args.verifier_state_dir, args.output, args.ttl_minutes)
    elif args.command == "respond":
        respond(args.challenge, args.node_state_dir, args.output)
    elif args.command == "finalize":
        finalize(args.challenge, args.response, args.receipt, args.attestation, args.runtime_proof, args.verifier_tool, args.verifier_state_dir, args.output)
    else:
        verify_final(args.receipt, args.challenge, args.response, args.external_receipt, args.attestation, args.runtime_proof)


if __name__ == "__main__":
    main()
