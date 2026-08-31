#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.9 signed workload lifecycle rehearsal.

This module signs, verifies, stages, rehearses and rolls back workload plans.
It deliberately does NOT start containers, processes, VMs or remote commands.
"""
from __future__ import annotations

import argparse, base64, hashlib, json, os, re, shutil, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "izakhono.workload.v1"
ALGORITHM = "ed25519"
IMAGE_RE = re.compile(r"^[A-Za-z0-9._/:~-]+@sha256:[0-9a-f]{64}$")


def die(msg: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {msg}")


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical(v: object) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":")).encode()


def run(cmd: list[str]) -> None:
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        die(f"crypto command failed: {exc}")


def controller_paths(state: Path) -> tuple[Path, Path]:
    return state / "private.pem", state / "public.pem"


def init_controller(state: Path) -> None:
    if shutil.which("openssl") is None:
        die("openssl is required")
    state.mkdir(parents=True, exist_ok=True)
    os.chmod(state, 0o700)
    priv, pub = controller_paths(state)
    if not priv.exists():
        run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(priv)])
        os.chmod(priv, 0o600)
        run(["openssl", "pkey", "-in", str(priv), "-pubout", "-out", str(pub)])
    if not pub.exists():
        die("controller public key missing")


def validate_spec(spec: dict) -> None:
    required = {"workload_id", "target_node_id", "image", "cpu_millis", "memory_mb", "disk_mb"}
    if not required.issubset(spec):
        die("workload spec missing required fields")
    if not isinstance(spec["workload_id"], str) or not spec["workload_id"]:
        die("invalid workload_id")
    if not isinstance(spec["target_node_id"], str) or not spec["target_node_id"].startswith("izn-"):
        die("invalid target_node_id")
    if not isinstance(spec["image"], str) or not IMAGE_RE.match(spec["image"]):
        die("image must be pinned by sha256 digest")
    for key in ("cpu_millis", "memory_mb", "disk_mb"):
        if not isinstance(spec[key], int) or spec[key] <= 0:
            die(f"invalid {key}")
    if spec.get("privileged", False):
        die("privileged workloads are forbidden")
    if spec.get("host_network", False):
        die("host networking is forbidden")
    if spec.get("host_mounts"):
        die("host mounts are forbidden")
    if spec.get("rootfs_read_only", True) is not True:
        die("root filesystem must be read-only")
    ports = spec.get("ports", [])
    if not isinstance(ports, list) or any(not isinstance(p, int) or p < 1024 or p > 65535 for p in ports):
        die("ports must be unprivileged TCP/UDP port numbers")


def sign(state: Path, spec_path: Path, output: Path) -> None:
    init_controller(state)
    spec = json.loads(spec_path.read_text())
    if not isinstance(spec, dict):
        die("workload spec must be an object")
    validate_spec(spec)
    manifest = {
        "schema": SCHEMA,
        "issued_at": now(),
        "execution_allowed": False,
        "remote_execution": False,
        "automatic_failover": False,
        "public_ready": False,
        "spec": spec,
    }
    priv, pub = controller_paths(state)
    with tempfile.TemporaryDirectory() as td:
        data, sig = Path(td)/"m.json", Path(td)/"m.sig"
        data.write_bytes(canonical(manifest))
        run(["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", str(priv), "-in", str(data), "-out", str(sig)])
        bundle = {
            "schema": SCHEMA,
            "algorithm": ALGORITHM,
            "manifest": manifest,
            "controller_public_key": pub.read_text(),
            "signature_b64": base64.b64encode(sig.read_bytes()).decode(),
        }
    output.write_text(json.dumps(bundle, indent=2, sort_keys=True) + "\n")
    print(f"signed_workload={spec['workload_id']}")
    print("execution_allowed=false")


def verify(bundle_path: Path) -> dict:
    bundle = json.loads(bundle_path.read_text())
    if bundle.get("schema") != SCHEMA or bundle.get("algorithm") != ALGORITHM:
        die("unsupported workload bundle")
    manifest = bundle.get("manifest")
    pub = bundle.get("controller_public_key")
    sig_b64 = bundle.get("signature_b64")
    if not isinstance(manifest, dict) or not isinstance(pub, str) or not isinstance(sig_b64, str):
        die("malformed workload bundle")
    if manifest.get("execution_allowed") is not False or manifest.get("remote_execution") is not False or manifest.get("automatic_failover") is not False or manifest.get("public_ready") is not False:
        die("v1.9 workload bundle violates truth boundary")
    spec = manifest.get("spec")
    if not isinstance(spec, dict):
        die("manifest spec missing")
    validate_spec(spec)
    try:
        sig = base64.b64decode(sig_b64, validate=True)
    except Exception:
        die("invalid signature encoding")
    with tempfile.TemporaryDirectory() as td:
        ppub, data, psig = Path(td)/"pub.pem", Path(td)/"m.json", Path(td)/"m.sig"
        ppub.write_text(pub); data.write_bytes(canonical(manifest)); psig.write_bytes(sig)
        try:
            subprocess.run(["openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(ppub), "-in", str(data), "-sigfile", str(psig)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError:
            die("workload signature verification failed")
    return manifest


def stage(bundle: Path, node_id: str, proof_dir: Path, lifecycle_dir: Path) -> Path:
    manifest = verify(bundle)
    spec = manifest["spec"]
    if spec["target_node_id"] != node_id:
        die("workload target does not match this node")
    if not ((proof_dir/"READY").exists() or (proof_dir/"LOCAL_READY").exists()):
        die("node has no READY or LOCAL_READY proof marker")
    plan_id = hashlib.sha256(canonical(manifest)).hexdigest()[:24]
    target = lifecycle_dir / plan_id
    target.mkdir(parents=True, exist_ok=False)
    (target/"bundle.json").write_bytes(bundle.read_bytes())
    (target/"state.json").write_text(json.dumps({"plan_id":plan_id,"state":"staged_not_executed","execution_allowed":False,"updated_at":now()}, indent=2)+"\n")
    print(f"plan_id={plan_id}")
    print("state=staged_not_executed")
    return target


def rehearse(plan_dir: Path) -> None:
    state_path = plan_dir / "state.json"
    state = json.loads(state_path.read_text())
    if state.get("state") != "staged_not_executed":
        die("plan is not staged")
    state.update({"state":"rehearsed_not_executed","execution_allowed":False,"updated_at":now()})
    state_path.write_text(json.dumps(state, indent=2)+"\n")
    print("state=rehearsed_not_executed")


def rollback(plan_dir: Path) -> None:
    state_path = plan_dir / "state.json"
    state = json.loads(state_path.read_text())
    if state.get("state") not in {"staged_not_executed","rehearsed_not_executed"}:
        die("plan cannot be rolled back from current state")
    state.update({"state":"rolled_back","execution_allowed":False,"updated_at":now()})
    state_path.write_text(json.dumps(state, indent=2)+"\n")
    print("state=rolled_back")


def main() -> None:
    p = argparse.ArgumentParser()
    s = p.add_subparsers(dest="cmd", required=True)
    a=s.add_parser("init-controller"); a.add_argument("--state-dir", type=Path, required=True)
    a=s.add_parser("sign"); a.add_argument("--state-dir",type=Path,required=True); a.add_argument("--spec",type=Path,required=True); a.add_argument("--output",type=Path,required=True)
    a=s.add_parser("verify"); a.add_argument("bundle",type=Path)
    a=s.add_parser("stage"); a.add_argument("bundle",type=Path); a.add_argument("--node-id",required=True); a.add_argument("--proof-dir",type=Path,required=True); a.add_argument("--lifecycle-dir",type=Path,required=True)
    a=s.add_parser("rehearse"); a.add_argument("plan_dir",type=Path)
    a=s.add_parser("rollback"); a.add_argument("plan_dir",type=Path)
    a=s.add_parser("apply"); a.add_argument("plan_dir",type=Path)
    args=p.parse_args()
    if args.cmd=="init-controller": init_controller(args.state_dir); print("controller_ready=true")
    elif args.cmd=="sign": sign(args.state_dir,args.spec,args.output)
    elif args.cmd=="verify": verify(args.bundle); print("signature_valid=true")
    elif args.cmd=="stage": stage(args.bundle,args.node_id,args.proof_dir,args.lifecycle_dir)
    elif args.cmd=="rehearse": rehearse(args.plan_dir)
    elif args.cmd=="rollback": rollback(args.plan_dir)
    elif args.cmd=="apply": die("real workload execution is intentionally disabled in v1.9 until a real owner-controlled node passes the execution proof gate")

if __name__ == "__main__": main()
