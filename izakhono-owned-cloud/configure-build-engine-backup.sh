#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ENV=/etc/izakhono/backup-node.env
[[ -f "$BACKUP_ENV" ]] || { echo "BACKUP NODE is not installed."; exit 2; }
[[ -d /var/lib/izakhono-build-engine ]] || { echo "Build Engine state directory missing."; exit 3; }
[[ -d /var/lib/izakhono-runtime ]] || { echo "Runtime release directory missing."; exit 4; }

ADMIN_KEY="$(awk -F= '$1=="IZAKHONO_BACKUP_ADMIN_KEY" {sub(/^[^=]*=/,""); print; exit}' "$BACKUP_ENV")"
[[ -n "$ADMIN_KEY" ]] || { echo "BACKUP admin key missing."; exit 5; }
PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({name:"owned-build-engine",sources:["/var/lib/izakhono-build-engine","/var/lib/izakhono-runtime"],retentionCount:30,enabled:true}))')"
TMP="$(mktemp)"
CODE="$(curl -sS -o "$TMP" -w '%{http_code}' -X POST http://127.0.0.1:8870/v1/sets -H "content-type: application/json" -H "x-izakhono-key: $ADMIN_KEY" --data-binary "$PAYLOAD")"
unset ADMIN_KEY PAYLOAD
if [[ "$CODE" == "201" ]]; then
  rm -f "$TMP"
  echo "OWNED_BUILD_ENGINE_BACKUP_SET=CREATED"
elif [[ "$CODE" == "409" ]]; then
  rm -f "$TMP"
  echo "OWNED_BUILD_ENGINE_BACKUP_SET=ALREADY_EXISTS"
else
  echo "Could not register owned-build-engine backup set (HTTP $CODE)."
  cat "$TMP"
  rm -f "$TMP"
  exit 6
fi
