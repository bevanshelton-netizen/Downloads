#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

QUEUE_KEY="$(sudo awk -F= '$1=="IZAKHONO_QUEUE_KEY" {sub(/^[^=]*=/,""); print; exit}' /etc/izakhono/queue-node.env 2>/dev/null || true)"
if [ -z "$QUEUE_KEY" ]; then
  echo "Install IZAKHONO QUEUE NODE first."
  exit 4
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-notify-node /var/lib/izakhono-notify /etc/izakhono
sudo cp server.mjs /opt/izakhono-notify-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-notify-node /var/lib/izakhono-notify

if [ ! -f /etc/izakhono/notify-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENC="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/notify-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8840
IZAKHONO_NOTIFY_KEY=$KEY
IZAKHONO_NOTIFY_ENCRYPTION_KEY=$ENC
IZAKHONO_QUEUE_URL=http://127.0.0.1:8810
IZAKHONO_QUEUE_KEY=$QUEUE_KEY
IZAKHONO_NOTIFY_POLL_MS=500
IZAKHONO_NOTIFY_RETRY_BASE_SECONDS=5
IZAKHONO_EMAIL_ADAPTER_URL=
IZAKHONO_SMS_ADAPTER_URL=
IZAKHONO_WHATSAPP_ADAPTER_URL=
IZAKHONO_NOTIFY_ADAPTER_KEY=
IZAKHONO_NOTIFY_WEBHOOK_ALLOWLIST=
EOF
  sudo chmod 600 /etc/izakhono/notify-node.env
fi

sudo cp systemd/izakhono-notify-node.service /etc/systemd/system/izakhono-notify-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-notify-node
sudo systemctl --no-pager --full status izakhono-notify-node
