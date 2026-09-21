#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"
PROOF="${IZAKHONO_HA_PROOF:-./IZAKHONO-PHYSICAL-HA-PROOF.json}"
PRIMARY="${IZAKHONO_HA_PRIMARY_SSH:-}"
STANDBY="${IZAKHONO_HA_STANDBY_SSH:-}"
WITNESS="${IZAKHONO_HA_WITNESS_SSH:-}"
ROUTE_SCRIPT="${IZAKHONO_HA_ROUTE_SWITCH_SCRIPT:-}"
CONFIRM="${IZAKHONO_HA_DRILL_CONFIRM:-}"
REPORT="${IZAKHONO_HA_DRILL_REPORT:-./IZAKHONO-CONTROLLED-FAILOVER-DRILL.json}"

[ -f "$PROOF" ] || { echo "Physical HA proof not found: $PROOF"; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required."; exit 3; }

PROOF_STATUS="$(node - "$PROOF" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.status!=="PASS" || x.certification!=="READY_FOR_CONTROLLED_FAILOVER_DRILL" || x.destructive_cutover_performed!==false) process.exit(2);
process.stdout.write(JSON.stringify({
  status:x.status,
  certification:x.certification,
  primaryToken:Number(x.witness?.primary_fencing_token||0),
  clusterId:x.witness?.cluster_id||null,
  witnessUrl:x.witness?.url||null,
  standbyState:x.standby?.state||null,
  standbyFailClosed:x.standby?.writes_fail_closed_without_lease===true,
  fortress:x.primary?.fortress||null
}));
NODE
)" || { echo "Physical HA proof does not authorize a controlled drill."; exit 4; }

if [ "$MODE" = "plan" ]; then
  PROOF_STATUS="$PROOF_STATUS" node - <<'NODE'
const p=JSON.parse(process.env.PROOF_STATUS);
const plan={
  product:"IZAKHONO CONTROLLED FAILOVER DRILL",
  mode:"PLAN_ONLY",
  authorized_by_physical_ha_proof:true,
  cluster_id:p.clusterId,
  current_primary_fencing_token:p.primaryToken,
  prerequisites:{
    standby_prepared:p.standbyState==="PREPARED",
    standby_write_fencing:p.standbyFailClosed,
    fortress_healthy:p.fortress==="healthy"
  },
  sequence:[
    "Revalidate three distinct hosts and live witness enforcement",
    "Fence primary by stopping EDGE and RUNTIME",
    "Wait for standby RUNTIME and EDGE to acquire the same newer witness fencing token",
    "Invoke trusted route-switch script toward standby",
    "Verify standby read health and protected-write authority",
    "Write failover-drill evidence report",
    "Failback remains a separate explicit operation"
  ],
  destructive_actions_performed:false,
  route_change_performed:false
};
process.stdout.write(JSON.stringify(plan,null,2)+"\n");
NODE
  exit 0
fi

[ "$MODE" = "execute" ] || { echo "Usage: $0 [plan|execute]"; exit 5; }
[ "$CONFIRM" = "RUN-CONTROLLED-FAILOVER" ] || {
  echo "Execution refused. Set IZAKHONO_HA_DRILL_CONFIRM=RUN-CONTROLLED-FAILOVER."
  exit 6
}
[ -n "$PRIMARY" ] && [ -n "$STANDBY" ] && [ -n "$WITNESS" ] || {
  echo "Primary, standby and witness SSH targets are required."
  exit 7
}
[ -n "$ROUTE_SCRIPT" ] && [ -x "$ROUTE_SCRIPT" ] || {
  echo "IZAKHONO_HA_ROUTE_SWITCH_SCRIPT must point to an executable trusted script."
  exit 8
}

for cmd in ssh node sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 9; }
done

remote(){
  local target="$1"; shift
  ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$target" "$@"
}

for pair in "PRIMARY:$PRIMARY" "STANDBY:$STANDBY" "WITNESS:$WITNESS"; do
  label="${pair%%:*}"; target="${pair#*:}"
  remote "$target" "sudo -n true" >/dev/null 2>&1 || {
    echo "$label SSH target does not permit non-interactive sudo."
    exit 10
  }
done

PM="$(remote "$PRIMARY" "cat /etc/machine-id")"
SM="$(remote "$STANDBY" "cat /etc/machine-id")"
WM="$(remote "$WITNESS" "cat /etc/machine-id")"
[ "$PM" != "$SM" ] && [ "$PM" != "$WM" ] && [ "$SM" != "$WM" ] || {
  echo "Execution refused: HA hosts are not three distinct machines."
  exit 11
}

health(){
  local target="$1" url="$2"
  remote "$target" "curl -fsS --max-time 5 '$url'"
}

PRIMARY_RUNTIME="$(health "$PRIMARY" http://127.0.0.1:8790/health)" || { echo "Primary RUNTIME unhealthy."; exit 12; }
PRIMARY_EDGE="$(health "$PRIMARY" http://127.0.0.1:8795/health)" || { echo "Primary EDGE unhealthy."; exit 13; }
STANDBY_RUNTIME="$(health "$STANDBY" http://127.0.0.1:8790/health)" || { echo "Standby RUNTIME unhealthy."; exit 14; }
STANDBY_EDGE="$(health "$STANDBY" http://127.0.0.1:8795/health)" || { echo "Standby EDGE unhealthy."; exit 15; }

