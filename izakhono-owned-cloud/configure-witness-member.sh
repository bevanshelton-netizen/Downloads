#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

ROLE="${1:-}"
CREDENTIAL_FILE="${2:-}"
PUBLIC_KEY_JSON="${3:-}"

if [ "$ROLE" != "primary" ] && [ "$ROLE" != "standby" ]; then
  echo "Usage: sudo bash $0 <primary|standby> <member.env> <public-key.json>"
  exit 2
fi
[ -f "$CREDENTIAL_FILE" ] || { echo "Member credential file not found."; exit 3; }
[ -f "$PUBLIC_KEY_JSON" ] || { echo "Witness public-key JSON not found."; exit 4; }
[ -f /etc/izakhono/runtime-node.env ] || { echo "RUNTIME NODE is not installed."; exit 5; }
[ -f /etc/izakhono/edge-node.env ] || { echo "EDGE NODE is not installed."; exit 6; }

for cmd in node curl systemctl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 7; }
done

read_value(){
  local key="$1"
  awk -F= -v target="$key" '$1==target {sub(/^[^=]*=/,""); print; exit}' "$CREDENTIAL_FILE"
}

WITNESS_URL="$(read_value IZAKHONO_WITNESS_URL)"
CLUSTER_ID="$(read_value IZAKHONO_WITNESS_CLUSTER_ID)"
MEMBER_ID="$(read_value IZAKHONO_WITNESS_MEMBER_ID)"
MEMBER_KEY="$(read_value IZAKHONO_WITNESS_MEMBER_KEY)"

[ -n "$WITNESS_URL" ] || { echo "Witness URL missing from credential file."; exit 8; }
[ -n "$CLUSTER_ID" ] || { echo "Cluster ID missing from credential file."; exit 9; }
[ -n "$MEMBER_ID" ] || { echo "Member ID missing from credential file."; exit 10; }
[ -n "$MEMBER_KEY" ] || { echo "Member key missing from credential file."; exit 11; }

WITNESS_HOST="$(WITNESS_URL="$WITNESS_URL" node -e '
  const u=new URL(process.env.WITNESS_URL);
  if(!["http:","https:"].includes(u.protocol) || u.username || u.password || u.hash) process.exit(2);
  process.stdout.write(u.hostname);
')" || { echo "Invalid witness URL."; exit 12; }

if [ "${IZAKHONO_WITNESS_ALLOW_LOCAL_TEST:-0}" != "1" ]; then
  case "$WITNESS_HOST" in
    localhost|127.*|::1)
      echo "Refusing a local/co-located production witness."
      exit 13
      ;;
  esac
fi

PUBLIC_PEM="$(node - "$PUBLIC_KEY_JSON" <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.algorithm!=="Ed25519" || typeof x.publicKeyPem!=="string" || !x.publicKeyPem.includes("BEGIN PUBLIC KEY")) process.exit(2);
process.stdout.write(x.publicKeyPem);
NODE
)" || { echo "Invalid witness public key file."; exit 14; }

REMOTE_PUBLIC="$(curl -fsS --max-time 5 "$WITNESS_URL/v1/public-key")" || {
  echo "Witness public-key endpoint is unreachable."
  exit 15
}
REMOTE_PEM="$(REMOTE_PUBLIC="$REMOTE_PUBLIC" node -e '
  const x=JSON.parse(process.env.REMOTE_PUBLIC);
  if(x.algorithm!=="Ed25519" || typeof x.publicKeyPem!=="string") process.exit(2);
  process.stdout.write(x.publicKeyPem);
')" || { echo "Witness public-key response invalid."; exit 16; }

if [ "$PUBLIC_PEM" != "$REMOTE_PEM" ]; then
  echo "Witness public-key pin mismatch. Refusing enrollment."
  exit 17
fi

LEASE_STATUS="$(curl -fsS --max-time 5   -H "x-witness-member-key: $MEMBER_KEY"   "$WITNESS_URL/v1/clusters/$CLUSTER_ID/lease")" || {
  echo "Witness rejected this member credential or cluster."
  exit 18
}

LEASE_CLUSTER="$(LEASE_STATUS="$LEASE_STATUS" node -e '
  const x=JSON.parse(process.env.LEASE_STATUS);
  if(x.clusterId) process.stdout.write(x.clusterId);
')" || true
[ "$LEASE_CLUSTER" = "$CLUSTER_ID" ] || { echo "Witness cluster validation failed."; exit 19; }

mkdir -p /etc/izakhono/witness-member
chmod 0750 /etc/izakhono/witness-member
install -o root -g izakhono -m 0640 "$CREDENTIAL_FILE" /etc/izakhono/witness-member/member.env
printf '%s' "$PUBLIC_PEM" > /etc/izakhono/witness-member/public.pem
chown root:izakhono /etc/izakhono/witness-member/public.pem
chmod 0644 /etc/izakhono/witness-member/public.pem

