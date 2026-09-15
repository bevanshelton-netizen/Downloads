#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <offline-destination-file>"
  exit 2
fi

DEST="$1"
ENV_FILE=/etc/izakhono/replica-node.env
if [ ! -f "$ENV_FILE" ]; then
  echo "REPLICA NODE is not installed."
  exit 3
fi
if [ -e "$DEST" ]; then
  echo "Destination already exists; refusing to overwrite it."
  exit 4
fi

NODE_ID="$(sudo awk -F= '$1=="IZAKHONO_REPLICA_NODE_ID" {sub(/^[^=]*=/,""); print; exit}' "$ENV_FILE")"
RECEIVE="$(sudo awk -F= '$1=="IZAKHONO_REPLICA_RECEIVE_KEY" {sub(/^[^=]*=/,""); print; exit}' "$ENV_FILE")"
if [ -z "$RECEIVE" ]; then
  echo "Replica receive key not found."
  exit 5
fi

umask 077
{
  printf 'IZAKHONO_REPLICA_NODE_ID=%s\n' "$NODE_ID"
  printf 'IZAKHONO_REPLICA_RECEIVE_KEY=%s\n' "$RECEIVE"
} >"$DEST"
unset RECEIVE

echo "Replica receiver credential copied to the requested offline file."
echo "Transfer it securely to the primary node administrator; do not commit it to source control."
