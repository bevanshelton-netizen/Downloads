#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

if [ ! -f /etc/izakhono/tls/fullchain.pem ] || [ ! -f /etc/izakhono/tls/privkey.pem ]; then
  echo "Install a valid TLS certificate at /etc/izakhono/tls/fullchain.pem and privkey.pem first."
  exit 4
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-edge-node /var/log/izakhono-edge /etc/izakhono
sudo cp server.mjs /opt/izakhono-edge-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-edge-node /var/log/izakhono-edge
sudo chown root:izakhono /etc/izakhono/tls/fullchain.pem /etc/izakhono/tls/privkey.pem
sudo chmod 640 /etc/izakhono/tls/fullchain.pem /etc/izakhono/tls/privkey.pem

if [ ! -f /etc/izakhono/edge-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/edge-node.env >/dev/null <<EOF
HTTP_HOST=0.0.0.0
HTTP_PORT=80
HTTPS_HOST=0.0.0.0
HTTPS_PORT=443
CONTROL_HOST=127.0.0.1
CONTROL_PORT=8795
RUNTIME_HOST=127.0.0.1
RUNTIME_PORT=8080
IZAKHONO_EDGE_KEY=$KEY
IZAKHONO_TLS_CERT=/etc/izakhono/tls/fullchain.pem
IZAKHONO_TLS_KEY=/etc/izakhono/tls/privkey.pem
IZAKHONO_EDGE_ACCESS_LOG=/var/log/izakhono-edge/access.jsonl
IZAKHONO_EDGE_MAX_BODY_BYTES=5242880
IZAKHONO_EDGE_RATE_PER_MIN=180
IZAKHONO_EDGE_RATE_BURST=60
FORTRESS_PROTECTOR_MODE=active
FORTRESS_SENSITIVE_RATE_PER_MIN=60
FORTRESS_SENSITIVE_BURST=20
FORTRESS_SENSITIVE_MAX_BODY_BYTES=262144
EOF
  sudo chmod 600 /etc/izakhono/edge-node.env
fi

sudo cp systemd/izakhono-edge-node.service /etc/systemd/system/izakhono-edge-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-edge-node
sudo systemctl --no-pager --full status izakhono-edge-node
