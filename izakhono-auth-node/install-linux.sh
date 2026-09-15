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
sudo mkdir -p /opt/izakhono-auth-node /var/lib/izakhono-auth /etc/izakhono
sudo cp server.mjs /opt/izakhono-auth-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-auth-node /var/lib/izakhono-auth

if [ ! -f /etc/izakhono/auth-node.env ]; then
  BOOTSTRAP="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENCRYPTION="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/auth-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8820
IZAKHONO_AUTH_BOOTSTRAP_KEY=$BOOTSTRAP
IZAKHONO_AUTH_ENCRYPTION_KEY=$ENCRYPTION
IZAKHONO_AUTH_SESSION_HOURS=12
IZAKHONO_AUTH_LOGIN_LIMIT_PER_MIN=12
IZAKHONO_AUTH_LOCK_AFTER=5
IZAKHONO_AUTH_LOCK_MINUTES=15
EOF
  sudo chmod 600 /etc/izakhono/auth-node.env
fi

sudo cp systemd/izakhono-auth-node.service /etc/systemd/system/izakhono-auth-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-auth-node
sudo systemctl --no-pager --full status izakhono-auth-node

echo
echo "IZAKHONO AUTH NODE installed."
echo "The bootstrap key is stored at /etc/izakhono/auth-node.env and was not printed."
