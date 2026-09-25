#!/usr/bin/env bash
set -euo pipefail

DNS_SSH="${IZAKHONO_HA_DNS_SSH:-}"
FQDN="${IZAKHONO_HA_ROUTE_FQDN:-}"
PRIMARY_IP="${IZAKHONO_HA_PRIMARY_ROUTE_IP:-}"
STANDBY_IP="${IZAKHONO_HA_STANDBY_ROUTE_IP:-}"
TARGET="${IZAKHONO_FAILOVER_TARGET:-}"
TOKEN="${IZAKHONO_FAILOVER_FENCING_TOKEN:-}"
PREVIOUS="${IZAKHONO_FAILOVER_PREVIOUS_TOKEN:-}"
HELPER="${IZAKHONO_HA_DNS_HELPER:-/opt/izakhono-owned-cloud/ha-dns-switch-local.mjs}"

[ -n "$DNS_SSH" ] || { echo "IZAKHONO_HA_DNS_SSH is required."; exit 2; }
[ -n "$FQDN" ] || { echo "IZAKHONO_HA_ROUTE_FQDN is required."; exit 3; }
[ "$TARGET" = "primary" ] || [ "$TARGET" = "standby" ] || { echo "Invalid IZAKHONO_FAILOVER_TARGET."; exit 4; }
[[ "$TOKEN" =~ ^[0-9]+$ ]] && [[ "$PREVIOUS" =~ ^[0-9]+$ ]] || { echo "Fencing tokens must be integers."; exit 5; }
[ "$TOKEN" -gt "$PREVIOUS" ] || { echo "Refusing stale/non-monotonic fencing token."; exit 6; }

if [ "$TARGET" = "primary" ]; then
  IP="$PRIMARY_IP"
else
  IP="$STANDBY_IP"
fi
[ -n "$IP" ] || { echo "Target route IP is missing."; exit 7; }

command -v ssh >/dev/null 2>&1 || { echo "ssh is required."; exit 8; }

ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$DNS_SSH" "sudo -n test -f '$HELPER'" >/dev/null 2>&1 || {
  echo "DNS helper is not installed on the route-authority host: $HELPER"
  exit 9
}

RESULT="$(ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 "$DNS_SSH"   "sudo -n env IZAKHONO_HA_ROUTE_FQDN='$FQDN' IZAKHONO_HA_ROUTE_IP='$IP' IZAKHONO_FAILOVER_TARGET='$TARGET' IZAKHONO_FAILOVER_FENCING_TOKEN='$TOKEN' IZAKHONO_FAILOVER_PREVIOUS_TOKEN='$PREVIOUS' node '$HELPER'")" || {
  echo "DNS route switch failed."
  exit 10
}

RESULT="$RESULT" TARGET="$TARGET" IP="$IP" TOKEN="$TOKEN" node -e '
const x=JSON.parse(process.env.RESULT);
if(x.target!==process.env.TARGET||x.ip!==process.env.IP||Number(x.fencingToken)!==Number(process.env.TOKEN)||x.automaticFailover!==false)process.exit(2);
' || {
  echo "DNS route-switch verification payload invalid."
  exit 11
}

echo "IZAKHONO DNS route switched to $TARGET ($IP) with fencing token $TOKEN."
echo "$RESULT"
