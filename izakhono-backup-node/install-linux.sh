#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi
if ! command -v tar >/dev/null 2>&1; then
  echo "GNU tar is required."
  exit 3
fi

sudo mkdir -p /opt/izakhono-backup-node   /var/lib/izakhono-backup/archives   /var/lib/izakhono-backup/restores   /var/lib/izakhono-backup/mirrors   /etc/izakhono
sudo cp server.mjs /opt/izakhono-backup-node/server.mjs
sudo chown -R root:root /opt/izakhono-backup-node /var/lib/izakhono-backup
sudo chmod 0700 /var/lib/izakhono-backup /var/lib/izakhono-backup/archives /var/lib/izakhono-backup/restores

if [ ! -f /etc/izakhono/backup-node.env ]; then
  ADMIN="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  ENC="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))')"
  sudo tee /etc/izakhono/backup-node.env >/dev/null <<EOF
HOST=127.0.0.1
PORT=8870
IZAKHONO_BACKUP_ADMIN_KEY=$ADMIN
IZAKHONO_BACKUP_ENCRYPTION_KEY=$ENC
IZAKHONO_BACKUP_SOURCE_ALLOWLIST=/etc/izakhono,/var/lib/izakhono-data,/var/lib/izakhono-object,/var/lib/izakhono-queue,/var/lib/izakhono-runtime,/var/lib/izakhono-auth,/var/lib/izakhono-analytics,/var/lib/izakhono-notify,/var/lib/izakhono-ai-gateway,/var/lib/izakhono-code,/var/lib/izakhono-ci,/var/lib/izakhono-replica
IZAKHONO_BACKUP_MIRROR_ROOTS=
IZAKHONO_BACKUP_INTERVAL_HOURS=24
IZAKHONO_BACKUP_MAX_BODY_BYTES=262144
EOF
  sudo chmod 600 /etc/izakhono/backup-node.env
fi

sudo cp systemd/izakhono-backup-node.service /etc/systemd/system/izakhono-backup-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-backup-node
sudo systemctl --no-pager --full status izakhono-backup-node

echo
echo "IZAKHONO BACKUP NODE installed."
echo "IMPORTANT: copy the backup encryption recovery key to a separate offline medium."
echo "Use export-recovery-key.sh with a mounted offline destination."
