#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then echo "Node.js 22.13+ is required."; exit 2; fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-package-node /var/lib/izakhono-package/{cache,tmp} /etc/izakhono
sudo cp server.mjs /opt/izakhono-package-node/server.mjs
sudo chown -R izakhono:izakhono /opt/izakhono-package-node /var/lib/izakhono-package

if [ ! -f /etc/izakhono/package-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/package-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8910
IZAKHONO_PACKAGE_UPSTREAM=https://registry.npmjs.org
IZAKHONO_PACKAGE_PUBLIC_URL=http://127.0.0.1:8910
IZAKHONO_PACKAGE_KEY=$KEY
IZAKHONO_PACKAGE_MAX_BYTES=536870912
IZAKHONO_PACKAGE_METADATA_TTL_SECONDS=300
IZAKHONO_PACKAGE_TARBALL_TTL_SECONDS=31536000
EOF
  sudo chmod 600 /etc/izakhono/package-node.env
fi

sudo cp systemd/izakhono-package-node.service /etc/systemd/system/izakhono-package-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-package-node
sudo systemctl --no-pager --full status izakhono-package-node
