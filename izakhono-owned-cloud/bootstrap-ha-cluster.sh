#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

ENV=/etc/izakhono/witness-node.env
[ -f "$ENV" ] || { echo "WITNESS NODE is not installed."; exit 2; }

ADMIN_KEY="$(awk -F= '$1=="IZAKHONO_WITNESS_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
HOST="$(awk -F= '$1=="HOST"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
PORT="$(awk -F= '$1=="PORT"{sub(/^[^=]*=/,"");print;exit}' "$ENV")"
PORT="${PORT:-8930}"

[ -n "$ADMIN_KEY" ] || { echo "Witness admin key missing."; exit 3; }
[ -n "$HOST" ] || { echo "Witness bind address missing."; exit 4; }

BASE="http://$HOST:$PORT"
OUT=/etc/izakhono/witness-members
mkdir -p "$OUT"
chmod 0700 "$OUT"

CLUSTERS="$(curl -fsS -H "x-izakhono-key: $ADMIN_KEY" "$BASE/v1/admin/clusters")" || {
  echo "Cannot read witness clusters."
  exit 5
}

EXISTING_ID="$(node -e '
  const x=JSON.parse(process.argv[1]);
  const c=(x.clusters||[]).find(v=>v.name==="owned-cloud");
  if(c) process.stdout.write(c.id);
' "$CLUSTERS")"

if [ -n "$EXISTING_ID" ]; then
  echo "owned-cloud witness cluster already exists: $EXISTING_ID"
  echo "Refusing to rotate member credentials automatically."
  exit 6
fi

CLUSTER_RESPONSE="$(curl -fsS -X POST   -H "content-type: application/json"   -H "x-izakhono-key: $ADMIN_KEY"   --data '{"name":"owned-cloud","leaseTtlSeconds":15}'   "$BASE/v1/clusters")" || { echo "Cluster creation failed."; exit 7; }

CLUSTER_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.cluster.id)' "$CLUSTER_RESPONSE")"

make_member(){
  local name="$1"
  local target="$OUT/$name.env"
  local response
  response="$(curl -fsS -X POST     -H "content-type: application/json"     -H "x-izakhono-key: $ADMIN_KEY"     --data "{"name":"$name"}"     "$BASE/v1/clusters/$CLUSTER_ID/members")"
  MEMBER_RESPONSE="$response" CLUSTER_ID="$CLUSTER_ID" WITNESS_URL="$BASE" node - <<'NODE' >"$target"
const x=JSON.parse(process.env.MEMBER_RESPONSE);
console.log("IZAKHONO_WITNESS_URL="+process.env.WITNESS_URL);
console.log("IZAKHONO_WITNESS_CLUSTER_ID="+process.env.CLUSTER_ID);
console.log("IZAKHONO_WITNESS_MEMBER_ID="+x.member.id);
console.log("IZAKHONO_WITNESS_MEMBER_KEY="+x.memberKey);
NODE
  chmod 0600 "$target"
}

make_member primary
make_member standby

curl -fsS "$BASE/v1/public-key" >"$OUT/public-key.json"
chmod 0644 "$OUT/public-key.json"

unset ADMIN_KEY

echo "IZAKHONO HA witness cluster created."
echo "Cluster ID: $CLUSTER_ID"
echo "Credentials were NOT printed."
echo "Primary credential file: $OUT/primary.env"
echo "Standby credential file: $OUT/standby.env"
echo "Witness public key: $OUT/public-key.json"
echo
echo "Transfer each member credential only to its matching host over an approved secure/offline path."
echo "Automatic failover remains OFF until lease/fencing enforcement is implemented and physically proven."
