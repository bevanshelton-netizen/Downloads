#!/usr/bin/env bash
set -euo pipefail

BACKUP_ENV=/etc/izakhono/backup-node.env
if [ ! -f "$BACKUP_ENV" ]; then
  echo "BACKUP NODE is not installed."
  exit 2
fi

ADMIN_KEY="$(sudo awk -F= '$1=="IZAKHONO_BACKUP_ADMIN_KEY" {sub(/^[^=]*=/,""); print; exit}' "$BACKUP_ENV")"
if [ -z "$ADMIN_KEY" ]; then
  echo "BACKUP admin key not found."
  exit 3
fi

sources=(
  /etc/izakhono
  /var/lib/izakhono-data
  /var/lib/izakhono-object
  /var/lib/izakhono-queue
  /var/lib/izakhono-runtime
  /var/lib/izakhono-auth
  /var/lib/izakhono-analytics
  /var/lib/izakhono-notify
  /var/lib/izakhono-ai-gateway
  /var/lib/izakhono-code
)

for source in "${sources[@]}"; do
  if [ ! -e "$source" ]; then
    echo "Expected stack source missing: $source"
    exit 4
  fi
done

PAYLOAD="$(node -e '
  const sources=process.argv.slice(1);
  process.stdout.write(JSON.stringify({
    name:"owned-cloud-core",
    sources,
    retentionCount:7,
    enabled:true
  }));
' "${sources[@]}")"

TMP_RESPONSE="$(mktemp)"
HTTP_CODE="$(curl -sS -o "$TMP_RESPONSE" -w '%{http_code}'   -X POST http://127.0.0.1:8870/v1/sets   -H "content-type: application/json"   -H "x-izakhono-key: $ADMIN_KEY"   --data-binary "$PAYLOAD")"

unset ADMIN_KEY PAYLOAD

if [ "$HTTP_CODE" = "409" ]; then
  rm -f "$TMP_RESPONSE"
  echo "Core stack backup set already exists; no duplicate created."
  exit 0
fi

if [ "$HTTP_CODE" != "201" ]; then
  echo "Stack backup configuration failed with HTTP $HTTP_CODE."
  cat "$TMP_RESPONSE"
  rm -f "$TMP_RESPONSE"
  exit 5
fi

rm -f "$TMP_RESPONSE"
echo "Core IZAKHONO OWNED CLOUD backup set configured."
echo "BACKUP NODE's own archive directory is excluded from sources."
echo "Configure a physically separate mirror target and export the recovery key offline."
