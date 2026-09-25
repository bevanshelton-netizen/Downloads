#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

MODE="${1:-status}"
CONFIRM="${IZAKHONO_STANDBY_ROLE_CONFIRM:-}"
EXPECTED_TOKEN="${IZAKHONO_STANDBY_ROLE_FENCING_TOKEN:-}"
REPORT=/var/lib/izakhono-deploy/proofs/standby-service-role.json

MUTATORS=(
  izakhono-ci-worker-node
  izakhono-notify-node
  izakhono-backup-node
  izakhono-model-worker-node
  izakhono-gpu-compute-node
  izakhono-mail-relay-adapter
)

mkdir -p "$(dirname "$REPORT")"
chmod 0700 "$(dirname "$REPORT")"

unit_state(){
  if systemctl is-active --quiet "$1" 2>/dev/null; then echo active; else echo inactive; fi
}

witness_state(){
  local r="" e=""
  r="$(curl -fsS --max-time 3 http://127.0.0.1:8790/health 2>/dev/null || true)"
  e="$(curl -fsS --max-time 3 http://127.0.0.1:8795/health 2>/dev/null || true)"
  R="$r" E="$e" node - <<'NODE'
function parse(v){try{return JSON.parse(v)}catch{return null}}
const r=parse(process.env.R),e=parse(process.env.E);
if(!r||!e){
  process.stdout.write(JSON.stringify({runtime:false,edge:false,authority:false,token:null,receiptVerified:false}));
  process.exit(0);
}
const a=Number(r.witness?.fencingToken),b=Number(e.witness?.fencingToken);
const authority=r.witness?.mode==="enforce"
  && e.witness?.mode==="enforce"
  && r.witness?.leaseValid===true
  && e.witness?.leaseValid===true
  && r.witness?.receiptVerified===true
  && e.witness?.receiptVerified===true
  && a>0 && a===b;
process.stdout.write(JSON.stringify({
  runtime:true,edge:true,authority,token:a===b&&a>0?a:null,
  receiptVerified:r.witness?.receiptVerified===true&&e.witness?.receiptVerified===true,
  runtimeLease:r.witness?.leaseValid===true,
  edgeLease:e.witness?.leaseValid===true
}));
NODE
}

write_report(){
  local role="$1" token="$2" stopped="$3" active="$4"
  ROLE="$role" TOKEN="$token" STOPPED="$stopped" ACTIVE="$active" node - <<'NODE' >"$REPORT"
const token=process.env.TOKEN?Number(process.env.TOKEN):null;
const report={
  product:"IZAKHONO STANDBY SERVICE ROLE",
  status:"PASS",
  role:process.env.ROLE,
  mutators:[
    "izakhono-ci-worker-node",
    "izakhono-notify-node",
    "izakhono-backup-node",
    "izakhono-model-worker-node",
    "izakhono-gpu-compute-node",
    "izakhono-mail-relay-adapter"
  ],
  mutators_stopped:process.env.STOPPED==="true",
  mutators_active:process.env.ACTIVE==="true",
  witness_fencing_token:token,
  automatic_activation:false,
  updated_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE
  chmod 0600 "$REPORT"
}

case "$MODE" in
  passive)
    STATE="$(witness_state)"
    HAS_AUTHORITY="$(STATE="$STATE" node -e 'process.stdout.write(String(JSON.parse(process.env.STATE).authority===true))')"
    if [ "$HAS_AUTHORITY" = "true" ]; then
      echo "Refusing PASSIVE transition while this standby still holds WITNESS leadership. Fence/release leadership first."
      exit 2
    fi
    systemctl stop "${MUTATORS[@]}" >/dev/null 2>&1 || true
    for svc in "${MUTATORS[@]}"; do
      [ "$(unit_state "$svc")" = "inactive" ] || { echo "Mutator did not stop: $svc"; exit 3; }
    done
    write_report PASSIVE "" true false
    echo "IZAKHONO STANDBY ROLE: PASSIVE"
    echo "Autonomous mutators: STOPPED"
    ;;
  active)
    [ "$CONFIRM" = "ACTIVATE-WITH-WITNESS" ] || {
      echo "Activation refused. Set IZAKHONO_STANDBY_ROLE_CONFIRM=ACTIVATE-WITH-WITNESS."
      exit 4
    }
    STATE="$(witness_state)"
    AUTHORITY="$(STATE="$STATE" node -e 'const x=JSON.parse(process.env.STATE);process.stdout.write(String(x.authority===true))')"
    TOKEN="$(STATE="$STATE" node -e 'const x=JSON.parse(process.env.STATE);process.stdout.write(x.token?String(x.token):"")')"
    [ "$AUTHORITY" = "true" ] && [ -n "$TOKEN" ] || {
      echo "Activation refused: matching verified WITNESS leadership is required in RUNTIME and EDGE."
      exit 5
    }
    if [ -n "$EXPECTED_TOKEN" ] && [ "$TOKEN" != "$EXPECTED_TOKEN" ]; then
      echo "Activation refused: live fencing token does not match expected token."
      exit 6
    fi
    systemctl start "${MUTATORS[@]}"
    for svc in "${MUTATORS[@]}"; do
      [ "$(unit_state "$svc")" = "active" ] || { echo "Mutator did not start: $svc"; exit 7; }
    done
    write_report ACTIVE "$TOKEN" false true
    echo "IZAKHONO STANDBY ROLE: ACTIVE"
    echo "WITNESS fencing token: $TOKEN"
    ;;
  status)
    if [ -f "$REPORT" ]; then
      cat "$REPORT"
    else
      echo '{"status":"UNSET","role":"UNKNOWN"}'
    fi
    ;;
  *)
    echo "Usage: $0 [passive|active|status]"
    exit 8
    ;;
esac
