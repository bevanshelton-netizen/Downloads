#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-ai-gateway-node /var/lib/izakhono-ai-gateway /etc/izakhono
sudo cp server.mjs /opt/izakhono-ai-gateway-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-ai-gateway-node /var/lib/izakhono-ai-gateway

if [ ! -f /etc/izakhono/ai-gateway-node.env ]; then
  ADMIN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENC="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/ai-gateway-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8850
IZAKHONO_AI_GATEWAY_ADMIN_KEY=$ADMIN
IZAKHONO_AI_GATEWAY_ENCRYPTION_KEY=$ENC
IZAKHONO_AI_PROVIDER_ALLOWLIST=127.0.0.1,localhost,::1
IZAKHONO_AI_GATEWAY_TIMEOUT_MS=60000
IZAKHONO_AI_GATEWAY_MAX_BODY_BYTES=2097152
IZAKHONO_AI_CIRCUIT_FAILURES=3
IZAKHONO_AI_CIRCUIT_SECONDS=60
EOF
  sudo chmod 600 /etc/izakhono/ai-gateway-node.env
fi

sudo cp systemd/izakhono-ai-gateway-node.service /etc/systemd/system/izakhono-ai-gateway-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-ai-gateway-node
sudo systemctl --no-pager --full status izakhono-ai-gateway-node

echo
echo "IZAKHONO AI GATEWAY NODE installed."
echo "No AI model/provider is auto-provisioned."
echo "Register an owned local model endpoint or an optional external provider through the admin API."
