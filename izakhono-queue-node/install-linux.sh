#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then echo "Node.js 22.13+ is required."; exit 2; fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-queue-node /var/lib/izakhono-queue /etc/izakhono
sudo cp server.mjs /opt/izakhono-queue-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-queue-node /var/lib/izakhono-queue

if [ ! -f /etc/izakhono/queue-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/queue-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8810
IZAKHONO_QUEUE_KEY=$KEY
IZAKHONO_QUEUE_MAX_PAYLOAD_BYTES=262144
IZAKHONO_QUEUE_DEFAULT_LEASE_SECONDS=60
EOF
  sudo chmod 600 /etc/izakhono/queue-node.env
fi

sudo cp systemd/izakhono-queue-node.service /etc/systemd/system/izakhono-queue-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-queue-node
sudo systemctl --no-pager --full status izakhono-queue-node
