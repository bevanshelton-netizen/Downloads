#!/usr/bin/env bash
set -euo pipefail
command -v node >/dev/null 2>&1 || { echo "Node.js 22.13+ is required."; exit 2; }
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-model-worker-node /etc/izakhono
sudo cp server.mjs /opt/izakhono-model-worker-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-model-worker-node
if [ ! -f /etc/izakhono/model-worker.env ]; then
  WORKER_KEY="$(sudo awk -F= '$1=="IZAKHONO_GPU_WORKER_KEY"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/gpu-compute-node.env 2>/dev/null || true)"
  sudo tee /etc/izakhono/model-worker.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8866
IZAKHONO_MODEL_WORKER_NAME=isn-01-model-worker
IZAKHONO_GPU_COMPUTE_URL=http://127.0.0.1:8865
IZAKHONO_GPU_WORKER_KEY=$WORKER_KEY
IZAKHONO_MODEL_ENGINE_URL=http://127.0.0.1:11434
IZAKHONO_MODEL_ENGINE_CHAT_PATH=/v1/chat/completions
IZAKHONO_MODEL_ENGINE_KEY=
IZAKHONO_MODEL_ENGINE_ALLOWLIST=127.0.0.1,localhost,::1
IZAKHONO_MODEL_WORKER_MODELS=[]
IZAKHONO_MODEL_WORKER_ALLOW_CPU=true
IZAKHONO_MODEL_WORKER_HEARTBEAT_MS=15000
IZAKHONO_MODEL_ENGINE_TIMEOUT_MS=120000
EOF
  sudo chmod 600 /etc/izakhono/model-worker.env
fi
sudo cp systemd/izakhono-model-worker-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-model-worker-node
sudo systemctl --no-pager --full status izakhono-model-worker-node
echo "IZAKHONO MODEL WORKER installed. It remains not-ready until a model engine and model mapping are configured."
