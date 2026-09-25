#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
SOURCE="$ROOT/engines/yhvh-gospel-engine"
ENV_EXAMPLE="$SOURCE/yhvh-gospel-engine.env.example"
INSTALL_DIR="/opt/izakhono/yhvh-gospel-engine"
ENV_FILE="/etc/izakhono/yhvh-gospel-engine.env"
DATA_DIR="/var/lib/izakhono-runtime/data/yhvh-gospel-engine"

[ -f "$SOURCE/engine.mjs" ] || { echo "Missing engine.mjs" >&2; exit 2; }
for cmd in node curl openssl; do command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd" >&2; exit 2; }; done
node --check "$SOURCE/engine.mjs"
install -d -o root -g izakhono -m 0750 "$INSTALL_DIR" /etc/izakhono
install -d -o izakhono -g izakhono -m 0750 "$DATA_DIR"
install -o root -g izakhono -m 0750 "$SOURCE/engine.mjs" "$INSTALL_DIR/engine.mjs"
install -o root -g izakhono -m 0640 "$SOURCE/schedule.json" "$INSTALL_DIR/schedule.json"

if [ ! -f "$ENV_FILE" ]; then
  install -o root -g izakhono -m 0600 "$ENV_EXAMPLE" "$ENV_FILE"
fi

if grep -q 'REPLACE-WITH-32-PLUS-CHARACTER-OWNER-TOKEN' "$ENV_FILE"; then
  TOKEN_VALUE="$(openssl rand -hex 32)"
  node - "$ENV_FILE" "$TOKEN_VALUE" <<'NODE'
const fs=require("fs");
const [path,token]=process.argv.slice(2);
const src=fs.readFileSync(path,"utf8");
fs.writeFileSync(path,src.replace("REPLACE-WITH-32-PLUS-CHARACTER-OWNER-TOKEN",token),{mode:0o600});
NODE
fi
chmod 0600 "$ENV_FILE"

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
