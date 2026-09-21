#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

ROLE="${1:-}"
MODE="${2:-}"

if [ "$ROLE" != "primary" ] && [ "$ROLE" != "standby" ]; then
  echo "Usage: sudo bash $0 <primary|standby> <observe|enforce>"
  exit 2
fi
if [ "$MODE" != "observe" ] && [ "$MODE" != "enforce" ]; then
  echo "Mode must be observe or enforce."
  exit 3
fi

RUNTIME_ENV=/etc/izakhono/runtime-node.env
EDGE_ENV=/etc/izakhono/edge-node.env
MEMBER_ENV=/etc/izakhono/witness-member/member.env
PUBLIC_KEY=/etc/izakhono/witness-member/public.pem

for file in "$RUNTIME_ENV" "$EDGE_ENV" "$MEMBER_ENV" "$PUBLIC_KEY"; do
  [ -f "$file" ] || { echo "Required witness enrollment file missing: $file"; exit 4; }
done

for cmd in node curl systemctl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 5; }
done

probe(){
  local url="$1"
  curl -fsS --max-time 5 "$url"
}

RUNTIME_BEFORE="$(probe http://127.0.0.1:8790/health)" || { echo "RUNTIME health unavailable."; exit 6; }
EDGE_BEFORE="$(probe http://127.0.0.1:8795/health)" || { echo "EDGE health unavailable."; exit 7; }

check_configured(){
  local body="$1"
  BODY="$body" node -e '
    const x=JSON.parse(process.env.BODY);
    if(x.witness?.configured!==true) process.exit(2);
    if(!["observe","enforce"].includes(x.witness?.mode)) process.exit(3);
  '
}
check_configured "$RUNTIME_BEFORE" || { echo "RUNTIME witness enrollment is not configured."; exit 8; }
check_configured "$EDGE_BEFORE" || { echo "EDGE witness enrollment is not configured."; exit 9; }

extract(){
  local body="$1"
  local js="$2"
  BODY="$body" node -e "const x=JSON.parse(process.env.BODY); $js"
}

RUNTIME_VALID="$(extract "$RUNTIME_BEFORE" 'process.stdout.write(String(Boolean(x.witness?.leaseValid)))')"
EDGE_VALID="$(extract "$EDGE_BEFORE" 'process.stdout.write(String(Boolean(x.witness?.leaseValid)))')"
RUNTIME_TOKEN="$(extract "$RUNTIME_BEFORE" 'process.stdout.write(String(x.witness?.fencingToken??""))')"
EDGE_TOKEN="$(extract "$EDGE_BEFORE" 'process.stdout.write(String(x.witness?.fencingToken??""))')"

if [ "$MODE" = "enforce" ] && [ "$ROLE" = "primary" ]; then
  if [ "$RUNTIME_VALID" != "true" ] || [ "$EDGE_VALID" != "true" ]; then
    echo "Refusing primary enforce mode without a valid signed witness lease in both RUNTIME and EDGE."
    exit 10
  fi
  if [ -z "$RUNTIME_TOKEN" ] || [ "$RUNTIME_TOKEN" != "$EDGE_TOKEN" ]; then
    echo "Refusing primary enforce mode because RUNTIME/EDGE fencing tokens do not agree."
    exit 11
  fi
fi

