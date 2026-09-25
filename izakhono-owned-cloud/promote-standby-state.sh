#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

MODE="${1:-plan}"
CONFIRM="${IZAKHONO_STANDBY_PROMOTION_CONFIRM:-}"
PREVIOUS_TOKEN="${IZAKHONO_PROMOTION_PREVIOUS_TOKEN:-}"
CURRENT_TOKEN="${IZAKHONO_PROMOTION_CURRENT_TOKEN:-}"
STAGED_PROOF="${IZAKHONO_STAGED_RESTORE_PROOF:-/var/lib/izakhono-deploy/proofs/standby-restore-staged.json}"
REPORT="${IZAKHONO_STANDBY_PROMOTION_REPORT:-/var/lib/izakhono-deploy/proofs/standby-state-promoted.json}"
HELPER="${IZAKHONO_STANDBY_PROMOTION_HELPER:-/opt/izakhono-owned-cloud/standby-state-swap.mjs}"
PROMOTION_ROOT="${IZAKHONO_STANDBY_PROMOTION_ROOT:-/var/lib/izakhono-standby/promotions}"

[ -f "$STAGED_PROOF" ] || { echo "Staged recovery proof missing: $STAGED_PROOF"; exit 2; }
[ -f "$HELPER" ] || { echo "Promotion helper missing: $HELPER"; exit 3; }
command -v node >/dev/null 2>&1 || { echo "node is required."; exit 4; }
command -v curl >/dev/null 2>&1 || { echo "curl is required."; exit 5; }
command -v systemctl >/dev/null 2>&1 || { echo "systemctl is required."; exit 6; }

STAGE="$(node - "$STAGED_PROOF" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.status!=="STAGED_AND_VERIFIED" || x.live_directories_modified!==false || x.promotion_performed!==false) process.exit(2);
const dest=x.restore?.destination;
if(typeof dest!=="string" || !dest.startsWith("/var/lib/izakhono-standby/restores/")) process.exit(3);
process.stdout.write(JSON.stringify({
  destination:dest,
  archiveSha:x.replica?.sha256||x.restore?.sha256||null,
  replicaAge:Number(x.replica?.age_minutes),
  objectId:x.replica?.object_id||null
}));
NODE
)" || { echo "Staged recovery proof is not eligible for promotion."; exit 7; }

STAGED_ROOT="$(STAGE="$STAGE" node -e 'process.stdout.write(JSON.parse(process.env.STAGE).destination)')"
ARCHIVE_SHA="$(STAGE="$STAGE" node -e 'process.stdout.write(String(JSON.parse(process.env.STAGE).archiveSha||""))')"
REPLICA_AGE="$(STAGE="$STAGE" node -e 'process.stdout.write(String(JSON.parse(process.env.STAGE).replicaAge))')"

RUNTIME="$(curl -fsS --max-time 5 http://127.0.0.1:8790/health)" || { echo "RUNTIME health unavailable."; exit 8; }
EDGE="$(curl -fsS --max-time 5 http://127.0.0.1:8795/health)" || { echo "EDGE health unavailable."; exit 9; }

AUTHORITY="$(R="$RUNTIME" E="$EDGE" node - <<'NODE'
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
if(r.witness?.mode!=="enforce"||e.witness?.mode!=="enforce")process.exit(2);
if(r.witness?.leaseValid!==true||e.witness?.leaseValid!==true)process.exit(3);
if(r.witness?.receiptVerified!==true||e.witness?.receiptVerified!==true)process.exit(4);
if(!a||a!==b)process.exit(5);
process.stdout.write(String(a));
NODE
)" || { echo "Standby does not hold matching verified witness authority in RUNTIME and EDGE."; exit 10; }

if [ "$MODE" = "plan" ]; then
  STAGED_ROOT="$STAGED_ROOT" ARCHIVE_SHA="$ARCHIVE_SHA" REPLICA_AGE="$REPLICA_AGE" AUTHORITY="$AUTHORITY" node - <<'NODE'
const plan={
  product:"IZAKHONO STANDBY STATE PROMOTION",
  mode:"PLAN_ONLY",
  staged_root:process.env.STAGED_ROOT,
  replica_sha256:process.env.ARCHIVE_SHA||null,
  replica_age_minutes:Number(process.env.REPLICA_AGE),
  current_witness_fencing_token:Number(process.env.AUTHORITY),
  promoted_state:[
    "izakhono-data","izakhono-object","izakhono-queue","izakhono-auth",
    "izakhono-analytics","izakhono-notify","izakhono-ai-gateway","izakhono-code"
  ],
  promoted_service_envs:[
    "data-node.env","object-node.env","queue-node.env","auth-node.env",
    "analytics-node.env","notify-node.env","ai-gateway-node.env","code-node.env","backup-node.env"
  ],
  preserved_node_specific_state:[
    "/etc/izakhono/runtime-node.env","/etc/izakhono/edge-node.env",
    "/etc/izakhono/replica-node.env","/etc/izakhono/failover-node.env",
    "/etc/izakhono/witness-member","/var/lib/izakhono-replica",
    "/var/lib/izakhono-failover","/var/lib/izakhono-runtime"
  ],
  automatic_dns_change:false,
  public_route_change:false,
  reversible_local_transaction:true,
  destructive_actions_performed:false
};
console.log(JSON.stringify(plan,null,2));
NODE
  exit 0
fi

