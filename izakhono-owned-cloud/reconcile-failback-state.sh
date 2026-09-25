#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"
DRILL_REPORT="${IZAKHONO_HA_DRILL_REPORT:-./IZAKHONO-CONTROLLED-FAILOVER-DRILL.json}"
PRIMARY="${IZAKHONO_HA_PRIMARY_SSH:-}"
STANDBY="${IZAKHONO_HA_STANDBY_SSH:-}"
ROUTE_SCRIPT="${IZAKHONO_HA_ROUTE_ROLLBACK_SCRIPT:-}"
CONFIRM="${IZAKHONO_HA_RECONCILE_CONFIRM:-}"
REPORT="${IZAKHONO_HA_RECONCILIATION_REPORT:-./IZAKHONO-FAILBACK-RECONCILIATION.json}"

[ -f "$DRILL_REPORT" ] || { echo "Failover drill report missing: $DRILL_REPORT"; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required."; exit 3; }

DRILL="$(node - "$DRILL_REPORT" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.status!=="PASS" || x.state!=="STANDBY_ACTIVE" || x.route_switched!==true || x.primary_fenced!==true) process.exit(2);
process.stdout.write(JSON.stringify({
  standbyToken:Number(x.fencing?.active||0),
  clusterId:x.cluster_id||null
}));
NODE
)" || { echo "Failover drill report does not authorize reconciled failback."; exit 4; }

if [ "$MODE" = "plan" ]; then
  DRILL="$DRILL" node - <<'NODE'
const d=JSON.parse(process.env.DRILL);
const plan={
  product:"IZAKHONO DATA-SAFE FAILBACK RECONCILIATION",
  mode:"PLAN_ONLY",
  current_active:"standby",
  standby_fencing_token:d.standbyToken,
  sequence:[
    "Verify standby live-state promotion proof and current WITNESS leadership",
    "Verify primary remains fenced and backup encryption-key lineage matches",
    "Stop standby EDGE/RUNTIME and mutable background services to create a single-writer freeze",
    "Create a fresh encrypted owned-cloud-core BACKUP snapshot on the frozen standby",
    "Stream the encrypted .izbk archive over SSH to the original primary and compare SHA-256",
    "Restore the archive into an isolated primary staging root",
    "Transactionally promote authoritative DATA/OBJECT/QUEUE/AUTH/ANALYTICS/NOTIFY/AI/CODE state plus matching service keys on the primary",
    "Start and health-check reconciled primary services",
    "Start primary RUNTIME/EDGE and require a newer matching verified WITNESS fencing token",
    "Switch the trusted route/DNS back to primary",
    "Leave standby stateful services stopped pending re-baseline from the new primary"
  ],
  multi_master_merge:false,
  public_write_freeze_required:true,
  automatic_dns_change:false,
  automatic_failback:false,
  destructive_actions_performed:false
};
console.log(JSON.stringify(plan,null,2));
NODE
  exit 0
fi

[ "$MODE" = "execute" ] || { echo "Usage: $0 [plan|execute]"; exit 5; }
[ "$CONFIRM" = "RUN-DATA-SAFE-FAILBACK" ] || {
  echo "Execution refused. Set IZAKHONO_HA_RECONCILE_CONFIRM=RUN-DATA-SAFE-FAILBACK."
  exit 6
}
[ -n "$PRIMARY" ] && [ -n "$STANDBY" ] || { echo "Primary and standby SSH targets are required."; exit 7; }
[ -n "$ROUTE_SCRIPT" ] && [ -x "$ROUTE_SCRIPT" ] || {
  echo "Executable IZAKHONO_HA_ROUTE_ROLLBACK_SCRIPT is required."
  exit 8
}
for cmd in ssh node sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 9; }
done

remote(){
  local target="$1"; shift
  ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$target" "$@"
}

remote "$PRIMARY" "sudo -n true" >/dev/null 2>&1 || { echo "Primary sudo unavailable."; exit 10; }
remote "$STANDBY" "sudo -n true" >/dev/null 2>&1 || { echo "Standby sudo unavailable."; exit 11; }

