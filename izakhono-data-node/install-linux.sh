#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22&&b<13)) process.exit(3)' || {
  echo "Node.js 22.13+ is required."
  exit 3
}

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-data-node /var/lib/izakhono-data /etc/izakhono
sudo cp server.mjs /opt/izakhono-data-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-data-node /var/lib/izakhono-data

if [ ! -f /etc/izakhono/data-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/data-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8787
IZAKHONO_DATA_KEY=$KEY
EOF
  sudo chmod 600 /etc/izakhono/data-node.env
fi

sudo cp systemd/izakhono-data-node.service /etc/systemd/system/izakhono-data-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-data-node
sudo systemctl --no-pager --full status izakhono-data-node
