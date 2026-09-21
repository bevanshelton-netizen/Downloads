#!/usr/bin/env bash
set -euo pipefail

DRILL_REPORT="${IZAKHONO_HA_DRILL_REPORT:-./IZAKHONO-CONTROLLED-FAILOVER-DRILL.json}"
PRIMARY="${IZAKHONO_HA_PRIMARY_SSH:-}"
STANDBY="${IZAKHONO_HA_STANDBY_SSH:-}"
ROUTE_SCRIPT="${IZAKHONO_HA_ROUTE_ROLLBACK_SCRIPT:-}"
CONFIRM="${IZAKHONO_HA_FAILBACK_CONFIRM:-}"

[ "$CONFIRM" = "RUN-CONTROLLED-FAILBACK" ] || {
  echo "Failback refused. Set IZAKHONO_HA_FAILBACK_CONFIRM=RUN-CONTROLLED-FAILBACK."
  exit 2
}
[ -f "$DRILL_REPORT" ] || { echo "Failover drill report missing."; exit 3; }
[ -n "$PRIMARY" ] && [ -n "$STANDBY" ] || { echo "Primary and standby SSH targets are required."; exit 4; }
[ -n "$ROUTE_SCRIPT" ] && [ -x "$ROUTE_SCRIPT" ] || { echo "Executable IZAKHONO_HA_ROUTE_ROLLBACK_SCRIPT is required."; exit 5; }

OLD_ACTIVE_TOKEN="$(node - "$DRILL_REPORT" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.status!=="PASS"||x.state!=="STANDBY_ACTIVE"||x.route_switched!==true||x.primary_fenced!==true)process.exit(2);
process.stdout.write(String(x.fencing?.active||""));
NODE
)" || { echo "Drill report does not authorize failback."; exit 6; }

remote(){
  local target="$1"; shift
  ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$target" "$@"
}

remote "$PRIMARY" "sudo -n true" >/dev/null 2>&1 || { echo "Primary sudo unavailable."; exit 7; }
remote "$STANDBY" "sudo -n true" >/dev/null 2>&1 || { echo "Standby sudo unavailable."; exit 8; }

echo "Fencing standby before primary reacquisition..."
remote "$STANDBY" "sudo -n systemctl stop izakhono-edge-node izakhono-runtime-node"

echo "Starting original primary..."
remote "$PRIMARY" "sudo -n systemctl start izakhono-runtime-node izakhono-edge-node"

NEW_TOKEN=""
for _ in $(seq 1 45); do
  R="$(remote "$PRIMARY" "curl -fsS --max-time 3 http://127.0.0.1:8790/health" 2>/dev/null || true)"
  E="$(remote "$PRIMARY" "curl -fsS --max-time 3 http://127.0.0.1:8795/health" 2>/dev/null || true)"
  if [ -n "$R" ] && [ -n "$E" ]; then
    NEW_TOKEN="$(R="$R" E="$E" OLD="$OLD_ACTIVE_TOKEN" node -e '
      const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E),old=Number(process.env.OLD);
      const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
      if(r.witness?.leaseValid===true&&e.witness?.leaseValid===true&&a&&a===b&&a>old)process.stdout.write(String(a));
    ' 2>/dev/null || true)"
    [ -n "$NEW_TOKEN" ] && break
  fi
  sleep 1
done

[ -n "$NEW_TOKEN" ] || {
  echo "Original primary did not reacquire a newer witness token. Route remains on fenced standby; manual intervention required."
  exit 9
}

IZAKHONO_FAILOVER_TARGET=primary IZAKHONO_FAILOVER_FENCING_TOKEN="$NEW_TOKEN" IZAKHONO_FAILOVER_PREVIOUS_TOKEN="$OLD_ACTIVE_TOKEN" "$ROUTE_SCRIPT"

remote "$STANDBY" "sudo -n systemctl start izakhono-runtime-node izakhono-edge-node"

R2="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8790/health")"
E2="$(remote "$STANDBY" "curl -fsS --max-time 5 http://127.0.0.1:8795/health")"
BLOCKED="$(R="$R2" E="$E2" node -e '
const r=JSON.parse(process.env.R),e=JSON.parse(process.env.E);
process.stdout.write(String(r.witness?.leaseValid!==true&&e.witness?.leaseValid!==true));
')"
[ "$BLOCKED" = "true" ] || {
  echo "Standby unexpectedly retained leadership after failback."
  exit 10
}

node - "$DRILL_REPORT" "$NEW_TOKEN" <<'NODE'
const fs=require("fs");
const path=process.argv[2],token=Number(process.argv[3]);
const x=JSON.parse(fs.readFileSync(path,"utf8"));
x.state="PRIMARY_ACTIVE_AFTER_FAILBACK";
x.failback={status:"PASS",route_switched:true,new_primary_fencing_token:token,completed_at:new Date().toISOString()};
x.next_gate="POST_DRILL_REVIEW";
fs.writeFileSync(path,JSON.stringify(x,null,2)+"\n",{mode:0o600});
NODE

echo "IZAKHONO CONTROLLED FAILBACK: PASS"
echo "Original primary is active with fencing token $NEW_TOKEN."
echo "Standby is running but has no leadership lease."
echo "Report updated: $DRILL_REPORT"
