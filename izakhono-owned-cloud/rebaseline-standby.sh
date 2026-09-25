#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"
PRIMARY="${IZAKHONO_HA_PRIMARY_SSH:-}"
STANDBY="${IZAKHONO_HA_STANDBY_SSH:-}"
DRILL_REPORT="${IZAKHONO_HA_DRILL_REPORT:-./IZAKHONO-CONTROLLED-FAILOVER-DRILL.json}"
RECONCILE_REPORT="${IZAKHONO_HA_RECONCILIATION_REPORT:-./IZAKHONO-FAILBACK-RECONCILIATION.json}"
PEER_NAME="${IZAKHONO_REBASELINE_REPLICA_PEER:-}"
RECOVERY_KEY_FILE="${IZAKHONO_REBASELINE_RECOVERY_KEY_FILE:-/etc/izakhono/backup-node.env}"
MAX_AGE_MINUTES="${IZAKHONO_REBASELINE_MAX_AGE_MINUTES:-60}"
CONFIRM="${IZAKHONO_REBASELINE_CONFIRM:-}"
REPORT="${IZAKHONO_REBASELINE_REPORT:-./IZAKHONO-STANDBY-REBASELINE.json}"

[ -f "$DRILL_REPORT" ] || { echo "Failover drill report missing: $DRILL_REPORT"; exit 2; }
[ -f "$RECONCILE_REPORT" ] || { echo "Reconciliation report missing: $RECONCILE_REPORT"; exit 3; }
[[ "$MAX_AGE_MINUTES" =~ ^[0-9]+$ ]] || { echo "IZAKHONO_REBASELINE_MAX_AGE_MINUTES must be an integer."; exit 4; }
command -v node >/dev/null 2>&1 || { echo "node is required."; exit 5; }

STATE="$(DRILL_REPORT="$DRILL_REPORT" RECONCILE_REPORT="$RECONCILE_REPORT" node - <<'NODE'
const fs=require("fs");
const drill=JSON.parse(fs.readFileSync(process.env.DRILL_REPORT,"utf8"));
const rec=JSON.parse(fs.readFileSync(process.env.RECONCILE_REPORT,"utf8"));
if(drill.status!=="PASS") process.exit(2);
if(drill.state!=="PRIMARY_ACTIVE_AFTER_RECONCILED_FAILBACK") process.exit(3);
if(drill.failback?.status!=="PASS" || drill.failback?.data_reconciled!==true || drill.failback?.route_switched!==true) process.exit(4);
if(drill.failback?.standby_requires_rebaseline!==true || drill.next_gate!=="REBASELINE_STANDBY_FROM_PRIMARY") process.exit(5);
if(rec.status!=="PASS" || rec.state!=="PRIMARY_ACTIVE_RECONCILED" || rec.data_reconciled!==true || rec.route_switched!==true) process.exit(6);
if(rec.standby_requires_rebaseline!==true || rec.standby_service_role!=="PASSIVE" || rec.standby_background_mutators_stopped!==true) process.exit(7);
process.stdout.write(JSON.stringify({
  primaryToken:Number(rec.fencing?.primary_token||0),
  standbyToken:Number(rec.fencing?.standby_token||0),
  reconciliationCompletedAt:rec.completed_at||null
}));
NODE
)" || { echo "Current HA evidence does not authorize standby re-baselining."; exit 6; }

if [ "$MODE" = "plan" ]; then
  STATE="$STATE" PEER_NAME="$PEER_NAME" RECOVERY_KEY_FILE="$RECOVERY_KEY_FILE" MAX_AGE_MINUTES="$MAX_AGE_MINUTES" node - <<'NODE'