PM="$(remote "$PRIMARY" "cat /etc/machine-id")"
SM="$(remote "$STANDBY" "cat /etc/machine-id")"
[ -n "$PM" ] && [ -n "$SM" ] && [ "$PM" != "$SM" ] || {
  echo "Reconciliation refused: primary and standby are not distinct machines."
  exit 12
}

PROMOTION="$(remote "$STANDBY" "sudo -n cat /var/lib/izakhono-deploy/proofs/standby-state-promoted.json")" || {
  echo "Standby live-state promotion proof is missing."
  exit 13
}
PROMOTION_OK="$(PROMOTION="$PROMOTION" node -e '
const x=JSON.parse(process.env.PROMOTION);
const ok=x.status==="PASS"&&x.state==="LIVE_STATE_PROMOTED"&&x.dns_changed===false&&x.public_route_changed===false;
process.stdout.write(String(ok));
')"
[ "$PROMOTION_OK" = "true" ] || { echo "Standby promotion proof is invalid."; exit 14; }

PRIMARY_ACTIVE="$(remote "$PRIMARY" "if systemctl is-active --quiet izakhono-edge-node || systemctl is-active --quiet izakhono-runtime-node; then echo yes; else echo no; fi")"
[ "$PRIMARY_ACTIVE" = "no" ] || {
  echo "Original primary is not fenced. EDGE/RUNTIME must remain stopped before reconciliation."
  exit 15
}

STANDBY_RUNTIME="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8790/health")" || { echo "Standby RUNTIME health failed."; exit 16; }
STANDBY_EDGE="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8795/health")" || { echo "Standby EDGE health failed."; exit 17; }

STANDBY_TOKEN="$(R="$STANDBY_RUNTIME" E="$STANDBY_EDGE" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
if(r.witness?.mode!=="enforce"||e.witness?.mode!=="enforce")process.exit(2);
if(r.witness?.leaseValid!==true||e.witness?.leaseValid!==true)process.exit(3);
if(r.witness?.receiptVerified!==true||e.witness?.receiptVerified!==true)process.exit(4);
if(!a||a!==b)process.exit(5);
process.stdout.write(String(a));
')" || { echo "Standby does not have matching verified WITNESS leadership."; exit 18; }

DRILL_TOKEN="$(DRILL="$DRILL" node -e 'process.stdout.write(String(JSON.parse(process.env.DRILL).standbyToken))')"
[ "$STANDBY_TOKEN" -ge "$DRILL_TOKEN" ] || { echo "Standby fencing token regressed."; exit 19; }

key_fingerprint(){
  local target="$1"
  remote "$target" "sudo -n awk -F= '\$1=="IZAKHONO_BACKUP_ENCRYPTION_KEY"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/backup-node.env | sha256sum | awk '{print \$1}'"
}
PRIMARY_KEY_HASH="$(key_fingerprint "$PRIMARY")"
STANDBY_KEY_HASH="$(key_fingerprint "$STANDBY")"
[ -n "$PRIMARY_KEY_HASH" ] && [ "$PRIMARY_KEY_HASH" = "$STANDBY_KEY_HASH" ] || {
  echo "Backup encryption-key lineage mismatch. Refusing handback snapshot."
  exit 20
}
unset PRIMARY_KEY_HASH STANDBY_KEY_HASH

QUIESCE_SERVICES=(
  izakhono-data-node
  izakhono-object-node
  izakhono-queue-node
  izakhono-auth-node
  izakhono-analytics-node
  izakhono-notify-node
  izakhono-ai-gateway-node
  izakhono-model-worker-node
  izakhono-mail-relay-adapter
  izakhono-code-node
  izakhono-package-node
  izakhono-ci-worker-node
  izakhono-replica-node
  izakhono-failover-node
)
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

ROUTE_SWITCHED=0
PRIMARY_MANIFEST=""
PRIMARY_STATE_APPLIED=0
PRIMARY_RUNTIME_STARTED=0
STANDBY_FROZEN=0

