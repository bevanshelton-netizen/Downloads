#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Git is required."
  exit 3
fi
GIT_EXEC_PATH="$(git --exec-path)"
if [ ! -x "$GIT_EXEC_PATH/git-http-backend" ]; then
  echo "git-http-backend is required but was not found in $GIT_EXEC_PATH."
  exit 4
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-code-node /var/lib/izakhono-code/repos /etc/izakhono
sudo cp server.mjs /opt/izakhono-code-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-code-node /var/lib/izakhono-code

if [ ! -f /etc/izakhono/code-node.env ]; then
  ADMIN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENC="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/code-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8860
IZAKHONO_CODE_ADMIN_KEY=$ADMIN
IZAKHONO_CODE_ENCRYPTION_KEY=$ENC
IZAKHONO_CODE_WEBHOOK_ALLOWLIST=127.0.0.1,localhost,::1
IZAKHONO_CODE_MAX_BODY_BYTES=262144
IZAKHONO_CODE_WEBHOOK_TIMEOUT_MS=5000
EOF
  sudo chmod 600 /etc/izakhono/code-node.env
fi

sudo cp systemd/izakhono-code-node.service /etc/systemd/system/izakhono-code-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-code-node
sudo systemctl --no-pager --full status izakhono-code-node

echo
echo "IZAKHONO CODE NODE installed."
echo "Admin credentials remain in /etc/izakhono/code-node.env and were not printed."
