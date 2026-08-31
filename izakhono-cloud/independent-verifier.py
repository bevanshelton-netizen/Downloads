#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.13 external verification receipt.

This verifies a v1.12 node-signed owner-hardware attestation and its bound runtime
proof, then signs a separate verifier receipt with a distinct verifier key.
It deliberately does NOT claim independent physical-hardware control verification.
"""
from __future__ import annotations

import argparse, base64, hashlib, json, os, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path

RECEIPT_SCHEMA = "izakhono.external-verifier-receipt.v1"
ALGORITHM = "ed25519"


def die(msg: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {msg}")


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical(v: object) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str]) -> None:
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        die(f"required command not found: {cmd[0]}")
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", "replace").strip() if exc.stderr else ""
        die(f"command failed: {' '.join(cmd)}{': ' + detail if detail else ''}")


def verifier_paths(state: Path) -> tuple[Path, Path, Path]:
    return state / "private.pem", state / "public.pem", state / "verifier-id"


def init_verifier(state: Path) -> tuple[Path, Path, str]:
    state.mkdir(parents=True, exist_ok=True)
    os.chmod(state, 0o700)
    priv, pub, vid = verifier_paths(state)
    if not priv.exists():
        run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(priv)])
        os.chmod(priv, 0o600)
        run(["openssl", "pkey", "-in", str(priv), "-pubout", "-out", str(pub)])
    if not pub.exists():
        die("verifier public key missing")
    expected = "izv-" + hashlib.sha256(pub.read_bytes()).hexdigest()[:24]
    if vid.exists() and vid.read_text().strip() != expected:
        die("verifier identity does not match public key")
    vid.write_text(expected + "\n")
    return priv, pub, expected


def verify_owner_attestation(attestation: Path, runtime_proof: Path, tool: Path) -> dict:
    if not tool.exists():
        die("owner attestation verifier tool missing")
    run(["python3", str(tool), "verify", str(attestation), "--runtime-proof", str(runtime_proof)])
    try:
        payload = json.loads(attestation.read_text())
        runtime = json.loads(runtime_proof.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read proof input: {exc}")
    att = payload.get("attestation")
    if not isinstance(att, dict):
        die("attestation body missing")
    if att.get("verification_level") != "self_attested":
        die("unexpected owner attestation verification level")
    if att.get("independent_hardware_verified") is not False:
        die("owner attestation already exceeds v1.12 truth boundary")
    if runtime.get("real_container_runtime_exercised") is not True:
        die("runtime proof lacks real container execution")
    if runtime.get("isolation_flags_verified") is not True or runtime.get("rollback_verified") is not True:
        die("runtime proof lacks isolation or rollback proof")
    if runtime.get("public_ready") is not False or runtime.get("commercial_ready") is not False:
        die("runtime proof violates readiness boundary")
    return payload


def sign(priv: Path, data: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as td:
        d, s = Path(td) / "data", Path(td) / "sig"
        d.write_bytes(data)
        run(["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", str(priv), "-in", str(d), "-out", str(s)])
        return s.read_bytes()


def verify_signature(pub_text: str, data: bytes, sig: bytes) -> None:
    with tempfile.TemporaryDirectory() as td:
        pub, d, s = Path(td) / "pub.pem", Path(td) / "data", Path(td) / "sig"
        pub.write_text(pub_text)
        d.write_bytes(data)
        s.write_bytes(sig)
        run(["openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(pub), "-in", str(d), "-sigfile", str(s)])


def issue(attestation: Path, runtime_proof: Path, owner_tool: Path, verifier_state: Path, output: Path) -> None:
    payload = verify_owner_attestation(attestation, runtime_proof, owner_tool)
    priv, pub, verifier_id = init_verifier(verifier_state)
    owner_pub = payload.get("node_public_key")
    att = payload["attestation"]
    if not isinstance(owner_pub, str):
        die("owner node public key missing")
    if owner_pub.encode() == pub.read_bytes():
        die("verifier identity must be distinct from owner node identity")
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "generated_at": now(),
        "verifier_id": verifier_id,
        "node_id": att.get("node_id"),
        "attestation_sha256": sha256_file(attestation),
        "runtime_proof_sha256": sha256_file(runtime_proof),
        "node_signature_valid": True,
        "runtime_binding_valid": True,
        "verifier_distinct_from_node": True,
        "verification_level": "external_cryptographic_verification",
        "hardware_control_independently_witnessed": False,
        "independent_hardware_verified": False,
        "public_ready": False,
        "commercial_ready": False,
        "secrets_included": False,
    }
    sig = sign(priv, canonical(receipt))
    out = {
        "schema": RECEIPT_SCHEMA,
        "algorithm": ALGORITHM,
        "receipt": receipt,
        "verifier_public_key": pub.read_text(),
        "signature_b64": base64.b64encode(sig).decode("ascii"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    print(f"receipt={output}")
    print("verification_level=external_cryptographic_verification")
    print("independent_hardware_verified=false")
    print("public_ready=false")


def verify_receipt(path: Path, attestation: Path, runtime_proof: Path) -> None:
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read verifier receipt: {exc}")
    if payload.get("schema") != RECEIPT_SCHEMA or payload.get("algorithm") != ALGORITHM:
        die("unsupported verifier receipt")
    receipt = payload.get("receipt")
    pub = payload.get("verifier_public_key")
    sig_b64 = payload.get("signature_b64")
    if not isinstance(receipt, dict) or not isinstance(pub, str) or not isinstance(sig_b64, str):
        die("malformed verifier receipt")
    if receipt.get("verification_level") != "external_cryptographic_verification":
        die("invalid verification level")
    for key in ("hardware_control_independently_witnessed", "independent_hardware_verified", "public_ready", "commercial_ready", "secrets_included"):
        if receipt.get(key) is not False:
            die(f"receipt violates truth boundary: {key}")
    if receipt.get("attestation_sha256") != sha256_file(attestation):
        die("attestation hash mismatch")
    if receipt.get("runtime_proof_sha256") != sha256_file(runtime_proof):
        die("runtime proof hash mismatch")
    expected = "izv-" + hashlib.sha256(pub.encode()).hexdigest()[:24]
    if receipt.get("verifier_id") != expected:
        die("verifier id does not match public key")
    try:
        sig = base64.b64decode(sig_b64, validate=True)
    except Exception:
        die("invalid receipt signature encoding")
    verify_signature(pub, canonical(receipt), sig)
    print(f"verified_node={receipt.get('node_id')}")
    print("verification_level=external_cryptographic_verification")
    print("independent_hardware_verified=false")
    print("public_ready=false")


def main() -> None:
    p = argparse.ArgumentParser(description="IZAKHONO CLOUD external verifier")
    s = p.add_subparsers(dest="cmd", required=True)
    a = s.add_parser("init-verifier")
    a.add_argument("--state-dir", type=Path, required=True)
    a = s.add_parser("issue")
    a.add_argument("--attestation", type=Path, required=True)
    a.add_argument("--runtime-proof", type=Path, required=True)
    a.add_argument("--owner-attestation-tool", type=Path, required=True)
    a.add_argument("--verifier-state-dir", type=Path, required=True)
    a.add_argument("--output", type=Path, required=True)
    a = s.add_parser("verify")
    a.add_argument("receipt", type=Path)
    a.add_argument("--attestation", type=Path, required=True)
    a.add_argument("--runtime-proof", type=Path, required=True)
    args = p.parse_args()
    if args.cmd == "init-verifier":
        _, _, vid = init_verifier(args.state_dir)
        print(f"verifier_id={vid}")
    elif args.cmd == "issue":
        issue(args.attestation, args.runtime_proof, args.owner_attestation_tool, args.verifier_state_dir, args.output)
    else:
        verify_receipt(args.receipt, args.attestation, args.runtime_proof)

if __name__ == "__main__":
    main()
