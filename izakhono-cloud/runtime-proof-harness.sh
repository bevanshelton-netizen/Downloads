#!/usr/bin/env bash
set -euo pipefail
umask 077

MODE=${1:-}
case "$MODE" in ci|owner) ;; *) echo "usage: $0 {ci|owner}" >&2; exit 2 ;; esac

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MULTINODE=${IZAKHONO_MULTINODE_TOOL:-$SCRIPT_DIR/multinode.py}
LIFECYCLE=${IZAKHONO_LIFECYCLE_TOOL:-$SCRIPT_DIR/workload-lifecycle.py}
LOCAL_EXEC=${IZAKHONO_LOCAL_EXEC_TOOL:-$SCRIPT_DIR/local-execution.py}

for f in "$MULTINODE" "$LIFECYCLE" "$LOCAL_EXEC"; do
  [ -f "$f" ] || { echo "ERROR: required tool missing: $f" >&2; exit 1; }
done
for cmd in python3 openssl docker; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: required command missing: $cmd" >&2; exit 1; }
done
docker info >/dev/null

cleanup_root=""
if [ "$MODE" = ci ]; then
  ROOT=$(mktemp -d)
  cleanup_root="$ROOT"
  PROOF_DIR="$ROOT/proof"
  NODE_STATE="$ROOT/node"
  CONTROLLER_STATE="$ROOT/controller"
  EXECUTION_DIR="$ROOT/executions"
  OUT_DIR="$ROOT/output"
  mkdir -p "$PROOF_DIR" "$NODE_STATE" "$CONTROLLER_STATE" "$EXECUTION_DIR" "$OUT_DIR"
  : > "$PROOF_DIR/READY"
else
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then exec sudo -E bash "$0" owner; fi
    echo "ERROR: owner proof must run as root or with sudo" >&2; exit 1
  fi
  PROOF_DIR=${IZAKHONO_PROOF_DIR:-/var/lib/izakhono-cloud}
  NODE_STATE=${IZAKHONO_NODE_STATE_DIR:-/var/lib/izakhono-cloud/node}
  EXECUTION_DIR=${IZAKHONO_EXECUTION_DIR:-/var/lib/izakhono-cloud/executions}
  OUT_DIR=${IZAKHONO_RUNTIME_PROOF_DIR:-/var/lib/izakhono-cloud/proofs/runtime}
  [ -f "$PROOF_DIR/READY" ] || { echo "ERROR: owner proof requires /var/lib/izakhono-cloud/READY" >&2; exit 1; }
  ROOT=$(mktemp -d /var/lib/izakhono-cloud/runtime-proof.XXXXXX)
  cleanup_root="$ROOT"
  CONTROLLER_STATE="$ROOT/controller"
  mkdir -p "$CONTROLLER_STATE" "$EXECUTION_DIR" "$OUT_DIR"
fi
trap 'rm -rf "$cleanup_root"' EXIT

# Running this harness locally is the explicit activation for this one proof.
ACTIVATION="$PROOF_DIR/ALLOW_LOCAL_EXECUTION"
old_activation=""
if [ -f "$ACTIVATION" ]; then old_activation=$(cat "$ACTIVATION" || true); fi
printf 'enabled=true\n' > "$ACTIVATION"
restore_activation() {
  if [ -n "$old_activation" ]; then printf '%s\n' "$old_activation" > "$ACTIVATION"; else rm -f "$ACTIVATION"; fi
}
trap 'restore_activation; rm -rf "$cleanup_root"' EXIT

python3 "$MULTINODE" init --state-dir "$NODE_STATE" >/dev/null
NODE_ID=$(cat "$NODE_STATE/identity/node-id")

IMAGE=${IZAKHONO_PROOF_IMAGE_DIGEST:-}
if [ -z "$IMAGE" ]; then
  IMAGE=$(docker image inspect $(docker image ls -q | head -n 20) 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next((x for i in d for x in (i.get("RepoDigests") or []) if "@sha256:" in x), ""))' || true)
fi
if [ -z "$IMAGE" ] && [ "$MODE" = ci ]; then
  docker pull alpine:3.20 >/dev/null
  IMAGE=$(docker image inspect alpine:3.20 | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next(x for x in d[0].get("RepoDigests",[]) if "@sha256:" in x))')
