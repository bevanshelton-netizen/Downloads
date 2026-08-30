#!/usr/bin/env bash
set -euo pipefail
DOMAIN=$(grep '^CLOUD_DOMAIN=' .env | cut -d= -f2-)
FAIL=0
printf 'IZAKHONO CLOUD production-proof readiness for %s\n' "$DOMAIN"

for svc in postgres minio control identity edge runner gateway ops-agent owner-console; do
  if docker compose ps --status running "$svc" | grep -q "$svc"; then
    echo "PASS service $svc"
  else
    echo "FAIL service $svc"
    FAIL=1
  fi
done

if docker compose exec -T postgres pg_isready -U "$(grep '^POSTGRES_USER=' .env|cut -d= -f2-)" -d "$(grep '^POSTGRES_DB=' .env|cut -d= -f2-)" >/dev/null 2>&1; then
  echo 'PASS postgres readiness'
else
  echo 'FAIL postgres readiness'
  FAIL=1
fi

for url in \
  "https://${DOMAIN}/api/ready" \
  "https://id.${DOMAIN}/ready" \
  "https://apps.${DOMAIN}/health"; do
  code=$(curl -LksS -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)
  if [ "$code" = 200 ]; then
    echo "PASS http 200 $url"
  else
    echo "FAIL http $code $url"
    FAIL=1
  fi
done

if docker network inspect "$(grep '^APP_RUNTIME_NETWORK=' .env|cut -d= -f2-)" >/dev/null 2>&1; then
  echo 'PASS customer runtime network'
else
  echo 'FAIL customer runtime network'
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo 'SERVER READINESS: PASS'
else
  echo 'SERVER READINESS: FAIL'
fi
exit "$FAIL"
