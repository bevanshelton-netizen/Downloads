#!/usr/bin/env python3
"""Activate the first IZAKHONO Sovereign Node identity without overstating readiness.

Real mode requires the existing owner-node READY marker and a working Docker engine.
The optional KORA handoff executes the already-reviewed owner-node workload proof.
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
REAL_IDENTITY = Path("/var/lib/izakhono-cloud/SOVEREIGN-NODE.json")


def run(argv: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(argv, text=True, capture_output=True)
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
    ap.add_argument("--ci-proof", action="store_true", help="CI software-path proof only; never owner-hardware proof")
    ap.add_argument("--ready-marker", help="Override READY marker only with --ci-proof")
    ap.add_argument("--identity-out", help="Override identity receipt output only with --ci-proof")
    args = ap.parse_args()

    if (args.ready_marker or args.identity_out) and not args.ci_proof:
        raise ValueError("--ready-marker and --identity-out overrides are CI-only")

    ready = Path(args.ready_marker).resolve() if args.ci_proof and args.ready_marker else REAL_READY
    identity_out = Path(args.identity_out).resolve() if args.ci_proof and args.identity_out else REAL_IDENTITY

    if not ready.is_file():
        raise RuntimeError(f"READY marker missing: {ready}")

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
        "compatibility_role": "owner_node_candidate",
        "ready_marker_sha256": sha256(ready),
        "docker_server_version": docker_version,
        "machine_proof_context": "ci_software_path" if args.ci_proof else "owner_machine_candidate",
        "workload_proof": "not_run",
        "workload_project": None,
        "workload_cutover_receipt_sha256": None,
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
        run(cmd)
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
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
