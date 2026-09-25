#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
SOURCE="$ROOT/engines/yhvh-gospel-engine"
ENV_EXAMPLE="$SOURCE/yhvh-gospel-engine.env.example"
INSTALL_DIR="/opt/izakhono/yhvh-gospel-engine"
ENV_FILE="/etc/izakhono/yhvh-gospel-engine.env"
DATA_DIR="/var/lib/izakhono-runtime/data/yhvh-gospel-engine"

[ -f "$SOURCE/engine.mjs" ] || { echo "Missing engine.mjs" >&2; exit 2; }
node --check "$SOURCE/engine.mjs"
install -d -o root -g izakhono -m 0750 "$INSTALL_DIR" /etc/izakhono
install -d -o izakhono -g izakhono -m 0750 "$DATA_DIR"
install -o root -g izakhono -m 0750 "$SOURCE/engine.mjs" "$INSTALL_DIR/engine.mjs"
install -o root -g izakhono -m 0640 "$SOURCE/schedule.json" "$INSTALL_DIR/schedule.json"

if [ ! -f "$ENV_FILE" ]; then
  install -o root -g izakhono -m 0600 "$ENV_EXAMPLE" "$ENV_FILE"
fi

cat >/etc/systemd/system/yhvh-gospel-engine.service <<'UNIT'
[Unit]
Description=YHVH GOSPEL ENGINE
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=izakhono
Group=izakhono
WorkingDirectory=/opt/izakhono/yhvh-gospel-engine
EnvironmentFile=/etc/izakhono/yhvh-gospel-engine.env
ExecStart=/usr/bin/node /opt/izakhono/yhvh-gospel-engine/engine.mjs
Restart=always
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadOnlyPaths=/opt/izakhono/yhvh-gospel-engine
ReadWritePaths=/var/lib/izakhono-runtime/data/yhvh-gospel-engine
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
if grep -q 'REPLACE-WITH' "$ENV_FILE"; then
  systemctl disable --now yhvh-gospel-engine.service >/dev/null 2>&1 || true
  echo "ENGINE_INSTALLED=YES"
  echo "ENGINE_ACTIVE=NO"
  echo "ACTION_REQUIRED=Set YHVH_GOSPEL_ENGINE_TOKEN in $ENV_FILE then enable the service."
  exit 20
fi

systemctl enable --now yhvh-gospel-engine.service
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:8892/health >/tmp/yhvh-gospel-engine-health.json 2>/dev/null; then
    node -e 'const x=require("/tmp/yhvh-gospel-engine-health.json"); if(x.ok!==true||x.service!=="yhvh-gospel-engine"||x.authority!=="IZAKHONO")process.exit(2)'
    echo "ENGINE_INSTALLED=YES"
    echo "ENGINE_ACTIVE=YES"
    echo "ENGINE_HEALTH=VERIFIED"
    exit 0
  fi
  sleep .25
done
journalctl -u yhvh-gospel-engine.service -n 50 --no-pager >&2 || true
exit 3
