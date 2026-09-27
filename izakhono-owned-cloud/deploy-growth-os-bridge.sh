#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
HOSTNAME="bridge.domains.izakhonoafrica.co.za"

bash "$ROOT/izakhono-infrastructure-executor/host-eligibility.sh" >/tmp/growth-bridge-host.txt
grep -q '^INFRASTRUCTURE_HOST_ELIGIBLE=true$' /tmp/growth-bridge-host.txt

bash "$ROOT/izakhono-growth-bridge-node/install-linux.sh"
bash "$ROOT/izakhono-owned-cloud/start-growth-os-outbound-bridge.sh"

BODY="$(curl -fsS --max-time 20 "https://$HOSTNAME/health")"
node -e '
const x=JSON.parse(process.argv[1]);
if(x.ok!==true||x.service!=="izakhono-growth-bridge"||x.runtime!=="izakhono-owned")process.exit(2);
if(x.arbitraryProxy!==false||x.shellAccess!==false||x.secretsReturned!==false)process.exit(3);
if(x.oidc?.audience!=="https://bridge.domains.izakhonoafrica.co.za")process.exit(4);
if(x.oidc?.project_id!=="prj_OpMGIOe5TXhyhn6lHabQOOafRTV6")process.exit(5);
' "$BODY"

echo "IZAKHONO GROWTH BRIDGE: OWNED PUBLIC HTTPS VERIFIED"
