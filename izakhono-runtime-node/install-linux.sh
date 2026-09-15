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
sudo mkdir -p /opt/izakhono-runtime-node /var/lib/izakhono-runtime/releases /var/log/izakhono-runtime /etc/izakhono/apps
sudo cp server.mjs /opt/izakhono-runtime-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-runtime-node /var/lib/izakhono-runtime /var/log/izakhono-runtime
sudo chown root:izakhono /etc/izakhono/apps
sudo chmod 750 /etc/izakhono/apps

if [ ! -f /etc/izakhono/runtime-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/runtime-node.env >/dev/null <<EOF
CONTROL_HOST=127.0.0.1
CONTROL_PORT=8790
PROXY_HOST=0.0.0.0
PROXY_PORT=8080
IZAKHONO_RUNTIME_KEY=$KEY
EOF
  sudo chmod 600 /etc/izakhono/runtime-node.env
fi

sudo cp systemd/izakhono-runtime-node.service /etc/systemd/system/izakhono-runtime-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-runtime-node
sudo systemctl --no-pager --full status izakhono-runtime-node