PRIMARY_TOKEN="$(R="$PRIMARY_RUNTIME" E="$PRIMARY_EDGE" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
if(r.witness?.mode!=="enforce"||e.witness?.mode!=="enforce")process.exit(2);
if(r.witness?.leaseValid!==true||e.witness?.leaseValid!==true)process.exit(3);
const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
if(!a||a!==b)process.exit(4);
process.stdout.write(String(a));
')" || { echo "Primary witness authority is not valid in both RUNTIME and EDGE."; exit 16; }

S_OK="$(R="$STANDBY_RUNTIME" E="$STANDBY_EDGE" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
const ok=r.witness?.mode==="enforce"&&e.witness?.mode==="enforce"&&r.witness?.leaseValid!==true&&e.witness?.leaseValid!==true;
process.stdout.write(String(ok));
')"
[ "$S_OK" = "true" ] || { echo "Standby is not fail-closed without leadership."; exit 17; }

ROUTE_SWITCHED=0
FENCED=0
recover_pre_route(){
  code=$?
  if [ "$code" -eq 0 ]; then return; fi
  if [ "$ROUTE_SWITCHED" -eq 0 ] && [ "$FENCED" -eq 1 ]; then
    echo "Drill failed before route switch. Attempting conservative recovery to original primary..."
    remote "$STANDBY" "sudo -n systemctl stop izakhono-edge-node izakhono-runtime-node" >/dev/null 2>&1 || true
    remote "$PRIMARY" "sudo -n systemctl start izakhono-runtime-node izakhono-edge-node" >/dev/null 2>&1 || true
  else
    echo "Drill stopped after route switch or before fencing state was known. No automatic failback attempted."
  fi
  exit "$code"
}
trap recover_pre_route EXIT

echo "Fencing primary application path..."
remote "$PRIMARY" "sudo -n systemctl stop izakhono-edge-node izakhono-runtime-node"
FENCED=1

NEW_TOKEN=""
for _ in $(seq 1 45); do
  SR="$(health "$STANDBY" http://127.0.0.1:8790/health 2>/dev/null || true)"
  SE="$(health "$STANDBY" http://127.0.0.1:8795/health 2>/dev/null || true)"
  if [ -n "$SR" ] && [ -n "$SE" ]; then
    NEW_TOKEN="$(R="$SR" E="$SE" OLD="$PRIMARY_TOKEN" node -e '
      const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E),old=Number(process.env.OLD);
      const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
      if(r.witness?.mode==="enforce"&&e.witness?.mode==="enforce"&&r.witness?.leaseValid===true&&e.witness?.leaseValid===true&&a&&a===b&&a>old) process.stdout.write(String(a));
    ' 2>/dev/null || true)"
    [ -n "$NEW_TOKEN" ] && break
  fi
  sleep 1
done

[ -n "$NEW_TOKEN" ] || { echo "Standby did not acquire matching newer witness authority. Route remains unchanged."; exit 18; }
echo "Standby leadership verified with fencing token $NEW_TOKEN."

IZAKHONO_FAILOVER_TARGET=standby IZAKHONO_FAILOVER_FENCING_TOKEN="$NEW_TOKEN" IZAKHONO_FAILOVER_PREVIOUS_TOKEN="$PRIMARY_TOKEN" "$ROUTE_SCRIPT"
ROUTE_SWITCHED=1

SR="$(health "$STANDBY" http://127.0.0.1:8790/health)"
SE="$(health "$STANDBY" http://127.0.0.1:8795/health)"
FINAL_OK="$(R="$SR" E="$SE" T="$NEW_TOKEN" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E),t=Number(process.env.T);
const ok=r.witness?.leaseValid===true&&e.witness?.leaseValid===true&&Number(r.witness?.fencingToken)===t&&Number(e.witness?.fencingToken)===t;
process.stdout.write(String(ok));
')"
[ "$FINAL_OK" = "true" ] || { echo "Standby lost authority after route switch."; exit 19; }

PRIMARY_HASH="$(printf '%s' "$PM" | sha256sum | awk '{print $1}')"
STANDBY_HASH="$(printf '%s' "$SM" | sha256sum | awk '{print $1}')"
WITNESS_HASH="$(printf '%s' "$WM" | sha256sum | awk '{print $1}')"

PRIMARY_HASH="$PRIMARY_HASH" STANDBY_HASH="$STANDBY_HASH" WITNESS_HASH="$WITNESS_HASH" OLD_TOKEN="$PRIMARY_TOKEN" NEW_TOKEN="$NEW_TOKEN" PROOF_STATUS="$PROOF_STATUS" node - <<'NODE' >"$REPORT"
const p=JSON.parse(process.env.PROOF_STATUS);
const report={
  product:"IZAKHONO CONTROLLED FAILOVER DRILL",
  status:"PASS",
  state:"STANDBY_ACTIVE",
  route_switched:true,
  primary_fenced:true,
  automatic_failback:false,
  cluster_id:p.clusterId,
  fencing:{previous:Number(process.env.OLD_TOKEN),active:Number(process.env.NEW_TOKEN),monotonic:Number(process.env.NEW_TOKEN)>Number(process.env.OLD_TOKEN)},
  failure_domains:{primary_machine_sha256:process.env.PRIMARY_HASH,standby_machine_sha256:process.env.STANDBY_HASH,witness_machine_sha256:process.env.WITNESS_HASH,distinct:true},
  next_gate:"EXPLICIT_CONTROLLED_FAILBACK",
  completed_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE
chmod 0600 "$REPORT"
trap - EXIT

echo "IZAKHONO CONTROLLED FAILOVER DRILL: PASS"
echo "Standby is active."
echo "Automatic failback: OFF"
echo "Report: $REPORT"
