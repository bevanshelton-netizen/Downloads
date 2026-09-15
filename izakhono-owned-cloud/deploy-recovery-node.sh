#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
NODE_ID="${IZAKHONO_RECOVERY_NODE_ID:-}"
BIND_HOST="${IZAKHONO_RECOVERY_BIND_HOST:-}"

[ -n "$NODE_ID" ] || { echo "IZAKHONO_RECOVERY_NODE_ID is required."; exit 2; }
[ -n "$BIND_HOST" ] || { echo "IZAKHONO_RECOVERY_BIND_HOST is required and must be the approved private/VPN interface address."; exit 3; }
[ "$BIND_HOST" != "0.0.0.0" ] || { echo "Refusing wildcard public bind."; exit 4; }

(cd "$ROOT/izakhono-replica-node" && bash install-linux.sh)

ENV=/etc/izakhono/replica-node.env
TMP="$(mktemp)"
awk -v host="$BIND_HOST" -v node="$NODE_ID" '
  BEGIN{h=0;n=0}
  /^HOST=/{print "HOST="host;h=1;next}
  /^IZAKHONO_REPLICA_NODE_ID=/{print "IZAKHONO_REPLICA_NODE_ID="node;n=1;next}
  {print}
  END{if(!h)print "HOST="host;if(!n)print "IZAKHONO_REPLICA_NODE_ID="node}
' "$ENV" >"$TMP"
install -o root -g root -m 0600 "$TMP" "$ENV"
rm -f "$TMP"

systemctl restart izakhono-replica-node
sleep 1
curl -fsS "http://$BIND_HOST:8890/health" >/dev/null || {
  echo "Recovery REPLICA NODE health check failed."
  exit 5
}

echo "IZAKHONO recovery replica installed."
echo "Node ID: $NODE_ID"
echo "Private/VPN bind: $BIND_HOST"
echo "Export the receive credential with izakhono-replica-node/export-receiver-credential.sh and transfer it securely to the primary administrator."
