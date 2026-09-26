#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
INSTALL_ROOT=/opt/izakhono-node01
CONFIG_ROOT=/etc/izakhono
STATE_ROOT=/var/lib/izakhono-node01
RECEIPT="$STATE_ROOT/install-receipt.json"
INSTALL_STACK="${IZAKHONO_NODE01_INSTALL_STACK:-1}"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 2; }; }
for c in node systemctl install sha256sum; do need "$c"; done

node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' || {
  echo "Node.js 22.13+ is required." >&2
  exit 3
}

if ! id izakhono >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/izakhono --shell /usr/sbin/nologin izakhono
fi

mkdir -p "$CONFIG_ROOT" "$STATE_ROOT" "$INSTALL_ROOT"
chmod 0750 "$CONFIG_ROOT" "$INSTALL_ROOT"
chmod 0700 "$STATE_ROOT"

if [ "$INSTALL_STACK" = "1" ]; then
  echo "Installing IZAKHONO owned service plane..."
  bash "$ROOT/izakhono-owned-cloud/install-owned-stack.sh"
fi

install -o root -g izakhono -m 0640 "$HERE/node01.manifest.json" "$INSTALL_ROOT/node01.manifest.json"
install -o root -g izakhono -m 0640 "$HERE/server.mjs" "$INSTALL_ROOT/server.mjs"
install -o root -g root -m 0750 "$HERE/self-heal.sh" "$INSTALL_ROOT/self-heal.sh"
install -o root -g root -m 0750 "$HERE/acceptance.sh" "$INSTALL_ROOT/acceptance.sh"

MACHINE_ID="unknown"
if [ -s /etc/machine-id ]; then MACHINE_ID="$(cat /etc/machine-id)"; fi
FINGERPRINT="$(printf 'IZAKHONO-NODE01:%s' "$MACHINE_ID" | sha256sum | awk '{print substr($1,1,16)}')"
NODE_INSTANCE="NODE01-$FINGERPRINT"

cat >"$CONFIG_ROOT/node01.json" <<JSON
{
  "schema": "izakhono.node01-config/v1",
  "node_id": "NODE01",
  "node_instance": "$NODE_INSTANCE",
  "role": "primary",
  "authority": "IZAKHONO",
  "execution_class": "IZAKHONO_SOVEREIGN_NODE",
  "external_runtime_dependency": false,
  "public_live_claim": false
}
JSON
chown root:izakhono "$CONFIG_ROOT/node01.json"
chmod 0640 "$CONFIG_ROOT/node01.json"

cat >"$CONFIG_ROOT/node01.env" <<'ENV'
IZAKHONO_NODE01_HOST=127.0.0.1
IZAKHONO_NODE01_PORT=8940
IZAKHONO_NODE01_CONFIG=/etc/izakhono/node01.json
ENV
chown root:izakhono "$CONFIG_ROOT/node01.env"
chmod 0640 "$CONFIG_ROOT/node01.env"

install -o root -g root -m 0644 "$HERE/systemd/izakhono-node01.service" /etc/systemd/system/izakhono-node01.service
install -o root -g root -m 0644 "$HERE/systemd/izakhono-node01-self-heal.service" /etc/systemd/system/izakhono-node01-self-heal.service
install -o root -g root -m 0644 "$HERE/systemd/izakhono-node01-self-heal.timer" /etc/systemd/system/izakhono-node01-self-heal.timer

systemctl daemon-reload
systemctl enable --now izakhono-node01.service
systemctl enable --now izakhono-node01-self-heal.timer

for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:8940/ >/dev/null 2>&1; then break; fi
  sleep 1
done

# Run one self-heal pass before acceptance so newly installed enabled services can recover.
systemctl start izakhono-node01-self-heal.service || true
sleep 1

set +e
"$INSTALL_ROOT/acceptance.sh"
ACCEPTANCE_EXIT=$?
set -e

node - "$RECEIPT" "$NODE_INSTANCE" "$ACCEPTANCE_EXIT" "$INSTALL_STACK" <<'NODE'
const fs=require('fs');
const [path,nodeInstance,acceptanceExit,installStack]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.node01-install/v1',
  product:'IZAKHONO NODE01',
  node_id:'NODE01',
  node_instance:nodeInstance,
  authority:'IZAKHONO',
  execution_class:'IZAKHONO_SOVEREIGN_NODE',
  owned_service_plane_installed:installStack==='1',
  controller:'127.0.0.1:8940',
  watchdog:'systemd-timer',
  acceptance_exit:Number(acceptanceExit),
  external_runtime_dependency:false,
  public_live_claim:false,
  generated_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE
chmod 0600 "$RECEIPT"

if [ "$ACCEPTANCE_EXIT" -ne 0 ]; then
  echo "NODE01 installed, but full service-plane acceptance is not healthy yet." >&2
  echo "Inspect: systemctl status izakhono-node01 and bash izakhono-owned-cloud/stack-status.sh" >&2
  exit "$ACCEPTANCE_EXIT"
fi

echo
echo "IZAKHONO NODE01: BUILT AND LOCALLY VERIFIED"
echo "NODE_INSTANCE=$NODE_INSTANCE"
echo "AUTHORITY=IZAKHONO"
echo "CONTROL=http://127.0.0.1:8940"
echo "SELF_HEAL=ACTIVE"
echo "EXTERNAL_RUNTIME_DEPENDENCY=false"
echo "PUBLIC_LIVE_CLAIM=false"
echo "RECEIPT=$RECEIPT"
