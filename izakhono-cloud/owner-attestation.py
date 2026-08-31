#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.12 owner-hardware attestation packet.

Creates and verifies a node-signed, sanitized self-attestation that binds a real
runtime-proof JSON to the node identity and current machine facts. This is not
independent hardware verification and cannot assert public/commercial readiness.
"""
from __future__ import annotations

import argparse, base64, hashlib, json, os, platform, shutil, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "izakhono.owner-hardware-attestation.v1"
ALGORITHM = "ed25519"


def die(msg: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {msg}")


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical(v: object) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""): h.update(chunk)
    return h.hexdigest()


def run(cmd: list[str]) -> bytes:
    try:
        return subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
    except FileNotFoundError:
        die(f"required command not found: {cmd[0]}")
    except subprocess.CalledProcessError as exc:
        detail=exc.stderr.decode("utf-8","replace").strip()
        die(f"command failed: {' '.join(cmd)}{': '+detail if detail else ''}")


def node_identity(state: Path) -> tuple[Path, Path, str]:
    ident=state/"identity"
    priv,pub,nid=ident/"private.pem",ident/"public.pem",ident/"node-id"
    if not (priv.exists() and pub.exists() and nid.exists()): die("complete node identity is required")
    node_id=nid.read_text().strip()
    expected="izn-"+hashlib.sha256(pub.read_bytes()).hexdigest()[:24]
    if node_id != expected: die("node id does not match public-key fingerprint")
    return priv,pub,node_id


def read_mem_mb() -> int:
    for line in Path('/proc/meminfo').read_text().splitlines():
        if line.startswith('MemTotal:'): return int(line.split()[1])//1024
    die("cannot read total memory")


def os_name() -> str:
    p=Path('/etc/os-release')
    if not p.exists(): return platform.system()
    vals={}
    for line in p.read_text(errors='replace').splitlines():
        if '=' in line:
            k,v=line.split('=',1); vals[k]=v.strip().strip('"')
    return vals.get('PRETTY_NAME') or vals.get('NAME') or platform.system()


def docker_version() -> str:
    if shutil.which('docker') is None: die('docker is required')
    value=run(['docker','version','--format','{{.Server.Version}}']).decode().strip()
    if not value: die('Docker server version unavailable')
    return value


def validate_runtime_proof(path: Path) -> dict:
    try: proof=json.loads(path.read_text())
    except (OSError,json.JSONDecodeError) as exc: die(f"cannot read runtime proof: {exc}")
    if not isinstance(proof,dict) or proof.get('schema')!='izakhono.runtime-proof.v1': die('unsupported runtime proof')
    if proof.get('real_container_runtime_exercised') is not True: die('runtime proof did not exercise a real container runtime')
    if proof.get('isolation_flags_verified') is not True or proof.get('rollback_verified') is not True: die('runtime proof lacks isolation or rollback evidence')
    if proof.get('public_ready') is not False or proof.get('commercial_ready') is not False: die('runtime proof violates readiness truth boundary')
    return proof


def sign_bytes(priv: Path, data: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as td:
        d,s=Path(td)/'data',Path(td)/'sig'; d.write_bytes(data)
        run(['openssl','pkeyutl','-sign','-rawin','-inkey',str(priv),'-in',str(d),'-out',str(s)])
        return s.read_bytes()


def verify_bytes(pub: Path, data: bytes, sig: bytes) -> None:
    with tempfile.TemporaryDirectory() as td:
        d,s=Path(td)/'data',Path(td)/'sig'; d.write_bytes(data); s.write_bytes(sig)
        run(['openssl','pkeyutl','-verify','-rawin','-pubin','-inkey',str(pub),'-in',str(d),'-sigfile',str(s)])


def create(runtime_proof: Path, node_state: Path, output: Path, owner_claim: bool) -> None:
    proof=validate_runtime_proof(runtime_proof)
    priv,pub,node_id=node_identity(node_state)
    if proof.get('node_id') not in {None,node_id}: die('runtime proof node_id does not match this node')
    st=os.statvfs('/')
    att={
      'schema':SCHEMA,'generated_at':now(),'node_id':node_id,
      'runtime_proof_sha256':sha256_file(runtime_proof),
      'runtime_proof_scope':proof.get('proof_scope','unknown'),
      'machine':{'os':os_name(),'architecture':platform.machine(),'logical_cpus':os.cpu_count() or 1,'memory_mb':read_mem_mb(),'root_free_mb':(st.f_bavail*st.f_frsize)//(1024*1024),'docker_server_version':docker_version()},
      'owner_control_claim':bool(owner_claim),'verification_level':'self_attested',
      'independent_hardware_verified':False,'public_ready':False,'commercial_ready':False,
      'secrets_included':False
    }
    sig=sign_bytes(priv,canonical(att))
    payload={'schema':SCHEMA,'algorithm':ALGORITHM,'attestation':att,'node_public_key':pub.read_text(),'signature_b64':base64.b64encode(sig).decode('ascii')}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(payload,indent=2,sort_keys=True)+'\n'); os.chmod(output,0o600)
    print(f'attestation={output}'); print(f'node_id={node_id}'); print('verification_level=self_attested'); print('independent_hardware_verified=false'); print('public_ready=false')


def verify(path: Path, runtime_proof: Path | None) -> dict:
    try: payload=json.loads(path.read_text())
    except (OSError,json.JSONDecodeError) as exc: die(f"cannot read attestation: {exc}")
    if payload.get('schema')!=SCHEMA or payload.get('algorithm')!=ALGORITHM: die('unsupported attestation')
    att,pub_text,sig_b64=payload.get('attestation'),payload.get('node_public_key'),payload.get('signature_b64')
    if not isinstance(att,dict) or not isinstance(pub_text,str) or not isinstance(sig_b64,str): die('malformed attestation')
    if att.get('verification_level')!='self_attested' or att.get('independent_hardware_verified') is not False: die('invalid verification boundary')
    if att.get('public_ready') is not False or att.get('commercial_ready') is not False or att.get('secrets_included') is not False: die('attestation violates truth boundary')
    expected='izn-'+hashlib.sha256(pub_text.encode()).hexdigest()[:24]
    if att.get('node_id')!=expected: die('attestation node id does not match public key')
    if runtime_proof is not None:
        validate_runtime_proof(runtime_proof)
        if att.get('runtime_proof_sha256')!=sha256_file(runtime_proof): die('runtime proof hash mismatch')
    try: sig=base64.b64decode(sig_b64,validate=True)
    except Exception: die('invalid signature encoding')
    with tempfile.TemporaryDirectory() as td:
        pub=Path(td)/'pub.pem'; pub.write_text(pub_text); verify_bytes(pub,canonical(att),sig)
    return att


def main() -> None:
    p=argparse.ArgumentParser(description='IZAKHONO CLOUD owner hardware attestation')
    s=p.add_subparsers(dest='cmd',required=True)
    a=s.add_parser('create'); a.add_argument('--runtime-proof',type=Path,required=True); a.add_argument('--node-state-dir',type=Path,required=True); a.add_argument('--output',type=Path,required=True); a.add_argument('--owner-control-claim',action='store_true')
    a=s.add_parser('verify'); a.add_argument('attestation',type=Path); a.add_argument('--runtime-proof',type=Path)
    args=p.parse_args()
    if args.cmd=='create': create(args.runtime_proof,args.node_state_dir,args.output,args.owner_control_claim)
    else:
        att=verify(args.attestation,args.runtime_proof); print(f"verified_node={att['node_id']}"); print('verification_level=self_attested'); print('independent_hardware_verified=false'); print('public_ready=false')

if __name__=='__main__': main()
