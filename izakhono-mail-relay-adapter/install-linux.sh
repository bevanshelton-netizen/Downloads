#!/usr/bin/env bash
set -euo pipefail
command -v node >/dev/null 2>&1 || { echo "Node.js 22.13+ is required."; exit 2; }
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-mail-relay-adapter /etc/izakhono
sudo cp server.mjs /opt/izakhono-mail-relay-adapter/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-mail-relay-adapter
if [ ! -f /etc/izakhono/mail-relay.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/mail-relay.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8845
IZAKHONO_MAIL_ADAPTER_KEY=$KEY
IZAKHONO_SMTP_HOST=
IZAKHONO_SMTP_PORT=587
IZAKHONO_SMTP_SECURE=false
IZAKHONO_SMTP_STARTTLS=true
IZAKHONO_SMTP_USER=
IZAKHONO_SMTP_PASSWORD=
IZAKHONO_SMTP_FROM=
IZAKHONO_SMTP_FROM_NAME=IZAKHONO ONE
IZAKHONO_SMTP_TIMEOUT_MS=15000
EOF
  sudo chmod 600 /etc/izakhono/mail-relay.env
fi
sudo cp systemd/izakhono-mail-relay-adapter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-mail-relay-adapter
sudo systemctl --no-pager --full status izakhono-mail-relay-adapter
echo "IZAKHONO MAIL RELAY ADAPTER installed. SMTP credentials remain unconfigured until supplied separately."
