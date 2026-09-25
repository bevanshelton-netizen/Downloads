#!/usr/bin/env bash
set -euo pipefail

if [ "\${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

HERE="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
BIND="\${IZAKHONO_STANDBY_BIND_HOST:-}"
NODE_ID="\${IZAKHONO_STANDBY_NODE_ID:-standby-01}"
WITNESS_CREDENTIAL="\${IZAKHONO_STANDBY_WITNESS_CREDENTIAL:-}"
WITNESS_PUBLIC_KEY_JSON="\${IZAKHONO_WITNESS_PUBLIC_KEY_JSON:-}"

[ -n "$BIND" ] || { echo "IZAKHONO_STANDBY_BIND_HOST is required."; exit 2; }
[ -n "$WITNESS_CREDENTIAL" ] || { echo "IZAKHONO_STANDBY_WITNESS_CREDENTIAL is required."; exit 3; }
[ -n "$WITNESS_PUBLIC_KEY_JSON" ] || { echo "IZAKHONO_WITNESS_PUBLIC_KEY_JSON is required."; exit 4; }
[ -f "$WITNESS_CREDENTIAL" ] || { echo "Standby witness credential file not found."; exit 5; }
[ -f "$WITNESS_PUBLIC_KEY_JSON" ] || { echo "Witness public-key JSON not found."; exit 6; }

case "$BIND" in
  0.0.0.0|::|localhost|127.*|::1)
    echo "Standby recovery receiver must bind to an explicit private/VPN address, not wildcard/loopback."
    exit 7
    ;;
esac

if [ -f /var/lib/izakhono-deploy/primary-deployment.txt ] && grep -q 'DEPLOYMENT_STATE=PRIMARY_NODE_PROVED' /var/lib/izakhono-deploy/primary-deployment.txt; then
  echo "Refusing to convert a proven primary node into a standby."
  exit 8
fi

mkdir -p /opt/izakhono-owned-cloud
install -o root -g izakhono -m 0750 "$HERE/promote-standby-state.sh" /opt/izakhono-owned-cloud/promote-standby-state.sh
install -o root -g izakhono -m 0640 "$HERE/standby-state-swap.mjs" /opt/izakhono-owned-cloud/standby-state-swap.mjs
install -o root -g izakhono -m 0750 "$HERE/set-standby-role.sh" /opt/izakhono-owned-cloud/set-standby-role.sh

for cmd in node curl systemctl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 9; }
done

echo "Installing owned stack in non-public tunnel-origin mode..."
IZAKHONO_EDGE_MODE=tunnel bash "$HERE/install-owned-stack.sh"

RUNTIME_ENV=/etc/izakhono/runtime-node.env
TARGET="$RUNTIME_ENV" node - <<'NODE'
const fs=require("fs");
const path=process.env.TARGET;
const updates={PROXY_HOST:"127.0.0.1"};
const lines=fs.readFileSync(path,"utf8").split(/\r?\n/).filter(Boolean);
const seen=new Set();
const out=lines.map(line=>{
  if(line.startsWith("#")||!line.includes("=")) return line;
  const key=line.split("=",1)[0].trim();
  if(Object.hasOwn(updates,key)){seen.add(key);return key+"="+updates[key];}
  return line;
});
for(const [key,value] of Object.entries(updates)) if(!seen.has(key)) out.push(key+"="+value);
fs.writeFileSync(path,out.join("\n")+"\n",{mode:0o600});
NODE
chmod 0600 "$RUNTIME_ENV"
systemctl restart izakhono-runtime-node

echo "Binding REPLICA receiver to approved private/VPN interface..."
IZAKHONO_RECOVERY_NODE_ID="$NODE_ID" \
IZAKHONO_RECOVERY_BIND_HOST="$BIND" \
  bash "$HERE/deploy-recovery-node.sh"

echo "Enrolling standby with independent WITNESS in observe mode..."
bash "$HERE/configure-witness-member.sh" standby "$WITNESS_CREDENTIAL" "$WITNESS_PUBLIC_KEY_JSON"

RUNTIME_HEALTH="$(curl -fsS http://127.0.0.1:8790/health)"
EDGE_HEALTH="$(curl -fsS http://127.0.0.1:8795/health)"
STANDBY_HAS_LEASE="$(RUNTIME_HEALTH="$RUNTIME_HEALTH" EDGE_HEALTH="$EDGE_HEALTH" node -e '
  const r=JSON.parse(process.env.RUNTIME_HEALTH);
  const e=JSON.parse(process.env.EDGE_HEALTH);
  process.stdout.write(String(Boolean(r.witness?.leaseValid || e.witness?.leaseValid)));
