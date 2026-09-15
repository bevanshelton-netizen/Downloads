#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

sudo mkdir -p /opt/izakhono-replica-node /var/lib/izakhono-replica/objects /etc/izakhono
sudo cp server.mjs /opt/izakhono-replica-node/server.mjs
sudo chown -R root:root /opt/izakhono-replica-node /var/lib/izakhono-replica
sudo chmod 0700 /var/lib/izakhono-replica /var/lib/izakhono-replica/objects

if [ ! -f /etc/izakhono/replica-node.env ]; then
  ADMIN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  RECEIVE="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENC="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/replica-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8890
IZAKHONO_REPLICA_NODE_ID=primary
IZAKHONO_REPLICA_ADMIN_KEY=$ADMIN
IZAKHONO_REPLICA_RECEIVE_KEY=$RECEIVE
IZAKHONO_REPLICA_ENCRYPTION_KEY=$ENC
IZAKHONO_REPLICA_SOURCE_ARCHIVE_ROOT=/var/lib/izakhono-backup/archives
IZAKHONO_REPLICA_TARGET_ALLOWLIST=127.0.0.1,localhost,::1
IZAKHONO_REPLICA_MAX_BYTES=536870912000
IZAKHONO_REPLICA_TIMEOUT_MS=300000
EOF
  sudo chmod 600 /etc/izakhono/replica-node.env
fi

sudo cp systemd/izakhono-replica-node.service /etc/systemd/system/izakhono-replica-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-replica-node
sudo systemctl --no-pager --full status izakhono-replica-node

echo
echo "IZAKHONO REPLICA NODE installed."
echo "Default binding is loopback. A recovery host must bind only to an approved private/VPN interface or be exposed through a hardened HTTPS edge."
