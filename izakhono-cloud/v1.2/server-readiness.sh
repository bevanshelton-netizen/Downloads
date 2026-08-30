#!/usr/bin/env bash
set -euo pipefail
DOMAIN=$(grep '^CLOUD_DOMAIN=' .env | cut -d= -f2-)
FAIL=0
printf 'IZAKHONO CLOUD readiness for %s\n' "$DOMAIN"
for svc in postgres control identity edge runner gateway ops-agent owner-console; do
  if docker compose ps --status running "$svc" | grep -q "$svc"; then echo "PASS service $svc"; else echo "FAIL service $svc"; FAIL=1; fi
done
for url in "https://${DOMAIN}/health" "https://id.${DOMAIN}/health" "https://apps.${DOMAIN}/health"; do
  code=$(curl -LksS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || true)
  if [ "$code" = 200 ] || [ "$code" = 404 ]; then echo "PASS http $code $url"; else echo "FAIL http $code $url"; FAIL=1; fi
done
if [ "$FAIL" -eq 0 ]; then echo 'SERVER READINESS: PASS'; else echo 'SERVER READINESS: CHECK REQUIRED'; fi
exit "$FAIL"