update_env(){
  local target="$1"
  TARGET="$target"   WITNESS_URL="$WITNESS_URL"   CLUSTER_ID="$CLUSTER_ID"   MEMBER_ID="$MEMBER_ID"   MEMBER_KEY="$MEMBER_KEY"   node - <<'NODE'
const fs=require("fs");
const path=process.env.TARGET;
const updates={
  IZAKHONO_WITNESS_MODE:"observe",
  IZAKHONO_WITNESS_URL:process.env.WITNESS_URL,
  IZAKHONO_WITNESS_CLUSTER_ID:process.env.CLUSTER_ID,
  IZAKHONO_WITNESS_MEMBER_ID:process.env.MEMBER_ID,
  IZAKHONO_WITNESS_MEMBER_KEY:process.env.MEMBER_KEY,
  IZAKHONO_WITNESS_PUBLIC_KEY_FILE:"/etc/izakhono/witness-member/public.pem",
  IZAKHONO_WITNESS_RENEW_MS:"5000"
};
const lines=fs.readFileSync(path,"utf8").split(/\r?\n/).filter(Boolean);
const seen=new Set();
const out=lines.map(line=>{
  if(line.startsWith("#") || !line.includes("=")) return line;
  const key=line.split("=",1)[0].trim();
  if(Object.hasOwn(updates,key)){
    seen.add(key);
    return key+"="+updates[key];
  }
  return line;
});
for(const [key,value] of Object.entries(updates)) if(!seen.has(key)) out.push(key+"="+value);
fs.writeFileSync(path,out.join("\n")+"\n",{mode:0o600});
NODE
  chmod 0600 "$target"
}

update_env /etc/izakhono/runtime-node.env
update_env /etc/izakhono/edge-node.env

systemctl restart izakhono-runtime-node
systemctl restart izakhono-edge-node

probe_local(){
  local url="$1"
  for _ in $(seq 1 30); do
    local body
    body="$(curl -fsS --max-time 2 "$url" 2>/dev/null || true)"
    if [ -n "$body" ]; then
      BODY="$body" node -e '
        const x=JSON.parse(process.env.BODY);
        const w=x.witness;
        if(w?.mode==="observe" && w.configured===true) process.exit(0);
        process.exit(2);
      ' && { printf '%s' "$body"; return 0; }
    fi
    sleep 1
  done
  return 1
}

RUNTIME_HEALTH="$(probe_local http://127.0.0.1:8790/health)" || {
  echo "RUNTIME did not enter configured witness observe mode."
  exit 20
}
EDGE_HEALTH="$(probe_local http://127.0.0.1:8795/health)" || {
  echo "EDGE did not enter configured witness observe mode."
  exit 21
}

RUNTIME_VALID="$(BODY="$RUNTIME_HEALTH" node -e 'const x=JSON.parse(process.env.BODY);process.stdout.write(String(Boolean(x.witness?.leaseValid)))')"
EDGE_VALID="$(BODY="$EDGE_HEALTH" node -e 'const x=JSON.parse(process.env.BODY);process.stdout.write(String(Boolean(x.witness?.leaseValid)))')"
RUNTIME_TOKEN="$(BODY="$RUNTIME_HEALTH" node -e 'const x=JSON.parse(process.env.BODY);process.stdout.write(String(x.witness?.fencingToken??""))')"
EDGE_TOKEN="$(BODY="$EDGE_HEALTH" node -e 'const x=JSON.parse(process.env.BODY);process.stdout.write(String(x.witness?.fencingToken??""))')"

if [ "$ROLE" = "primary" ]; then
  if [ "$RUNTIME_VALID" != "true" ] || [ "$EDGE_VALID" != "true" ]; then
    echo "Primary enrollment requires both RUNTIME and EDGE to hold a valid signed witness lease."
    exit 22
  fi
  if [ -z "$RUNTIME_TOKEN" ] || [ "$RUNTIME_TOKEN" != "$EDGE_TOKEN" ]; then
    echo "Primary RUNTIME/EDGE fencing tokens do not agree."
    exit 23
  fi
fi

REPORT_DIR=/var/lib/izakhono-deploy/proofs
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
REPORT="$REPORT_DIR/witness-$ROLE-observe.json"

ROLE="$ROLE" WITNESS_URL="$WITNESS_URL" CLUSTER_ID="$CLUSTER_ID" MEMBER_ID="$MEMBER_ID" RUNTIME_VALID="$RUNTIME_VALID" EDGE_VALID="$EDGE_VALID" RUNTIME_TOKEN="$RUNTIME_TOKEN" EDGE_TOKEN="$EDGE_TOKEN" node - <<'NODE' >"$REPORT"
const report={
  product:"IZAKHONO WITNESS ENROLLMENT",
  role:process.env.ROLE,
  mode:"observe",
  witness_url:process.env.WITNESS_URL,
  cluster_id:process.env.CLUSTER_ID,
  member_id:process.env.MEMBER_ID,
  public_key_pinned:true,
  credential_verified:true,
  runtime:{configured:true,lease_valid:process.env.RUNTIME_VALID==="true",fencing_token:process.env.RUNTIME_TOKEN||null},
  edge:{configured:true,lease_valid:process.env.EDGE_VALID==="true",fencing_token:process.env.EDGE_TOKEN||null},
  write_blocking_enabled:false,
  automatic_failover_enabled:false,
  proved_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2));
NODE
chmod 0600 "$REPORT"

unset MEMBER_KEY PUBLIC_PEM REMOTE_PEM REMOTE_PUBLIC LEASE_STATUS

echo "IZAKHONO WITNESS enrollment: PASS"
echo "Role: $ROLE"
echo "Mode: observe"
echo "Public-key pin: verified"
if [ "$ROLE" = "primary" ]; then
  echo "Primary signed lease: verified"
else
  echo "Standby credential: verified; it may remain lease-inactive while primary leadership is valid."
fi
echo "Automatic failover: OFF"
echo "Write fencing: OBSERVE ONLY"
echo "Report: $REPORT"