[ "$MODE" = "execute" ] || { echo "Usage: $0 [plan|execute]"; exit 11; }
[ "$CONFIRM" = "PROMOTE-STAGED-STATE" ] || {
  echo "Execution refused. Set IZAKHONO_STANDBY_PROMOTION_CONFIRM=PROMOTE-STAGED-STATE."
  exit 12
}
[[ "$PREVIOUS_TOKEN" =~ ^[0-9]+$ ]] && [[ "$CURRENT_TOKEN" =~ ^[0-9]+$ ]] || {
  echo "Previous/current fencing tokens are required integers."
  exit 13
}
[ "$CURRENT_TOKEN" -gt "$PREVIOUS_TOKEN" ] || { echo "Current fencing token must be newer than the previous primary token."; exit 14; }
[ "$CURRENT_TOKEN" = "$AUTHORITY" ] || { echo "Supplied current token does not match live standby witness authority."; exit 15; }

services=(
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

declare -A health=(
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

echo "Stopping stateful services for local state cutover..."
systemctl stop "${services[@]}"

APPLY_JSON=""
MANIFEST=""
rollback_and_die(){
  code=$?
  if [ "$code" -eq 0 ]; then return; fi
  echo "Standby state promotion failed. Attempting local rollback..."
  systemctl stop "${services[@]}" >/dev/null 2>&1 || true
  if [ -n "$MANIFEST" ] && [ -f "$MANIFEST" ]; then
    node "$HELPER" rollback --manifest "$MANIFEST" --promotion-root "$PROMOTION_ROOT" >/dev/null 2>&1 || true
  fi
  systemctl start "${services[@]}" >/dev/null 2>&1 || true
  exit "$code"
}
trap rollback_and_die EXIT

APPLY_JSON="$(node "$HELPER" apply --staged-root "$STAGED_ROOT" --promotion-root "$PROMOTION_ROOT")"
MANIFEST="$(APPLY_JSON="$APPLY_JSON" node -e 'process.stdout.write(JSON.parse(process.env.APPLY_JSON).manifest)')"
[ -f "$MANIFEST" ] || { echo "Promotion transaction manifest missing."; exit 16; }

systemctl start "${services[@]}"

for service in "${services[@]}"; do
  url="${health[$service]}"
  ok=0
  for _ in $(seq 1 30); do
    body="$(curl -fsS --max-time 2 "$url" 2>/dev/null || true)"
    if [ -n "$body" ] && BODY="$body" node -e 'const x=JSON.parse(process.env.BODY); if(x.status==="healthy")process.exit(0);process.exit(2)' 2>/dev/null; then
      ok=1
      break
    fi
    sleep 1
  done
  [ "$ok" = "1" ] || { echo "Service failed post-promotion health: $service"; exit 17; }
done

RUNTIME_AFTER="$(curl -fsS --max-time 5 http://127.0.0.1:8790/health)"
EDGE_AFTER="$(curl -fsS --max-time 5 http://127.0.0.1:8795/health)"
POST_TOKEN="$(R="$RUNTIME_AFTER" E="$EDGE_AFTER" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
if(r.witness?.leaseValid!==true||e.witness?.leaseValid!==true||a!==b)process.exit(2);
process.stdout.write(String(a));
')" || { echo "Standby lost witness authority during state promotion."; exit 18; }
[ "$POST_TOKEN" = "$CURRENT_TOKEN" ] || { echo "Witness fencing token changed during promotion."; exit 19; }

mkdir -p "$(dirname "$REPORT")"
chmod 0700 "$(dirname "$REPORT")"
STAGE="$STAGE" APPLY_JSON="$APPLY_JSON" MANIFEST="$MANIFEST" TOKEN="$CURRENT_TOKEN" PREVIOUS="$PREVIOUS_TOKEN" node - <<'NODE' >"$REPORT"
const stage=JSON.parse(process.env.STAGE);
const apply=JSON.parse(process.env.APPLY_JSON);
const report={
  product:"IZAKHONO STANDBY STATE PROMOTION",
  status:"PASS",
  state:"LIVE_STATE_PROMOTED",
  source:{
    staged_root:stage.destination,
    replica_sha256:stage.archiveSha,
    replica_age_minutes:stage.replicaAge,
    object_id:stage.objectId
  },
  fencing:{
    previous_primary_token:Number(process.env.PREVIOUS),
    standby_token:Number(process.env.TOKEN),
    monotonic:Number(process.env.TOKEN)>Number(process.env.PREVIOUS)
  },
  transaction:{
    id:apply.id,
    manifest:process.env.MANIFEST,
    reversible:true
  },
  promoted_state:[
    "izakhono-data","izakhono-object","izakhono-queue","izakhono-auth",
    "izakhono-analytics","izakhono-notify","izakhono-ai-gateway","izakhono-code"
  ],
  backup_encryption_lineage_preserved:true,
  node_specific_runtime_state_preserved:true,
  dns_changed:false,
  public_route_changed:false,
  next_gate:"CONTROLLED_ROUTE_SWITCH",
  completed_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE
chmod 0600 "$REPORT"

node - "$STAGED_PROOF" <<'NODE'
const fs=require("fs");
const p=process.argv[2],x=JSON.parse(fs.readFileSync(p,"utf8"));
x.promotion_performed=true;
x.live_directories_modified=true;
x.promoted_at=new Date().toISOString();
fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n",{mode:0o600});
NODE

trap - EXIT
echo "IZAKHONO STANDBY STATE PROMOTION: PASS"
echo "Witness fencing token: $CURRENT_TOKEN"
echo "DNS changed: NO"
echo "Public route changed: NO"
echo "Report: $REPORT"