')"

if [ "$STANDBY_HAS_LEASE" = "true" ]; then
  MEMBER_KEY="$(awk -F= '$1=="IZAKHONO_WITNESS_MEMBER_KEY"{sub(/^[^=]*=/,"");print;exit}' "$WITNESS_CREDENTIAL")"
  WITNESS_URL="$(awk -F= '$1=="IZAKHONO_WITNESS_URL"{sub(/^[^=]*=/,"");print;exit}' "$WITNESS_CREDENTIAL")"
  CLUSTER_ID="$(awk -F= '$1=="IZAKHONO_WITNESS_CLUSTER_ID"{sub(/^[^=]*=/,"");print;exit}' "$WITNESS_CREDENTIAL")"
  if [ -n "$MEMBER_KEY" ] && [ -n "$WITNESS_URL" ] && [ -n "$CLUSTER_ID" ]; then
    curl -fsS -X POST \
      -H "content-type: application/json" \
      -H "x-witness-member-key: $MEMBER_KEY" \
      --data '{}' \
      "$WITNESS_URL/v1/clusters/$CLUSTER_ID/lease/release" >/dev/null 2>&1 || true
  fi
  unset MEMBER_KEY WITNESS_URL CLUSTER_ID
  echo "Standby unexpectedly acquired leadership. Lease release was attempted; primary leadership must be established before standby certification."
  exit 10
fi

echo "Enabling fail-closed write fencing on standby..."
bash "$HERE/set-witness-mode.sh" standby enforce

EDGE_MODE="$(awk -F= '$1=="IZAKHONO_EDGE_MODE"{print $2;exit}' /etc/izakhono/edge-node.env 2>/dev/null || true)"
TUNNEL_HOST="$(awk -F= '$1=="TUNNEL_HOST"{print $2;exit}' /etc/izakhono/edge-node.env 2>/dev/null || true)"
PROXY_HOST="$(awk -F= '$1=="PROXY_HOST"{print $2;exit}' /etc/izakhono/runtime-node.env 2>/dev/null || true)"

[ "$EDGE_MODE" = "tunnel" ] || { echo "Standby EDGE is not in tunnel-origin mode."; exit 11; }
[ "\${TUNNEL_HOST:-127.0.0.1}" = "127.0.0.1" ] || { echo "Standby EDGE tunnel origin is not loopback-only."; exit 12; }
[ "$PROXY_HOST" = "127.0.0.1" ] || { echo "Standby RUNTIME proxy is not loopback-only."; exit 13; }

echo "Putting autonomous standby workers into PASSIVE role..."
bash "$HERE/set-standby-role.sh" passive
ROLE_PROOF="$(cat /var/lib/izakhono-deploy/proofs/standby-service-role.json)"
ROLE_OK="$(ROLE_PROOF="$ROLE_PROOF" node -e 'const x=JSON.parse(process.env.ROLE_PROOF);process.stdout.write(String(x.status==="PASS"&&x.role==="PASSIVE"&&x.mutators_stopped===true&&x.automatic_activation===false))')"
[ "$ROLE_OK" = "true" ] || { echo "Standby passive-role proof invalid."; exit 14; }

REPORT_DIR=/var/lib/izakhono-deploy/proofs
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
REPORT="$REPORT_DIR/warm-standby.json"

NODE_ID="$NODE_ID" BIND="$BIND" node - <<'NODE' >"$REPORT"
const report={
  product:"IZAKHONO WARM STANDBY",
  status:"PREPARED",
  node_id:process.env.NODE_ID,
  replica_bind:process.env.BIND,
  public_route_changed:false,
  dns_changed:false,
  runtime_public_bind:false,
  edge_public_bind:false,
  witness_role:"standby",
  witness_mode:"enforce",
  standby_leadership_expected:false,
  writes_fail_closed_without_lease:true,
  restore_mode:"staging-only",
  hot_state_replication:false,
  background_mutators_stopped:true,
  standby_service_role:"PASSIVE",
  prepared_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2));
NODE
chmod 0600 "$REPORT"

echo
echo "IZAKHONO WARM STANDBY: PREPARED"
echo "Public route change: NO"
echo "DNS change: NO"
echo "Write fencing: ENFORCED"
echo "Background mutators: PASSIVE / STOPPED"
echo "Replica receiver: $BIND:8890"
echo "Report: $REPORT"
echo "Next: sync encrypted BACKUP archives from primary, run stage-standby-replica.sh with the offline recovery-key file, then use promote-standby-state.sh only after primary fencing and standby witness leadership are proved."