recover_before_route(){
  code=$?
  if [ "$code" -eq 0 ]; then return; fi
  if [ "$ROUTE_SWITCHED" -eq 0 ]; then
    echo "Reconciled failback failed before route switch. Attempting conservative recovery to standby..."
    if [ "$PRIMARY_RUNTIME_STARTED" -eq 1 ]; then
      remote "$PRIMARY" "sudo -n systemctl stop izakhono-edge-node izakhono-runtime-node" >/dev/null 2>&1 || true
    fi
    if [ "$PRIMARY_STATE_APPLIED" -eq 1 ] && [ -n "$PRIMARY_MANIFEST" ]; then
      remote "$PRIMARY" "sudo -n systemctl stop ${STATE_SERVICES[*]} >/dev/null 2>&1 || true; sudo -n node /opt/izakhono-owned-cloud/standby-state-swap.mjs rollback --manifest '$PRIMARY_MANIFEST' --promotion-root /var/lib/izakhono-failback/promotions >/dev/null 2>&1 || true; sudo -n systemctl start ${STATE_SERVICES[*]} >/dev/null 2>&1 || true" || true
    fi
    if [ "$STANDBY_FROZEN" -eq 1 ]; then
      remote "$STANDBY" "sudo -n systemctl start ${QUIESCE_SERVICES[*]} izakhono-runtime-node izakhono-edge-node >/dev/null 2>&1 || true" || true
    fi
    echo "Public route was not changed."
  else
    echo "Failure occurred after the route switch. No automatic reverse cutover attempted."
  fi
  exit "$code"
}
trap recover_before_route EXIT

echo "Freezing public writes and mutable standby services..."
remote "$STANDBY" "sudo -n systemctl stop izakhono-edge-node izakhono-runtime-node"
remote "$STANDBY" "sudo -n systemctl stop ${QUIESCE_SERVICES[*]}"
STANDBY_FROZEN=1

sleep 2
if remote "$STANDBY" "systemctl is-active --quiet izakhono-edge-node || systemctl is-active --quiet izakhono-runtime-node"; then
  echo "Standby public application path did not fence cleanly."
  exit 21
fi

echo "Creating fresh encrypted handback snapshot on frozen standby..."
SNAPSHOT="$(remote "$STANDBY" "sudo -n bash -s" <<'REMOTE'
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
)" || { echo "Fresh standby handback snapshot failed."; exit 22; }

