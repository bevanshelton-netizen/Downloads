#!/usr/bin/env python3
"""Activate the first IZAKHONO Sovereign Node identity without overstating readiness.

Native owner mode requires /var/lib/izakhono-cloud/READY.
Windows/WSL local-owner mode requires /var/lib/izakhono-cloud/LOCAL_READY.
The optional KORA handoff executes the reviewed local Docker workload proof.
No DNS, TLS, public ingress, payments, or commercial-readiness flags are changed here.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime, timezone

NODE_NAME = "ISN-01"
PLATFORM_NAME = "IZAKHONO SOVEREIGN NODE"
GRID_NAME = "IZAKHONO SOVEREIGN GRID"
OWNER_CONSOLE_NAME = "IZAKHONO OWNER CONSOLE"
REAL_READY = Path("/var/lib/izakhono-cloud/READY")
REAL_LOCAL_READY = Path("/var/lib/izakhono-cloud/LOCAL_READY")
REAL_IDENTITY = Path("/var/lib/izakhono-cloud/SOVEREIGN-NODE.json")


def run(argv: list[str], check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(argv, text=True, capture_output=True, env=env)
    if check and p.returncode:
        raise RuntimeError((p.stderr or p.stdout).strip() or f"command failed: {argv}")
    return p


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main() -> int:
    ap = argparse.ArgumentParser(description="Activate IZAKHONO Sovereign Node ISN-01")
    ap.add_argument("--handoff", help="Path to extracted kora-owner-node-handoff directory")
    ap.add_argument("--local-owner-proof", action="store_true", help="Use genuine LOCAL_READY for a Windows/WSL owner-machine proof")
    ap.add_argument("--ci-proof", action="store_true", help="CI software-path proof only; never owner-hardware proof")
    ap.add_argument("--ready-marker", help="Override activation marker only with --ci-proof")
    ap.add_argument("--identity-out", help="Override identity receipt output only with --ci-proof")
    args = ap.parse_args()

    if args.ci_proof and args.local_owner_proof:
        raise ValueError("--ci-proof and --local-owner-proof are mutually exclusive")
    if (args.ready_marker or args.identity_out) and not args.ci_proof:
        raise ValueError("--ready-marker and --identity-out overrides are CI-only")

    if args.ci_proof:
        ready = Path(args.ready_marker).resolve() if args.ready_marker else REAL_READY
        proof_context = "ci_software_path"
        compatibility_role = "owner_node_candidate"
        marker_kind = "ci_override"
    elif args.local_owner_proof:
        ready = REAL_LOCAL_READY
        proof_context = "owner_machine_local_candidate"
        compatibility_role = "owner_node_local_candidate"
        marker_kind = "LOCAL_READY"
    else:
        ready = REAL_READY
        proof_context = "owner_machine_candidate"
        compatibility_role = "owner_node_candidate"
        marker_kind = "READY"

    identity_out = Path(args.identity_out).resolve() if args.ci_proof and args.identity_out else REAL_IDENTITY

    if not ready.is_file():
        raise RuntimeError(f"{marker_kind} activation marker missing: {ready}")

    docker = run(["docker", "version", "--format", "{{.Server.Version}}"])
    docker_version = docker.stdout.strip()
    if not docker_version:
        raise RuntimeError("Docker server version was empty")

    identity = {
        "schema": "izakhono.sovereign-node/v1",
        "node_name": NODE_NAME,
        "platform_name": PLATFORM_NAME,
        "grid_name": GRID_NAME,
        "owner_console": OWNER_CONSOLE_NAME,
        "compatibility_role": compatibility_role,
        "activation_marker": str(ready),
        "activation_marker_kind": marker_kind,
        "ready_marker_sha256": sha256(ready),
        "docker_server_version": docker_version,
        "machine_proof_context": proof_context,
        "workload_proof": "not_run",
        "workload_project": None,
        "workload_cutover_receipt_sha256": None,
        "public_scope": "local-only" if args.local_owner_proof else "not-promoted",
        "public_ready": False,
        "commercial_ready": False,
        "activated_at_utc": utc_now(),
    }

    if args.handoff:
        handoff = Path(args.handoff).resolve()
        launcher = handoff / "RUN-KORA-OWNER-PROOF.sh"
        receipts = handoff / "receipts"
        if not launcher.is_file():
            raise RuntimeError(f"KORA owner proof launcher missing: {launcher}")
        cmd = ["bash", str(launcher)]
        if args.ci_proof:
            cmd.append("--ci-proof")
        env = os.environ.copy()
        env["IZAKHONO_ACTIVATION_FILE"] = str(ready)
        run(cmd, env=env)
        cutover = receipts / "owner-console-cutover-receipt.json"
        if not cutover.is_file():
            raise RuntimeError("KORA owner proof completed without cutover receipt")
        data = json.loads(cutover.read_text(encoding="utf-8"))
        if data.get("deployment_health_passed") is not True:
            raise RuntimeError("KORA cutover receipt does not prove passing health")
        if data.get("public_ready") is not False or data.get("commercial_ready") is not False:
            raise RuntimeError("KORA cutover receipt overstates readiness")
        identity["workload_proof"] = "verified"
        identity["workload_project"] = "kora-network"
        identity["workload_cutover_receipt_sha256"] = sha256(cutover)

    identity_out.parent.mkdir(parents=True, exist_ok=True)
    temp = identity_out.with_suffix(identity_out.suffix + ".tmp")
    temp.write_text(json.dumps(identity, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(temp, identity_out)

    print(identity_out)
    print(f"{NODE_NAME} ACTIVATION STATE: {identity['workload_proof'].upper()}")
    print(f"proof_context={proof_context}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