fi
[ -n "$IMAGE" ] || { echo "ERROR: no local image with a repository digest is available; set IZAKHONO_PROOF_IMAGE_DIGEST to a locally present digest" >&2; exit 1; }
docker image inspect "$IMAGE" >/dev/null

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WORKLOAD_ID="runtime-proof-$STAMP"
SPEC="$ROOT/spec.json"
BUNDLE="$ROOT/workload.bundle.json"
PERMIT="$ROOT/execution.permit.json"
cat > "$SPEC" <<EOF
{
  "workload_id": "$WORKLOAD_ID",
  "target_node_id": "$NODE_ID",
  "image": "$IMAGE",
  "cpu_millis": 250,
  "memory_mb": 128,
  "disk_mb": 32,
  "privileged": false,
  "host_network": false,
  "host_mounts": [],
  "rootfs_read_only": true,
  "ports": []
}
EOF

python3 "$LIFECYCLE" init-controller --state-dir "$CONTROLLER_STATE" >/dev/null
python3 "$LIFECYCLE" sign --state-dir "$CONTROLLER_STATE" --spec "$SPEC" --output "$BUNDLE" >/dev/null
python3 "$LIFECYCLE" verify "$BUNDLE" >/dev/null
python3 "$LOCAL_EXEC" authorize "$BUNDLE" --lifecycle-tool "$LIFECYCLE" --node-state-dir "$NODE_STATE" --proof-dir "$PROOF_DIR" --output "$PERMIT" --ttl-minutes 5 >/dev/null

EXEC_OUTPUT=$(python3 "$LOCAL_EXEC" execute "$PERMIT" "$BUNDLE" --lifecycle-tool "$LIFECYCLE" --node-state-dir "$NODE_STATE" --proof-dir "$PROOF_DIR" --execution-dir "$EXECUTION_DIR" --execute-local)
printf '%s\n' "$EXEC_OUTPUT"
EXECUTION_ID=$(printf '%s\n' "$EXEC_OUTPUT" | awk -F= '/^execution_id=/{print $2}')
[ -n "$EXECUTION_ID" ] || { echo "ERROR: execution id was not produced" >&2; exit 1; }
CONTAINER="izakhono-proof-$EXECUTION_ID"
INSPECT="$ROOT/inspect.json"
docker inspect "$CONTAINER" > "$INSPECT"

python3 - "$INSPECT" <<'PY'
import json, sys
x=json.load(open(sys.argv[1]))[0]
h=x["HostConfig"]
assert h.get("NetworkMode") == "none", h.get("NetworkMode")
assert h.get("ReadonlyRootfs") is True
assert "ALL" in (h.get("CapDrop") or [])
assert any("no-new-privileges" in s for s in (h.get("SecurityOpt") or []))
assert int(h.get("PidsLimit") or 0) == 128
assert 0 < int(h.get("Memory") or 0) <= 512*1024*1024
assert 0 < int(h.get("NanoCpus") or 0) <= 1_000_000_000
assert not (h.get("Binds") or [])
assert not (h.get("PortBindings") or {})
PY

python3 "$LOCAL_EXEC" rollback --execution-id "$EXECUTION_ID" --execution-dir "$EXECUTION_DIR" >/dev/null
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: rollback left proof container behind" >&2
  exit 1
fi

PROOF_FILE="$OUT_DIR/runtime-proof-$STAMP.json"
python3 - "$PROOF_FILE" "$MODE" "$NODE_ID" "$WORKLOAD_ID" "$IMAGE" "$EXECUTION_ID" <<'PY'
import json, sys, datetime
out, mode, node, workload, image, execution = sys.argv[1:]
data = {
  "schema": "izakhono.runtime-proof.v1",
  "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00","Z"),
  "proof_scope": "github_hosted_docker_runtime" if mode == "ci" else "local_ready_node_runtime",
  "owner_controlled_hardware_verified": False,
  "node_id": node,
  "workload_id": workload,
  "image_digest": image,
  "execution_id": execution,
  "real_container_runtime_exercised": True,
  "isolation_flags_verified": True,
  "rollback_verified": True,
  "remote_execution": False,
  "automatic_failover": False,
  "public_ready": False,
  "commercial_ready": False,
  "requires_independent_owner_hardware_attestation": True
}
with open(out,"w") as f: json.dump(data,f,indent=2,sort_keys=True); f.write("\n")
print(f"runtime_proof={out}")
print("real_container_runtime_exercised=true")
print("isolation_flags_verified=true")
print("rollback_verified=true")
print("owner_controlled_hardware_verified=false")
print("public_ready=false")
print("commercial_ready=false")
PY