update_mode(){
  local target="$1"
  TARGET="$target" MODE="$MODE" node - <<'NODE'
const fs=require("fs");
const path=process.env.TARGET;
const mode=process.env.MODE;
const lines=fs.readFileSync(path,"utf8").split(/?
/).filter(Boolean);
let seen=false;
const out=lines.map(line=>{
  if(line.startsWith("#") || !line.includes("=")) return line;
  const key=line.split("=",1)[0].trim();
  if(key==="IZAKHONO_WITNESS_MODE"){
    seen=true;
    return "IZAKHONO_WITNESS_MODE="+mode;
  }
  return line;
});
if(!seen) out.push("IZAKHONO_WITNESS_MODE="+mode);
fs.writeFileSync(path,out.join("
")+"
",{mode:0o600});
NODE
  chmod 0600 "$target"
}

update_mode "$RUNTIME_ENV"
update_mode "$EDGE_ENV"

systemctl restart izakhono-runtime-node
systemctl restart izakhono-edge-node

wait_mode(){
  local url="$1"
  for _ in $(seq 1 30); do
    local body
    body="$(curl -fsS --max-time 2 "$url" 2>/dev/null || true)"
    if [ -n "$body" ]; then
      if BODY="$body" MODE="$MODE" node -e '
        const x=JSON.parse(process.env.BODY);
        const w=x.witness;
        if(w?.configured===true && w.mode===process.env.MODE) process.exit(0);
        process.exit(2);
      '; then
        printf '%s' "$body"
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

RUNTIME_AFTER="$(wait_mode http://127.0.0.1:8790/health)" || { echo "RUNTIME did not enter $MODE mode."; exit 12; }
EDGE_AFTER="$(wait_mode http://127.0.0.1:8795/health)" || { echo "EDGE did not enter $MODE mode."; exit 13; }

RUNTIME_VALID_AFTER="$(extract "$RUNTIME_AFTER" 'process.stdout.write(String(Boolean(x.witness?.leaseValid)))')"
EDGE_VALID_AFTER="$(extract "$EDGE_AFTER" 'process.stdout.write(String(Boolean(x.witness?.leaseValid)))')"
RUNTIME_TOKEN_AFTER="$(extract "$RUNTIME_AFTER" 'process.stdout.write(String(x.witness?.fencingToken??""))')"
EDGE_TOKEN_AFTER="$(extract "$EDGE_AFTER" 'process.stdout.write(String(x.witness?.fencingToken??""))')"

if [ "$MODE" = "enforce" ] && [ "$ROLE" = "primary" ]; then
  if [ "$RUNTIME_VALID_AFTER" != "true" ] || [ "$EDGE_VALID_AFTER" != "true" ] || [ -z "$RUNTIME_TOKEN_AFTER" ] || [ "$RUNTIME_TOKEN_AFTER" != "$EDGE_TOKEN_AFTER" ]; then
    echo "Primary enforce-mode post-restart lease proof failed. Reverting to observe."
    MODE=observe
    update_mode "$RUNTIME_ENV"
    update_mode "$EDGE_ENV"
    systemctl restart izakhono-runtime-node
    systemctl restart izakhono-edge-node
    exit 14
  fi
fi

STANDBY_BLOCK_PROVED=false
if [ "$MODE" = "enforce" ] && [ "$ROLE" = "standby" ] && [ "$RUNTIME_VALID_AFTER" != "true" ]; then
  STATUS="$(curl -sS -o /tmp/izakhono-witness-block-proof.$$ -w '%{http_code}'     -X POST -H 'Host: witness-proof.invalid'     http://127.0.0.1:8080/__witness-write-proof || true)"
  rm -f /tmp/izakhono-witness-block-proof.$$
  if [ "$STATUS" != "503" ]; then
    echo "Standby has no lease but RUNTIME did not fail closed on a write probe."
    exit 15
  fi
  STANDBY_BLOCK_PROVED=true
fi

REPORT_DIR=/var/lib/izakhono-deploy/proofs
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
REPORT="$REPORT_DIR/witness-$ROLE-$MODE.json"

ROLE="$ROLE" MODE="$MODE" RUNTIME_VALID="$RUNTIME_VALID_AFTER" EDGE_VALID="$EDGE_VALID_AFTER" RUNTIME_TOKEN="$RUNTIME_TOKEN_AFTER" EDGE_TOKEN="$EDGE_TOKEN_AFTER" STANDBY_BLOCK_PROVED="$STANDBY_BLOCK_PROVED" node - <<'NODE' >"$REPORT"
const report={
  product:"IZAKHONO WITNESS MODE",
  role:process.env.ROLE,
  mode:process.env.MODE,
  runtime:{
    configured:true,
    lease_valid:process.env.RUNTIME_VALID==="true",
    fencing_token:process.env.RUNTIME_TOKEN||null
  },
  edge:{
    configured:true,
    lease_valid:process.env.EDGE_VALID==="true",
    fencing_token:process.env.EDGE_TOKEN||null
  },
  write_fencing_enabled:process.env.MODE==="enforce",
  standby_fail_closed_probe:process.env.STANDBY_BLOCK_PROVED==="true",
  automatic_dns_failover_enabled:false,
  proved_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2));
NODE
chmod 0600 "$REPORT"

echo "IZAKHONO witness mode change: PASS"
echo "Role: $ROLE"
echo "Mode: $MODE"
if [ "$MODE" = "enforce" ]; then
  echo "Write fencing: ENABLED"
else
  echo "Write fencing: OBSERVE ONLY"
fi
echo "Automatic DNS failover: OFF"
echo "Report: $REPORT"
