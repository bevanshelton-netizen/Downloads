#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then echo "Node.js 22.13+ is required."; exit 2; fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-witness-node /var/lib/izakhono-witness /etc/izakhono/witness
sudo cp server.mjs /opt/izakhono-witness-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-witness-node /var/lib/izakhono-witness

if [ ! -f /etc/izakhono/witness/private.pem ] || [ ! -f /etc/izakhono/witness/public.pem ]; then
  sudo node - <<'NODE'
const {generateKeyPairSync}=require("crypto");
const fs=require("fs");
const {privateKey,publicKey}=generateKeyPairSync("ed25519");
fs.writeFileSync("/etc/izakhono/witness/private.pem",privateKey.export({type:"pkcs8",format:"pem"}),{mode:0o600});
fs.writeFileSync("/etc/izakhono/witness/public.pem",publicKey.export({type:"spki",format:"pem"}),{mode:0o644});
NODE
fi
sudo chown root:izakhono /etc/izakhono/witness/private.pem /etc/izakhono/witness/public.pem
sudo chmod 0640 /etc/izakhono/witness/private.pem
sudo chmod 0644 /etc/izakhono/witness/public.pem

if [ ! -f /etc/izakhono/witness-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/witness-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8930
IZAKHONO_WITNESS_ADMIN_KEY=$KEY
EOF
  sudo chmod 600 /etc/izakhono/witness-node.env
fi

sudo cp systemd/izakhono-witness-node.service /etc/systemd/system/izakhono-witness-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-witness-node
sudo systemctl --no-pager --full status izakhono-witness-node

echo
echo "IZAKHONO WITNESS NODE installed."
echo "Production quorum value requires this service to run on a failure domain independent of both primary and standby."
