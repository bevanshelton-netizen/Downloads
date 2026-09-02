#!/usr/bin/env python3
"""Build a secret-free offline KORA owner-node proof bundle.

The bundle contains the exact tracked KORA source from the application checkout, the
minimal reviewed IZAKHONO control plane, a one-command launcher, and a verifier. It is
an execution handoff only: it never marks public_ready or commercial_ready.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import subprocess
import tempfile
import zipfile
from pathlib import Path

BUNDLE_NAME = "kora-owner-node-handoff"
CONTROL_FILES = (
    "deploy-plane.py",
    "alpha-deploy.py",
    "public-ingress.py",
    "owner-console-cutover.py",
)


def run(argv: list[str], *, cwd: Path | None = None, text: bool = True):
    return subprocess.run(
        argv,
        cwd=str(cwd) if cwd else None,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=text,
    )


def git_commit(root: Path) -> str:
    value = run(["git", "-C", str(root), "rev-parse", "HEAD"]).stdout.strip().lower()
    if len(value) != 40 or any(c not in "0123456789abcdef" for c in value):
        raise ValueError(f"invalid Git commit for {root}")
    return value


def tracked_paths(root: Path, prefix: str) -> list[Path]:
    p = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--", prefix],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    values = [item for item in p.stdout.decode("utf-8").split("\0") if item]
    if not values:
        raise ValueError(f"no tracked files found under {prefix}")
    return [Path(item) for item in sorted(values)]


def secretish(path: Path) -> bool:
    name = path.name.lower()
    if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
        return True
    return path.suffix.lower() in {".pem", ".key", ".p12", ".pfx"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_text(path: Path, content: str, executable: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    path.chmod(0o755 if executable else 0o644)


LAUNCHER = r'''#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-}"
EXPECT_CONTEXT="owner_node_candidate"
EXTRA=()
if [[ "$MODE" == "--ci-proof" ]]; then
  EXPECT_CONTEXT="ci_software_path"
  EXTRA+=("--ci-proof")
  shift
fi
if [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--ci-proof]" >&2
  exit 2
fi
if [[ "$EXPECT_CONTEXT" == "owner_node_candidate" && ! -f /var/lib/izakhono-cloud/READY ]]; then
  echo "ERROR: owner-node READY marker missing: /var/lib/izakhono-cloud/READY" >&2
  exit 2
fi
command -v docker >/dev/null || { echo "ERROR: Docker is not installed" >&2; exit 2; }
docker version >/dev/null
python3 "$ROOT/VERIFY-KORA-OWNER-PROOF.py" --bundle "$ROOT/HANDOFF.json" --package-only
APP_COMMIT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["app_source_commit"])' "$ROOT/HANDOFF.json")"
rm -rf "$ROOT/receipts"
mkdir -p "$ROOT/receipts"
python3 "$ROOT/control/izakhono-cloud/owner-console-cutover.py" \
  kora-network/.izakhono.json \
  --repo-root "$ROOT/apps" \
  --control-root "$ROOT/control" \
  --source-commit "$APP_COMMIT" \
  --receipt-dir "$ROOT/receipts" \
  "${EXTRA[@]}"
python3 "$ROOT/VERIFY-KORA-OWNER-PROOF.py" \
  --bundle "$ROOT/HANDOFF.json" \
  --receipts "$ROOT/receipts" \
  --expect-context "$EXPECT_CONTEXT"
echo "KORA OWNER-NODE PROOF: PASS"
echo "Receipts: $ROOT/receipts"
'''

VERIFIER = r'''#!/usr/bin/env python3
import argparse, hashlib, json, sys
from pathlib import Path

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def norm(values): return {str(v).upper().removeprefix("CAP_") for v in values}
def fail(message): raise SystemExit(f"VERIFY FAIL: {message}")

ap=argparse.ArgumentParser()
ap.add_argument("--bundle", required=True)
ap.add_argument("--receipts")
ap.add_argument("--expect-context", choices=("ci_software_path","owner_node_candidate"))
ap.add_argument("--package-only", action="store_true")
args=ap.parse_args()
manifest_path=Path(args.bundle).resolve()
root=manifest_path.parent
bundle=json.loads(manifest_path.read_text(encoding="utf-8"))
if bundle.get("schema") != "izakhono.kora-owner-handoff/v1": fail("unexpected handoff schema")
if bundle.get("project") != "kora-network": fail("unexpected project")
if bundle.get("public_ready") is not False or bundle.get("commercial_ready") is not False: fail("handoff may not claim readiness")
for rel, expected in bundle.get("files_sha256", {}).items():
    candidate=(root/rel).resolve()
    try: candidate.relative_to(root)
    except ValueError: fail(f"file escapes bundle root: {rel}")
    if not candidate.is_file(): fail(f"missing bundled file: {rel}")
    if sha(candidate) != expected: fail(f"hash mismatch: {rel}")
if args.package_only:
    print("KORA HANDOFF PACKAGE: VERIFIED")
    raise SystemExit(0)
if not args.receipts or not args.expect_context: fail("receipts and expected context are required")
receipts=Path(args.receipts).resolve()
cutover_path=receipts/"owner-console-cutover-receipt.json"
deploy_path=receipts/"deployment-receipt.json"
if not cutover_path.is_file() or not deploy_path.is_file(): fail("required receipt missing")
cutover=json.loads(cutover_path.read_text(encoding="utf-8"))
deploy=json.loads(deploy_path.read_text(encoding="utf-8"))
if cutover.get("manifest") != "kora-network/.izakhono.json": fail("wrong manifest in cutover receipt")
if cutover.get("source_commit") != bundle.get("app_source_commit"): fail("application source commit mismatch")
if cutover.get("source_commit_origin") != "explicit_handoff": fail("source commit was not handoff-pinned")
if cutover.get("deployment_receipt_sha256") != sha(deploy_path): fail("deployment receipt hash mismatch")
if cutover.get("deployment_health_passed") is not True: fail("cutover health proof missing")
if cutover.get("execution_context") != args.expect_context: fail("unexpected execution context")
if cutover.get("public_ready") is not False or cutover.get("commercial_ready") is not False: fail("cutover incorrectly claims readiness")
execution=deploy.get("execution") or {}
runtime=execution.get("runtime_isolation") or {}
if execution.get("health_passed") is not True: fail("Docker health probe did not pass")
if execution.get("health_url_scope") != "loopback-only": fail("health proof was not loopback-only")
if runtime.get("readonly_rootfs") is not True: fail("root filesystem was not read-only")
if runtime.get("privileged") is not False: fail("container was privileged")
if "ALL" not in norm(runtime.get("cap_drop") or []): fail("cap-drop ALL missing")
if norm(runtime.get("cap_add") or []) != {"CHOWN","SETUID","SETGID"}: fail("unexpected capability allowlist")
print("KORA OWNER-NODE RECEIPTS: VERIFIED")
'''


def make_zip(source_root: Path, destination: Path):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(p for p in source_root.rglob("*") if p.is_file()):
            rel = path.relative_to(source_root.parent).as_posix()
            info = zipfile.ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0))
            mode = stat.S_IMODE(path.stat().st_mode)
            info.external_attr = (mode & 0xFFFF) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, path.read_bytes())


def main():
    ap = argparse.ArgumentParser(description="Build offline KORA owner-node proof handoff")
    ap.add_argument("--app-root", default=".")
    ap.add_argument("--control-root", default=".")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    app_root = Path(args.app_root).resolve()
    control_root = Path(args.control_root).resolve()
    out = Path(args.out).resolve()
    app_commit = git_commit(app_root)
    control_commit = git_commit(control_root)

    app_files = tracked_paths(app_root, "kora-network")
    blocked = [str(p) for p in app_files if secretish(p)]
    if blocked:
        raise ValueError(f"refusing secret-like tracked files in handoff: {blocked}")

    with tempfile.TemporaryDirectory(prefix="izakhono-kora-handoff-") as temp:
        stage = Path(temp) / BUNDLE_NAME
        for rel in app_files:
            src = (app_root / rel).resolve()
            if not src.is_file() or src.is_symlink():
                raise ValueError(f"unsupported tracked path in KORA handoff: {rel}")
            dest = stage / "apps" / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)

        for name in CONTROL_FILES:
            src = control_root / "izakhono-cloud" / name
            if not src.is_file():
                raise ValueError(f"missing control-plane file: {src}")
            dest = stage / "control" / "izakhono-cloud" / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)

        write_text(stage / "RUN-KORA-OWNER-PROOF.sh", LAUNCHER, executable=True)
        write_text(stage / "VERIFY-KORA-OWNER-PROOF.py", VERIFIER, executable=True)

        hashes = {}
        for path in sorted(p for p in stage.rglob("*") if p.is_file()):
            hashes[path.relative_to(stage).as_posix()] = sha256(path)
        handoff = {
            "schema": "izakhono.kora-owner-handoff/v1",
            "project": "kora-network",
            "manifest": "kora-network/.izakhono.json",
            "app_source_commit": app_commit,
            "control_source_commit": control_commit,
            "ready_marker": "/var/lib/izakhono-cloud/READY",
            "files_sha256": hashes,
            "public_ready": False,
            "commercial_ready": False,
        }
        write_text(stage / "HANDOFF.json", json.dumps(handoff, indent=2, sort_keys=True) + "\n")
        make_zip(stage, out)

    print(out)
    print(f"sha256={sha256(out)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