const state=JSON.parse(process.env.STATE);
const plan={
  product:"IZAKHONO STANDBY REBASELINE",
  mode:"PLAN_ONLY",
  current_primary_fencing_token:state.primaryToken,
  current_standby_role:"PASSIVE",
  replica_peer:process.env.PEER_NAME||"<required-on-execute>",
  recovery_key_file_on_standby:process.env.RECOVERY_KEY_FILE,
  max_recovery_age_minutes:Number(process.env.MAX_AGE_MINUTES),
  sequence:[
    "Verify primary and standby are distinct machines",
    "Verify current primary owns valid signed WITNESS leadership",
    "Verify standby remains PASSIVE with autonomous mutators stopped and no leadership",
    "Verify BACKUP encryption-key lineage matches without printing either key",
    "Create a fresh encrypted owned-cloud-core snapshot on the active primary",
    "Sync encrypted archives through the approved REPLICA peer",
    "Verify the exact fresh snapshot SHA-256 appears on the standby",
    "Stage/decrypt that exact replicated snapshot on the standby",
    "Transactionally replace authoritative standby state while keeping public routing unchanged",
    "Keep autonomous standby mutators PASSIVE",
    "Start passive-safe service/control plane and verify standby remains fail-closed without WITNESS leadership",
    "Write a re-baseline proof and require a new PHYSICAL_HA_ACCEPTANCE before the next failover drill"
  ],
  multi_master_merge:false,
  public_route_change:false,
  dns_change:false,
  standby_background_activation:false,
  destructive_actions_performed:false
};
console.log(JSON.stringify(plan,null,2));
NODE
  exit 0
fi