ARCHIVE="$(SNAPSHOT="$SNAPSHOT" node -e 'process.stdout.write(JSON.parse(process.env.SNAPSHOT).path)')"
SHA="$(SNAPSHOT="$SNAPSHOT" node -e 'process.stdout.write(JSON.parse(process.env.SNAPSHOT).sha256)')"
SNAPSHOT_ID="$(SNAPSHOT="$SNAPSHOT" node -e 'process.stdout.write(JSON.parse(process.env.SNAPSHOT).id)')"
case "$ARCHIVE" in /var/lib/izakhono-backup/archives/*.izbk) ;; *) echo "Unsafe snapshot archive path."; exit 23;; esac
BASENAME="$(basename "$ARCHIVE")"
case "$BASENAME" in *[!A-Za-z0-9._-]*|'') echo "Unsafe snapshot filename."; exit 24;; esac

INCOMING="/var/lib/izakhono-failback/incoming/$BASENAME"
remote "$PRIMARY" "sudo -n mkdir -p /var/lib/izakhono-failback/incoming /var/lib/izakhono-failback/restores /var/lib/izakhono-failback/promotions && sudo -n chmod 0700 /var/lib/izakhono-failback /var/lib/izakhono-failback/incoming /var/lib/izakhono-failback/restores /var/lib/izakhono-failback/promotions"

echo "Streaming encrypted snapshot to original primary..."
ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$STANDBY" "sudo -n cat '$ARCHIVE'"   | ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$PRIMARY" "sudo -n tee '$INCOMING' >/dev/null"

REMOTE_SHA="$(remote "$PRIMARY" "sudo -n sha256sum '$INCOMING' | awk '{print \$1}'")"
[ "$REMOTE_SHA" = "$SHA" ] || { echo "Transferred handback archive SHA-256 mismatch."; exit 25; }

DEST_NAME="failback-${SNAPSHOT_ID//[^A-Za-z0-9._-]/-}"
echo "Restoring encrypted handback snapshot into isolated primary staging..."
RESTORE="$(remote "$PRIMARY" "sudo -n env IZAKHONO_STANDBY_RESTORE_ROOT=/var/lib/izakhono-failback/restores node /opt/izakhono-backup-node/scripts/restore-external.mjs --archive '$INCOMING' --expected-sha256 '$SHA' --recovery-key-file /etc/izakhono/backup-node.env --destination-name '$DEST_NAME'")" || {
  echo "Primary isolated restore failed."
  exit 26
}
STAGED_ROOT="$(RESTORE="$RESTORE" node -e 'const x=JSON.parse(process.env.RESTORE);if(x.status!=="STAGED"||x.liveDirectoriesModified!==false)process.exit(2);process.stdout.write(x.destination)')" || {
  echo "Primary restore receipt invalid."
  exit 27
}

echo "Stopping original primary state services before reconciled apply..."
remote "$PRIMARY" "sudo -n systemctl stop ${STATE_SERVICES[*]}"

APPLY="$(remote "$PRIMARY" "sudo -n node /opt/izakhono-owned-cloud/standby-state-swap.mjs apply --staged-root '$STAGED_ROOT' --promotion-root /var/lib/izakhono-failback/promotions")" || {
  echo "Primary reconciled state transaction failed."
  exit 28
}
PRIMARY_MANIFEST="$(APPLY="$APPLY" node -e 'const x=JSON.parse(process.env.APPLY);if(x.status!=="APPLIED")process.exit(2);process.stdout.write(x.manifest)')" || {
  echo "Primary state-transaction receipt invalid."
  exit 29
}
PRIMARY_STATE_APPLIED=1

remote "$PRIMARY" "sudo -n systemctl start ${STATE_SERVICES[*]}"

declare -A HEALTH=(
  [izakhono-data-node]=http://127.0.0.1:8787/health
  [izakhono-object-node]=http://127.0.0.1:8800/health
  [izakhono-queue-node]=http://127.0.0.1:8810/health
  [izakhono-auth-node]=http://127.0.0.1:8820/health
  [izakhono-analytics-node]=http://127.0.0.1:8830/health
  [izakhono-notify-node]=http://127.0.0.1:8840/health
  [izakhono-ai-gateway-node]=http://127.0.0.1:8850/health
  [izakhono-code-node]=http://127.0.0.1:8860/health
  [izakhono-backup-node]=http://127.0.0.1:8870/health
)
for service in "${STATE_SERVICES[@]}"; do
  url="${HEALTH[$service]}"
  ok=0
  for _ in $(seq 1 30); do
    body="$(remote "$PRIMARY" "curl -fsS --max-time 2 '$url'" 2>/dev/null || true)"
    if [ -n "$body" ] && BODY="$body" node -e 'const x=JSON.parse(process.env.BODY);if(x.status==="healthy")process.exit(0);process.exit(2)' 2>/dev/null; then
      ok=1; break
    fi
    sleep 1
  done
  [ "$ok" = "1" ] || { echo "Reconciled primary service unhealthy: $service"; exit 30; }
done

echo "Starting reconciled primary RUNTIME/EDGE to acquire newer WITNESS leadership..."
remote "$PRIMARY" "sudo -n systemctl start izakhono-runtime-node izakhono-edge-node"
PRIMARY_RUNTIME_STARTED=1

NEW_TOKEN=""
for _ in $(seq 1 60); do
  R="$(remote "$PRIMARY" "curl -fsS --max-time 3 http://127.0.0.1:8790/health" 2>/dev/null || true)"
  E="$(remote "$PRIMARY" "curl -fsS --max-time 3 http://127.0.0.1:8795/health" 2>/dev/null || true)"
  if [ -n "$R" ] && [ -n "$E" ]; then
    NEW_TOKEN="$(R="$R" E="$E" OLD="$STANDBY_TOKEN" node -e '
      const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E),old=Number(process.env.OLD);
      const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
      if(r.witness?.mode==="enforce"&&e.witness?.mode==="enforce"&&r.witness?.leaseValid===true&&e.witness?.leaseValid===true&&r.witness?.receiptVerified===true&&e.witness?.receiptVerified===true&&a&&a===b&&a>old)process.stdout.write(String(a));
    ' 2>/dev/null || true)"
    [ -n "$NEW_TOKEN" ] && break
  fi
  sleep 1
done
[ -n "$NEW_TOKEN" ] || { echo "Reconciled primary did not acquire newer verified WITNESS leadership."; exit 31; }

echo "Switching trusted route back to reconciled primary..."
IZAKHONO_FAILOVER_TARGET=primary IZAKHONO_FAILOVER_FENCING_TOKEN="$NEW_TOKEN" IZAKHONO_FAILOVER_PREVIOUS_TOKEN="$STANDBY_TOKEN" "$ROUTE_SCRIPT"
ROUTE_SWITCHED=1

PRIMARY_HASH="$(printf '%s' "$PM" | sha256sum | awk '{print $1}')"
STANDBY_HASH="$(printf '%s' "$SM" | sha256sum | awk '{print $1}')"

SNAPSHOT="$SNAPSHOT" RESTORE="$RESTORE" PRIMARY_HASH="$PRIMARY_HASH" STANDBY_HASH="$STANDBY_HASH" OLD_TOKEN="$STANDBY_TOKEN" NEW_TOKEN="$NEW_TOKEN" MANIFEST="$PRIMARY_MANIFEST" node - <<'NODE' >"$REPORT"
const snapshot=JSON.parse(process.env.SNAPSHOT);
const restore=JSON.parse(process.env.RESTORE);
const report={
  product:"IZAKHONO DATA-SAFE FAILBACK RECONCILIATION",
  status:"PASS",
  state:"PRIMARY_ACTIVE_RECONCILED",
  single_writer:true,
  multi_master_merge:false,
  write_freeze_performed:true,
  handback:{
    snapshot_id:snapshot.id,
    sha256:snapshot.sha256,
    encrypted_archive:true,
    transfer:"SSH_STREAM",
    primary_restore:restore.status
  },
  fencing:{
    standby_token:Number(process.env.OLD_TOKEN),
    primary_token:Number(process.env.NEW_TOKEN),
    monotonic:Number(process.env.NEW_TOKEN)>Number(process.env.OLD_TOKEN)
  },
  transaction:{
    manifest:process.env.MANIFEST,
    reversible_before_route:true
  },
  failure_domains:{
    primary_machine_sha256:process.env.PRIMARY_HASH,
    standby_machine_sha256:process.env.STANDBY_HASH,
    distinct:true
  },
  route_switched:true,
  data_reconciled:true,
  standby_stateful_services_stopped:true,
  standby_requires_rebaseline:true,
  automatic_failback:false,
  completed_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE
chmod 0600 "$REPORT"

node - "$DRILL_REPORT" "$NEW_TOKEN" "$REPORT" <<'NODE'
const fs=require("fs");
const path=process.argv[2],token=Number(process.argv[3]),reportPath=process.argv[4];
const x=JSON.parse(fs.readFileSync(path,"utf8"));
x.state="PRIMARY_ACTIVE_AFTER_RECONCILED_FAILBACK";
x.failback={
  status:"PASS",
  data_reconciled:true,
  route_switched:true,
  new_primary_fencing_token:token,
  reconciliation_report:reportPath,
  standby_requires_rebaseline:true,
  completed_at:new Date().toISOString()
};
x.next_gate="REBASELINE_STANDBY_FROM_PRIMARY";
fs.writeFileSync(path,JSON.stringify(x,null,2)+"\n",{mode:0o600});
NODE

trap - EXIT
echo "IZAKHONO DATA-SAFE FAILBACK RECONCILIATION: PASS"
echo "Primary is active with fencing token $NEW_TOKEN."
echo "Standby stateful services remain stopped pending re-baseline."
echo "Report: $REPORT"
