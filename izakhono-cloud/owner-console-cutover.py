#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.17 Owner Console cutover.

The control plane and application checkout may live in separate directories. This lets
one reviewed IZAKHONO control plane deploy the current application source without
copying application code into an infrastructure branch.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


def run(cmd, check=True):
    p = subprocess.run(cmd, text=True, capture_output=True)
    if check and p.returncode:
        raise RuntimeError((p.stderr or p.stdout).strip() or f"command failed: {cmd}")
    return p


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require_inside(root: Path, candidate: Path, label: str) -> Path:
    root = root.resolve()
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"{label} must remain inside application repository") from exc
    return candidate


def source_commit(root: Path):
    p = run(["git", "-C", str(root), "rev-parse", "HEAD"], check=False)
    value = p.stdout.strip() if p.returncode == 0 else ""
    return value if re.fullmatch(r"[0-9a-f]{40}", value) else None


def validated_commit(value: str | None):
    if value is None:
        return None
    value = value.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("--source-commit must be a full 40-character lowercase Git SHA")
    return value


def main():
    ap = argparse.ArgumentParser(description="IZAKHONO CLOUD v1.17 Owner Console cutover")
    ap.add_argument("manifest")
    ap.add_argument("--repo-root", default=".", help="Application repository root")
    ap.add_argument("--control-root", help="IZAKHONO control-plane repository root; defaults to repo-root")
    ap.add_argument("--source-commit", help="Exact application Git SHA for an offline/exported source bundle")
    ap.add_argument("--hostname")
    ap.add_argument("--receipt-dir", default="/tmp/izakhono-receipts")
    ap.add_argument("--ci-proof", action="store_true")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    control = Path(args.control_root).resolve() if args.control_root else root
    manifest = require_inside(root, root / args.manifest, "manifest")
    if not manifest.is_file():
        raise ValueError(f"manifest not found: {manifest}")

    explicit_source_commit = validated_commit(args.source_commit)
    detected_source_commit = source_commit(root)
    if explicit_source_commit and detected_source_commit and explicit_source_commit != detected_source_commit:
        raise ValueError("--source-commit does not match the checked-out application repository")
    recorded_source_commit = explicit_source_commit or detected_source_commit

    deploy_plane = control / "izakhono-cloud/deploy-plane.py"
    alpha_deploy = control / "izakhono-cloud/alpha-deploy.py"
    public_ingress = control / "izakhono-cloud/public-ingress.py"
    for script in (deploy_plane, alpha_deploy):
        if not script.is_file():
            raise ValueError(f"IZAKHONO control-plane script missing: {script}")

    out = Path(args.receipt_dir)
    out.mkdir(parents=True, exist_ok=True)
    plan = out / "deploy-plan.json"
    receipt = out / "deployment-receipt.json"

    run(["python3", str(deploy_plane), str(manifest), "--out", str(plan)])

    # A cutover must actually build and health-probe. CI may bypass the owner READY
    # marker only through alpha-deploy's explicit --ci-proof mode.
    deploy = [
        "python3",
        str(alpha_deploy),
        str(manifest),
        "--repo-root",
        str(root),
        "--out",
        str(receipt),
        "--execute-local",
    ]
    if args.ci_proof:
        deploy.append("--ci-proof")
    run(deploy)

    deployment = json.loads(receipt.read_text(encoding="utf-8"))
    execution = deployment.get("execution")
    if not execution or execution.get("health_passed") is not True:
        raise RuntimeError("deployment receipt does not contain a passing Docker health proof")

    result = {
        "schema": "izakhono.owner-console-cutover/v1",
        "manifest": str(manifest.relative_to(root)),
        "source_commit": recorded_source_commit,
        "source_commit_origin": "explicit_handoff" if explicit_source_commit else ("git_checkout" if detected_source_commit else "unavailable"),
        "control_root_separate": control != root,
        "deploy_plan_sha256": sha(plan),
        "deployment_receipt_sha256": sha(receipt),
        "deployment_health_passed": True,
        "execution_context": execution.get("execution_context"),
        "public_ingress_planned": False,
        "public_ready": False,
        "commercial_ready": False,
    }

    if args.hostname:
        if not public_ingress.is_file():
            raise ValueError(f"IZAKHONO public-ingress script missing: {public_ingress}")
        data = json.loads(manifest.read_text(encoding="utf-8"))
        ingress = out / "public-ingress-plan.json"
        run([
            "python3",
            str(public_ingress),
            "plan",
            "--project",
            data["slug"],
            "--hostname",
            args.hostname,
            "--upstream-port",
            str(data["container_port"]),
            "--health-path",
            data.get("health_path", "/"),
            "--deployment-receipt-sha256",
            result["deployment_receipt_sha256"],
            "--out",
            str(ingress),
        ])
        result["public_ingress_planned"] = True
        result["public_ingress_plan_sha256"] = sha(ingress)

    canon = json.dumps(result, sort_keys=True, separators=(",", ":")).encode()
    result["cutover_receipt_sha256"] = hashlib.sha256(canon).hexdigest()
    final = out / "owner-console-cutover-receipt.json"
    final.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(final)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
