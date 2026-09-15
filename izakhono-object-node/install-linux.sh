#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-object-node /var/lib/izakhono-object/{objects,tmp} /var/log/izakhono-object /etc/izakhono
sudo cp server.mjs /opt/izakhono-object-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-object-node /var/lib/izakhono-object /var/log/izakhono-object

if [ ! -f /etc/izakhono/object-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/object-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8800
IZAKHONO_OBJECT_KEY=$KEY
IZAKHONO_OBJECT_MAX_BYTES=1073741824
IZAKHONO_OBJECT_BUCKET_QUOTA_BYTES=21474836480
EOF
  sudo chmod 600 /etc/izakhono/object-node.env
fi

sudo cp systemd/izakhono-object-node.service /etc/systemd/system/izakhono-object-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-object-node
sudo systemctl --no-pager --full status izakhono-object-node
