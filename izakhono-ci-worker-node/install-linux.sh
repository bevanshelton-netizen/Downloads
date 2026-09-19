#!/usr/bin/env bash
set -euo pipefail

for cmd in node git systemd-run chown; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required."
    exit 2
  fi
done

QUEUE_KEY="$(sudo awk -F= '$1=="IZAKHONO_QUEUE_KEY" {sub(/^[^=]*=/,""); print; exit}' /etc/izakhono/queue-node.env 2>/dev/null || true)"
if [ -z "$QUEUE_KEY" ]; then
  echo "Install IZAKHONO QUEUE NODE first."
  exit 3
fi
if [ ! -f /etc/izakhono/code-node.env ]; then
  echo "Install IZAKHONO CODE NODE first."
  exit 4
fi
if [ ! -f /etc/izakhono/package-node.env ]; then
  echo "Install IZAKHONO PACKAGE NODE first."
  exit 5
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono-ci 2>/dev/null || true
sudo mkdir -p /opt/izakhono-ci-worker-node /var/lib/izakhono-ci/workspaces /var/lib/izakhono-ci/logs /etc/izakhono
sudo cp server.mjs /opt/izakhono-ci-worker-node/server.mjs
sudo chown -R root:root /opt/izakhono-ci-worker-node /var/lib/izakhono-ci
sudo chmod 0700 /var/lib/izakhono-ci /var/lib/izakhono-ci/workspaces /var/lib/izakhono-ci/logs

if [ ! -f /etc/izakhono/ci-worker-node.env ]; then
  ADMIN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENC="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/ci-worker-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8880
IZAKHONO_CI_ADMIN_KEY=$ADMIN
IZAKHONO_CI_ENCRYPTION_KEY=$ENC
IZAKHONO_QUEUE_URL=http://127.0.0.1:8810
IZAKHONO_QUEUE_KEY=$QUEUE_KEY
IZAKHONO_CODE_GIT_BASE=http://127.0.0.1:8860/git
IZAKHONO_PACKAGE_URL=http://127.0.0.1:8910/
IZAKHONO_CI_EXECUTOR=systemd
IZAKHONO_CI_POLL_MS=750
IZAKHONO_CI_COMMAND_ALLOWLIST=node,npm,python3,make
IZAKHONO_CI_STEP_TIMEOUT_SECONDS=900
IZAKHONO_CI_MEMORY_MB=2048
IZAKHONO_CI_CPU_PERCENT=200
IZAKHONO_CI_RETAIN_FAILED_WORKSPACE=0
EOF
  sudo chmod 600 /etc/izakhono/ci-worker-node.env
fi

sudo cp systemd/izakhono-ci-worker-node.service /etc/systemd/system/izakhono-ci-worker-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-ci-worker-node
sudo systemctl --no-pager --full status izakhono-ci-worker-node

echo
echo "IZAKHONO CI WORKER NODE installed with systemd sandbox execution."
echo "Build network access is disabled per pipeline unless explicitly enabled."
