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
sudo mkdir -p /opt/izakhono-gpu-compute-node /var/lib/izakhono-gpu-compute /etc/izakhono
sudo cp server.mjs /opt/izakhono-gpu-compute-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-gpu-compute-node /var/lib/izakhono-gpu-compute

if [ ! -f /etc/izakhono/gpu-compute-node.env ]; then
  SERVICE_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  WORKER_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/gpu-compute-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8865
IZAKHONO_GPU_COMPUTE_DB=/var/lib/izakhono-gpu-compute/gpu-compute.sqlite
IZAKHONO_GPU_COMPUTE_KEY=$SERVICE_KEY
IZAKHONO_GPU_WORKER_KEY=$WORKER_KEY
IZAKHONO_GPU_WORKER_ALLOWLIST=127.0.0.1,localhost,::1
IZAKHONO_GPU_STALE_SECONDS=45
IZAKHONO_GPU_TIMEOUT_MS=120000
EOF
  sudo chmod 600 /etc/izakhono/gpu-compute-node.env
fi

sudo cp systemd/izakhono-gpu-compute-node.service /etc/systemd/system/izakhono-gpu-compute-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-gpu-compute-node
sudo systemctl --no-pager --full status izakhono-gpu-compute-node

echo
echo "IZAKHONO GPU COMPUTE NODE installed."
echo "No physical GPU worker is implied by installing the control plane."
echo "Worker keys remain in /etc/izakhono/gpu-compute-node.env and are not printed."
