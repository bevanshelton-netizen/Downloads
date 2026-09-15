#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-analytics-node /var/lib/izakhono-analytics /etc/izakhono
sudo cp server.mjs /opt/izakhono-analytics-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-analytics-node /var/lib/izakhono-analytics

if [ ! -f /etc/izakhono/analytics-node.env ]; then
  ADMIN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  HASH="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/analytics-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8830
IZAKHONO_ANALYTICS_ADMIN_KEY=$ADMIN
IZAKHONO_ANALYTICS_HASH_KEY=$HASH
IZAKHONO_ANALYTICS_COLLECT_LIMIT_PER_MIN=240
IZAKHONO_ANALYTICS_MAX_BODY_BYTES=65536
EOF
  sudo chmod 600 /etc/izakhono/analytics-node.env
fi

sudo cp systemd/izakhono-analytics-node.service /etc/systemd/system/izakhono-analytics-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-analytics-node
sudo systemctl --no-pager --full status izakhono-analytics-node