[ "$MODE" = "execute" ] || { echo "Usage: $0 [plan|execute]"; exit 7; }
[ "$CONFIRM" = "REBASELINE-STANDBY" ] || {
  echo "Execution refused. Set IZAKHONO_REBASELINE_CONFIRM=REBASELINE-STANDBY."
  exit 8
}
[ -n "$PRIMARY" ] && [ -n "$STANDBY" ] || { echo "Primary and standby SSH targets are required."; exit 9; }
[ -n "$PEER_NAME" ] || { echo "IZAKHONO_REBASELINE_REPLICA_PEER is required."; exit 10; }
case "$PEER_NAME" in *[!A-Za-z0-9._-]*|'') echo "Unsafe replica peer name."; exit 11;; esac
case "$RECOVERY_KEY_FILE" in /*) ;; *) echo "Recovery-key path on standby must be absolute."; exit 12;; esac
case "$RECOVERY_KEY_FILE" in *[!A-Za-z0-9._/-]*) echo "Unsafe recovery-key path."; exit 121;; esac
for cmd in ssh node sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 13; }
done

remote(){
  local target="$1"; shift
  ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$target" "$@"
}

remote "$PRIMARY" "sudo -n true" >/dev/null 2>&1 || { echo "Primary sudo unavailable."; exit 14; }
remote "$STANDBY" "sudo -n true" >/dev/null 2>&1 || { echo "Standby sudo unavailable."; exit 15; }

PM="$(remote "$PRIMARY" "cat /etc/machine-id")"
SM="$(remote "$STANDBY" "cat /etc/machine-id")"
[ -n "$PM" ] && [ -n "$SM" ] && [ "$PM" != "$SM" ] || {
  echo "Re-baseline refused: primary and standby are not distinct machines."
  exit 16
}

PRIMARY_RUNTIME="$(remote "$PRIMARY" "curl -fsS --max-time 5 http://127.0.0.1:8790/health")" || { echo "Primary RUNTIME unavailable."; exit 17; }
PRIMARY_EDGE="$(remote "$PRIMARY" "curl -fsS --max-time 5 http://127.0.0.1:8795/health")" || { echo "Primary EDGE unavailable."; exit 18; }

PRIMARY_TOKEN="$(R="$PRIMARY_RUNTIME" E="$PRIMARY_EDGE" EXPECTED="$(STATE="$STATE" node -e 'process.stdout.write(String(JSON.parse(process.env.STATE).primaryToken))')" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E),expected=Number(process.env.EXPECTED);
const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
if(r.witness?.mode!=="enforce"||e.witness?.mode!=="enforce")process.exit(2);
if(r.witness?.leaseValid!==true||e.witness?.leaseValid!==true)process.exit(3);
if(r.witness?.receiptVerified!==true||e.witness?.receiptVerified!==true)process.exit(4);
if(!a||a!==b||a!==expected)process.exit(5);
process.stdout.write(String(a));
')" || { echo "Active primary does not hold the reconciled verified WITNESS token."; exit 19; }

ROLE="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/standby-service-role.json")" || {
  echo "Standby PASSIVE role proof missing."
  exit 20
}
ROLE_OK="$(ROLE="$ROLE" node -e '
const x=JSON.parse(process.env.ROLE);
process.stdout.write(String(x.status==="PASS"&&x.role==="PASSIVE"&&x.mutators_stopped===true&&x.automatic_activation===false));
')"
[ "$ROLE_OK" = "true" ] || { echo "Standby is not proven PASSIVE."; exit 21; }

LIVE_MUTATORS="$(remote "$STANDBY" "for s in izakhono-ci-worker-node izakhono-notify-node izakhono-backup-node izakhono-model-worker-node izakhono-gpu-compute-node izakhono-mail-relay-adapter; do if systemctl is-active --quiet \$s 2>/dev/null; then echo \$s; fi; done")"
[ -z "$LIVE_MUTATORS" ] || { echo "Standby background mutators are active: $LIVE_MUTATORS"; exit 22; }

STANDBY_RUNTIME="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8790/health" 2>/dev/null || true)"
STANDBY_EDGE="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8795/health" 2>/dev/null || true)"
if [ -n "$STANDBY_RUNTIME" ] || [ -n "$STANDBY_EDGE" ]; then
  STANDBY_LEADER="$(R="$STANDBY_RUNTIME" E="$STANDBY_EDGE" node -e '
function p(v){try{return JSON.parse(v)}catch{return null}}
const r=p(process.env.R),e=p(process.env.E);
process.stdout.write(String(Boolean(r?.witness?.leaseValid||e?.witness?.leaseValid)));
')"
  [ "$STANDBY_LEADER" = "false" ] || { echo "Standby unexpectedly holds WITNESS leadership."; exit 23; }
fi

key_fingerprint(){
  local target="$1"
  remote "$target" "sudo -n awk -F= '\$1=="IZAKHONO_BACKUP_ENCRYPTION_KEY"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/backup-node.env | sha256sum | awk '{print \$1}'"
}
PRIMARY_KEY_HASH="$(key_fingerprint "$PRIMARY")"
STANDBY_KEY_HASH="$(key_fingerprint "$STANDBY")"
[ -n "$PRIMARY_KEY_HASH" ] && [ "$PRIMARY_KEY_HASH" = "$STANDBY_KEY_HASH" ] || {
  echo "Backup encryption-key lineage mismatch."
  exit 24
}
unset PRIMARY_KEY_HASH STANDBY_KEY_HASH

remote "$STANDBY" "sudo -n test -f '$RECOVERY_KEY_FILE'" || {
  echo "Standby recovery-key file not found: $RECOVERY_KEY_FILE"
  exit 25
}

echo "Creating fresh encrypted primary recovery point..."
SNAPSHOT="$(remote "$PRIMARY" "sudo -n bash -s" <<'REMOTE'
set -euo pipefail
ENV=/etc/izakhono/backup-node.env
ADMIN="$(awk -F= '$1=="IZAKHONO_BACKUP_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
[ -n "$ADMIN" ] || { echo "backup-admin-key-missing" >&2; exit 2; }
SETS="$(curl -fsS --max-time 5 -H "x-izakhono-key: $ADMIN" http://127.0.0.1:8870/v1/sets)"
SET_ID="$(SETS="$SETS" node -e 'const x=JSON.parse(process.env.SETS);const s=(x.sets||[]).find(v=>v.name==="owned-cloud-core");if(!s)process.exit(2);process.stdout.write(s.id)')"
RESPONSE="$(curl -fsS -X POST -H "x-izakhono-key: $ADMIN" "http://127.0.0.1:8870/v1/sets/$SET_ID/snapshots")"
unset ADMIN
RESPONSE="$RESPONSE" node -e '
const x=JSON.parse(process.env.RESPONSE),s=x.snapshot;
if(!s||s.state!=="complete"||typeof s.archive_path!=="string"||!s.archive_path.startsWith("/var/lib/izakhono-backup/archives/")||!/^[0-9a-f]{64}$/.test(s.sha256||""))process.exit(2);
process.stdout.write(JSON.stringify({id:s.id,path:s.archive_path,sha256:s.sha256,size:Number(s.size_bytes||0)}));
'
REMOTE
)" || { echo "Fresh primary snapshot failed."; exit 26; }

SNAPSHOT_SHA="$(SNAPSHOT="$SNAPSHOT" node -e 'process.stdout.write(JSON.parse(process.env.SNAPSHOT).sha256)')"
SNAPSHOT_ID="$(SNAPSHOT="$SNAPSHOT" node -e 'process.stdout.write(JSON.parse(process.env.SNAPSHOT).id)')"

echo "Ensuring standby REPLICA receiver is available..."
remote "$STANDBY" "sudo -n systemctl start izakhono-replica-node"
REPLICA_HEALTH="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8890/health")" || { echo "Standby REPLICA health failed."; exit 27; }
REPLICA_OK="$(REPLICA_HEALTH="$REPLICA_HEALTH" node -e 'const x=JSON.parse(process.env.REPLICA_HEALTH);process.stdout.write(String(x.product==="IZAKHONO REPLICA NODE"&&x.status==="healthy"))')"
[ "$REPLICA_OK" = "true" ] || { echo "Standby REPLICA health contract invalid."; exit 28; }

echo "Syncing fresh encrypted primary snapshot through approved REPLICA peer..."
SYNC="$(remote "$PRIMARY" "sudo -n bash -s" <<REMOTE
set -euo pipefail
ENV=/etc/izakhono/replica-node.env
ADMIN="$(awk -F= '$1=="IZAKHONO_REPLICA_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
[ -n "$ADMIN" ] || { echo "replica-admin-key-missing" >&2; exit 2; }
PEERS="$(curl -fsS --max-time 5 -H "x-izakhono-key: $ADMIN" http://127.0.0.1:8890/v1/peers)"
PEER_ID="$(PEERS="$PEERS" PEER_NAME="$PEER_NAME" node -e 'const x=JSON.parse(process.env.PEERS),name=process.env.PEER_NAME;const p=(x.peers||[]).find(v=>v.name===name&&Number(v.enabled)===1);if(!p)process.exit(2);process.stdout.write(p.id)')"
RESPONSE="$(curl -fsS -X POST -H "x-izakhono-key: $ADMIN" "http://127.0.0.1:8890/v1/peers/$PEER_ID/sync")"
unset ADMIN
printf '%s' "$RESPONSE"
REMOTE
)" || { echo "Primary REPLICA sync failed."; exit 29; }

SYNC_OK="$(SYNC="$SYNC" node -e '
const x=JSON.parse(process.env.SYNC);
const rows=x.results||[];
process.stdout.write(String(Number(x.archives)>0&&rows.length===Number(x.archives)&&rows.every(v=>v.state==="complete"||v.state==="duplicate")));
')"
[ "$SYNC_OK" = "true" ] || { echo "One or more primary replica transfers failed."; exit 30; }

echo "Proving the exact new snapshot reached standby..."
OBJECT_MATCH="$(remote "$STANDBY" "sudo -n bash -s" <<REMOTE
set -euo pipefail
ENV=/etc/izakhono/replica-node.env
ADMIN="$(awk -F= '$1=="IZAKHONO_REPLICA_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
HOST="$(awk -F= '$1=="HOST"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
PORT="$(awk -F= '$1=="PORT"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
HOST="${HOST:-127.0.0.1}"; PORT="${PORT:-8890}"
OBJECTS="$(curl -fsS --max-time 5 -H "x-izakhono-key: $ADMIN" "http://$HOST:$PORT/v1/objects")"
unset ADMIN
OBJECTS="$OBJECTS" SHA="$SNAPSHOT_SHA" node -e 'const x=JSON.parse(process.env.OBJECTS),sha=process.env.SHA;const r=(x.objects||[]).find(v=>v.sha256===sha);if(!r)process.exit(2);process.stdout.write(JSON.stringify(r))'
REMOTE
)" || { echo "Fresh primary snapshot not found on standby REPLICA."; exit 31; }

OBJECT_ID="$(OBJECT_MATCH="$OBJECT_MATCH" node -e 'process.stdout.write(JSON.parse(process.env.OBJECT_MATCH).id)')"

VERIFY="$(remote "$STANDBY" "sudo -n bash -s" <<REMOTE
set -euo pipefail
ENV=/etc/izakhono/replica-node.env
ADMIN="$(awk -F= '$1=="IZAKHONO_REPLICA_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
HOST="$(awk -F= '$1=="HOST"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
PORT="$(awk -F= '$1=="PORT"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
HOST="${HOST:-127.0.0.1}"; PORT="${PORT:-8890}"
curl -fsS -X POST -H "x-izakhono-key: $ADMIN" "http://$HOST:$PORT/v1/objects/$OBJECT_ID/verify"
REMOTE
)" || { echo "Standby replica SHA verification failed."; exit 32; }

VERIFY_SHA="$(VERIFY="$VERIFY" node -e 'const x=JSON.parse(process.env.VERIFY);if(x.verified!==true)process.exit(2);process.stdout.write(x.sha256)')" || {
  echo "Standby replica verification response invalid."
  exit 33
}
[ "$VERIFY_SHA" = "$SNAPSHOT_SHA" ] || { echo "Standby replica digest does not match fresh primary snapshot."; exit 34; }

echo "Staging the exact fresh replica recovery point..."
remote "$STANDBY" "sudo -n bash /opt/izakhono-owned-cloud/stage-standby-replica.sh '$RECOVERY_KEY_FILE' '$MAX_AGE_MINUTES'" >/dev/null || {
  echo "Standby staging failed."
  exit 35
}

STAGE_PROOF="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/standby-restore-staged.json")" || {
  echo "Standby staged proof missing."
  exit 36
}
STAGE="$(STAGE_PROOF="$STAGE_PROOF" EXPECTED_SHA="$SNAPSHOT_SHA" node -e '
const x=JSON.parse(process.env.STAGE_PROOF),sha=process.env.EXPECTED_SHA;
if(x.status!=="STAGED_AND_VERIFIED"||x.live_directories_modified!==false||x.promotion_performed!==false||x.replica?.sha256!==sha)process.exit(2);
process.stdout.write(JSON.stringify({destination:x.restore?.destination,age:Number(x.replica?.age_minutes),objectId:x.replica?.object_id}));
')" || { echo "Staged proof does not match fresh primary snapshot."; exit 37; }

STAGED_ROOT="$(STAGE="$STAGE" node -e 'process.stdout.write(JSON.parse(process.env.STAGE).destination)')"

STATE_SERVICES=(
  izakhono-data-node
  izakhono-object-node
  izakhono-queue-node
  izakhono-auth-node
  izakhono-analytics-node
  izakhono-notify-node
  izakhono-ai-gateway-node
  izakhono-code-node
  izakhono-backup-node
)
PASSIVE_SAFE_SERVICES=(
  izakhono-data-node
  izakhono-object-node
  izakhono-queue-node
  izakhono-auth-node
  izakhono-analytics-node
  izakhono-ai-gateway-node
  izakhono-code-node
)

ROLLBACK_MANIFEST=""
APPLIED=0
recover(){
  code=$?
  if [ "$code" -eq 0 ]; then return; fi
  echo "Standby re-baseline failed. Attempting local rollback to the prior standby state..."
  remote "$STANDBY" "sudo -n systemctl stop ${STATE_SERVICES[*]} izakhono-runtime-node izakhono-edge-node >/dev/null 2>&1 || true"
  if [ "$APPLIED" -eq 1 ] && [ -n "$ROLLBACK_MANIFEST" ]; then
    remote "$STANDBY" "sudo -n node /opt/izakhono-owned-cloud/standby-state-swap.mjs rollback --manifest '$ROLLBACK_MANIFEST' --promotion-root /var/lib/izakhono-rebaseline/promotions >/dev/null 2>&1 || true" || true
  fi
  remote "$STANDBY" "sudo -n bash /opt/izakhono-owned-cloud/set-standby-role.sh passive >/dev/null 2>&1 || true; sudo -n systemctl start izakhono-replica-node izakhono-failover-node izakhono-runtime-node izakhono-edge-node >/dev/null 2>&1 || true" || true
  exit "$code"
}
trap recover EXIT

echo "Applying fresh primary state transactionally to passive standby..."
remote "$STANDBY" "sudo -n systemctl stop ${STATE_SERVICES[*]} izakhono-runtime-node izakhono-edge-node"
APPLY="$(remote "$STANDBY" "sudo -n node /opt/izakhono-owned-cloud/standby-state-swap.mjs apply --staged-root '$STAGED_ROOT' --promotion-root /var/lib/izakhono-rebaseline/promotions")" || {
  echo "Standby re-baseline state transaction failed."
  exit 38
}
ROLLBACK_MANIFEST="$(APPLY="$APPLY" node -e 'const x=JSON.parse(process.env.APPLY);if(x.status!=="APPLIED")process.exit(2);process.stdout.write(x.manifest)')" || {
  echo "Re-baseline transaction receipt invalid."
  exit 39
}
APPLIED=1

remote "$STANDBY" "sudo -n systemctl start ${PASSIVE_SAFE_SERVICES[*]} izakhono-replica-node izakhono-failover-node"

declare -A HEALTH=(
  [izakhono-data-node]=http://127.0.0.1:8787/health
  [izakhono-object-node]=http://127.0.0.1:8800/health
  [izakhono-queue-node]=http://127.0.0.1:8810/health
  [izakhono-auth-node]=http://127.0.0.1:8820/health
  [izakhono-analytics-node]=http://127.0.0.1:8830/health
  [izakhono-ai-gateway-node]=http://127.0.0.1:8850/health
  [izakhono-code-node]=http://127.0.0.1:8860/health
  [izakhono-replica-node]=http://127.0.0.1:8890/health
  [izakhono-failover-node]=http://127.0.0.1:8920/health
)
for service in "${PASSIVE_SAFE_SERVICES[@]}" izakhono-replica-node izakhono-failover-node; do
  url="${HEALTH[$service]}"
  ok=0
  for _ in $(seq 1 30); do
    body="$(remote "$STANDBY" "curl -fsS --max-time 2 '$url'" 2>/dev/null || true)"
    if [ -n "$body" ] && BODY="$body" node -e 'const x=JSON.parse(process.env.BODY);if(x.status==="healthy")process.exit(0);process.exit(2)' 2>/dev/null; then
      ok=1; break
    fi
    sleep 1
  done
  [ "$ok" = "1" ] || { echo "Re-baselined standby service unhealthy: $service"; exit 40; }
done

remote "$STANDBY" "sudo -n systemctl start izakhono-runtime-node izakhono-edge-node"

NO_LEASE=0
for _ in $(seq 1 30); do
  R="$(remote "$STANDBY" "curl -fsS --max-time 2 http://127.0.0.1:8790/health" 2>/dev/null || true)"
  E="$(remote "$STANDBY" "curl -fsS --max-time 2 http://127.0.0.1:8795/health" 2>/dev/null || true)"
  if [ -n "$R" ] && [ -n "$E" ]; then
    OK="$(R="$R" E="$E" node -e '
      const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
      const ok=r.witness?.mode==="enforce"&&e.witness?.mode==="enforce"
        &&r.witness?.leaseValid!==true&&e.witness?.leaseValid!==true;
      process.stdout.write(String(ok));
    ' 2>/dev/null || true)"
    if [ "$OK" = "true" ]; then NO_LEASE=1; break; fi
  fi
  sleep 1
done
[ "$NO_LEASE" = "1" ] || { echo "Re-baselined standby is not fail-closed without WITNESS leadership."; exit 41; }

remote "$STANDBY" "sudo -n bash /opt/izakhono-owned-cloud/set-standby-role.sh passive" >/dev/null
PASSIVE_PROOF="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/standby-service-role.json")"
PASSIVE_OK="$(PASSIVE_PROOF="$PASSIVE_PROOF" node -e '
const x=JSON.parse(process.env.PASSIVE_PROOF);
process.stdout.write(String(x.status==="PASS"&&x.role==="PASSIVE"&&x.mutators_stopped===true&&x.automatic_activation===false));
')"
[ "$PASSIVE_OK" = "true" ] || { echo "Re-baselined standby PASSIVE role proof invalid."; exit 42; }

LIVE_MUTATORS="$(remote "$STANDBY" "for s in izakhono-ci-worker-node izakhono-notify-node izakhono-backup-node izakhono-model-worker-node izakhono-gpu-compute-node izakhono-mail-relay-adapter; do if systemctl is-active --quiet \$s 2>/dev/null; then echo \$s; fi; done")"
[ -z "$LIVE_MUTATORS" ] || { echo "Re-baselined standby mutators unexpectedly active: $LIVE_MUTATORS"; exit 43; }

PRIMARY_HASH="$(printf '%s' "$PM" | sha256sum | awk '{print $1}')"
STANDBY_HASH="$(printf '%s' "$SM" | sha256sum | awk '{print $1}')"

SNAPSHOT="$SNAPSHOT" STAGE="$STAGE" PRIMARY_HASH="$PRIMARY_HASH" STANDBY_HASH="$STANDBY_HASH" PRIMARY_TOKEN="$PRIMARY_TOKEN" MANIFEST="$ROLLBACK_MANIFEST" PEER_NAME="$PEER_NAME" node - <<'NODE' >"$REPORT"
const snapshot=JSON.parse(process.env.SNAPSHOT);
const stage=JSON.parse(process.env.STAGE);
const report={
  product:"IZAKHONO STANDBY REBASELINE",
  status:"PASS",
  state:"STANDBY_REBASELINED_PASSIVE",
  source_primary:{
    machine_sha256:process.env.PRIMARY_HASH,
    fencing_token:Number(process.env.PRIMARY_TOKEN)
  },
  standby:{
    machine_sha256:process.env.STANDBY_HASH,
    service_role:"PASSIVE",
    background_mutators_stopped:true,
    witness_leadership_valid:false,
    public_route_changed:false,
    dns_changed:false
  },
  recovery_point:{
    snapshot_id:snapshot.id,
    sha256:snapshot.sha256,
    replica_peer:process.env.PEER_NAME,
    replica_object_id:stage.objectId,
    age_minutes:stage.age,
    encrypted:true,
    sha256_verified:true
  },
  transaction:{
    manifest:process.env.MANIFEST,
    reversible:true
  },
  multi_master_merge:false,
  next_gate:"PHYSICAL_HA_REACCEPTANCE",
  completed_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE
chmod 0600 "$REPORT"

remote "$STANDBY" "sudo -n mkdir -p /var/lib/izakhono-deploy/proofs && sudo -n tee /var/lib/izakhono-deploy/proofs/standby-rebaseline.json >/dev/null" <"$REPORT"
remote "$STANDBY" "sudo -n chmod 0600 /var/lib/izakhono-deploy/proofs/standby-rebaseline.json"

node - "$DRILL_REPORT" "$RECONCILE_REPORT" "$REPORT" <<'NODE'
const fs=require("fs");
const drillPath=process.argv[2],recPath=process.argv[3],reportPath=process.argv[4];
const drill=JSON.parse(fs.readFileSync(drillPath,"utf8"));
const rec=JSON.parse(fs.readFileSync(recPath,"utf8"));
drill.failback.standby_requires_rebaseline=false;
drill.failback.rebaseline_report=reportPath;
drill.next_gate="PHYSICAL_HA_REACCEPTANCE";
rec.standby_requires_rebaseline=false;
rec.rebaseline_report=reportPath;
rec.next_gate="PHYSICAL_HA_REACCEPTANCE";
fs.writeFileSync(drillPath,JSON.stringify(drill,null,2)+"\n",{mode:0o600});
fs.writeFileSync(recPath,JSON.stringify(rec,null,2)+"\n",{mode:0o600});
NODE

trap - EXIT
echo "IZAKHONO STANDBY REBASELINE: PASS"
echo "Standby role: PASSIVE"
echo "Background mutators: STOPPED"
echo "Public route changed: NO"
echo "Next gate: PHYSICAL_HA_REACCEPTANCE"
echo "Report: $REPORT"
