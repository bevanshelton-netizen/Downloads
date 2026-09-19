#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then echo "Node.js 22.13+ is required."; exit 2; fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-failover-node /var/lib/izakhono-failover /etc/izakhono
sudo cp server.mjs /opt/izakhono-failover-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-failover-node /var/lib/izakhono-failover

if [ ! -f /etc/izakhono/failover-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/failover-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8920
IZAKHONO_FAILOVER_KEY=$KEY
IZAKHONO_FAILOVER_MONITOR_MS=5000
IZAKHONO_FAILOVER_FAIL_SAMPLES=3
IZAKHONO_FAILOVER_PROBE_TIMEOUT_MS=2500
EOF
  sudo chmod 600 /etc/izakhono/failover-node.env
fi

sudo cp systemd/izakhono-failover-node.service /etc/systemd/system/izakhono-failover-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-failover-node
sudo systemctl --no-pager --full status izakhono-failover-node
