#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <offline-destination-file>"
  exit 2
fi

DEST="$1"
ENV_FILE=/etc/izakhono/backup-node.env

if [ ! -f "$ENV_FILE" ]; then
  echo "BACKUP NODE is not installed."
  exit 3
fi
if [ -e "$DEST" ]; then
  echo "Destination already exists; refusing to overwrite it."
  exit 4
fi

KEY="$(sudo awk -F= '$1=="IZAKHONO_BACKUP_ENCRYPTION_KEY" {sub(/^[^=]*=/,""); print; exit}' "$ENV_FILE")"
if [ -z "$KEY" ]; then
  echo "Backup encryption key not found."
  exit 5
fi

umask 077
printf 'IZAKHONO_BACKUP_ENCRYPTION_KEY=%s\n' "$KEY" >"$DEST"
unset KEY

echo "Recovery key copied to the requested offline file."
echo "Store that file separately from the backup archives."
