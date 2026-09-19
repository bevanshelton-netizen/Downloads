#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BIND="${IZAKHONO_WITNESS_BIND:-}"

for cmd in node curl systemctl sed; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd"; exit 2; }
done

if [ -z "$BIND" ]; then
  echo "Set IZAKHONO_WITNESS_BIND to the witness host's approved private/VPN interface IP."
  exit 3
fi

if [ "$BIND" = "0.0.0.0" ] || [ "$BIND" = "::" ]; then
  echo "Refusing wildcard witness bind. Use an explicit private/VPN interface IP."
  exit 4
fi

if [ "${IZAKHONO_WITNESS_ALLOW_COLOCATED_TEST:-0}" != "1" ]; then
  for svc in izakhono-data-node izakhono-runtime-node izakhono-edge-node; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      echo "Refusing co-located production witness: $svc is active on this host."
      echo "Use a physically independent witness host."
      exit 5
    fi
  done
fi

(cd "$ROOT/izakhono-witness-node" && bash install-linux.sh)

ENV=/etc/izakhono/witness-node.env
[ -f "$ENV" ] || { echo "Witness environment missing after install."; exit 6; }

if grep -q '^HOST=' "$ENV"; then
  sed -i "s/^HOST=.*/HOST=$BIND/" "$ENV"
else
  echo "HOST=$BIND" >>"$ENV"
fi
chmod 0600 "$ENV"

systemctl restart izakhono-witness-node

HEALTH="$(curl -fsS --max-time 5 "http://$BIND:8930/health")" || {
  echo "Witness health endpoint is not reachable on $BIND:8930."
  exit 7
}

node -e '
  const x=JSON.parse(process.argv[1]);
  if(
    x.product!=="IZAKHONO WITNESS NODE" ||
    x.status!=="healthy" ||
    x.automaticFailover!==false ||
    x.independentFailureDomainRequired!==true ||
    x.leaseReceipts!=="Ed25519"
  ) process.exit(2);
' "$HEALTH" || {
  echo "Witness health safety contract failed."
  exit 8
}

REPORT_DIR=/var/lib/izakhono-deploy/proofs
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
REPORT="$REPORT_DIR/witness-node-proof.json"

BIND="$BIND" node - <<'NODE' >"$REPORT"
const report={
  product:"IZAKHONO WITNESS NODE",
  status:"PROVISIONED",
  bind:process.env.BIND,
  port:8930,
  independent_host_required:true,
  colocated_primary_services_detected:false,
  automatic_failover_enabled:false,
  signed_lease_receipts:"Ed25519",
  cluster_bootstrapped:false,
  proved_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2));
NODE
chmod 0600 "$REPORT"

echo "IZAKHONO WITNESS NODE: HEALTHY"
echo "Independent-host software gate: PASS"
echo "Report: $REPORT"
echo "Next on this witness host: sudo bash $HERE/bootstrap-ha-cluster.sh"
