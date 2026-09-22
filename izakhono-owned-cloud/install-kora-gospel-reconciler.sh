#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
SCRIPT="$ROOT/izakhono-owned-cloud/reconcile-kora-gospel-intake.mjs"
ENV_EXAMPLE="$ROOT/izakhono-owned-cloud/kora-gospel-external.env.example"
ENV_FILE="/etc/izakhono/kora-gospel-external.env"
BIN="/opt/izakhono/kora-gospel/reconcile-kora-gospel-intake.mjs"

[ -f "$SCRIPT" ] || { echo "Missing reconciler: $SCRIPT" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required." >&2; exit 3; }

install -d -o root -g izakhono -m 0750 /opt/izakhono/kora-gospel /etc/izakhono /var/lib/izakhono-deploy
install -o root -g izakhono -m 0750 "$SCRIPT" "$BIN"

if [ ! -f "$ENV_FILE" ]; then
  install -o root -g izakhono -m 0600 "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created protected environment template: $ENV_FILE"
fi

cat >/etc/systemd/system/kora-gospel-reconcile.service <<'UNIT'
[Unit]
Description=YHVH GOSPEL TV external intake reconciliation
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
Group=izakhono
EnvironmentFile=/etc/izakhono/kora-gospel-external.env
ExecStart=/usr/bin/node /opt/izakhono/kora-gospel/reconcile-kora-gospel-intake.mjs
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/izakhono-runtime/data/kora-gospel-tv /var/lib/izakhono-deploy /run
UMask=0077
UNIT

cat >/etc/systemd/system/kora-gospel-reconcile.timer <<'UNIT'
[Unit]
Description=Run YHVH GOSPEL TV intake reconciliation every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=20s
Persistent=true
Unit=kora-gospel-reconcile.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload

if grep -q 'REPLACE-WITH' "$ENV_FILE"; then
  systemctl disable --now kora-gospel-reconcile.timer >/dev/null 2>&1 || true
  echo "RECONCILER_INSTALLED=YES"
  echo "TIMER_ENABLED=NO"
  echo "ACTION_REQUIRED=Set SUPABASE_SECRET_KEY in $ENV_FILE then run:"
  echo "  sudo systemctl enable --now kora-gospel-reconcile.timer"
  exit 20
fi

systemctl enable --now kora-gospel-reconcile.timer
systemctl start kora-gospel-reconcile.service
systemctl is-active --quiet kora-gospel-reconcile.timer
echo "RECONCILER_INSTALLED=YES"
echo "TIMER_ENABLED=YES"
echo "RECEIPT=/var/lib/izakhono-deploy/kora-gospel-reconcile.json"
