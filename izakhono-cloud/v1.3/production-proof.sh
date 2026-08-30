#!/usr/bin/env bash
set -euo pipefail

./server-readiness.sh

TMP=/tmp/izakhono-proof-$$.dump
trap 'rm -f "$TMP"' EXIT

echo 'Creating non-destructive backup proof...'
docker compose exec -T postgres sh -lc 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$TMP"
[ -s "$TMP" ]
docker run --rm -v "$TMP:/proof.dump:ro" postgres:16-alpine pg_restore --list /proof.dump >/dev/null
echo 'PASS backup archive validation'

RUNTIME=$(grep '^APP_RUNTIME_NETWORK=' .env | cut -d= -f2-)
docker network inspect "$RUNTIME" >/dev/null
echo 'PASS runtime network inspection'

DOMAIN=$(grep '^CLOUD_DOMAIN=' .env | cut -d= -f2-)
for host in "$DOMAIN" "id.$DOMAIN" "apps.$DOMAIN" "owner.$DOMAIN"; do
  expiry=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null || true)
  if [ -n "$expiry" ]; then echo "PASS TLS $host $expiry"; else echo "FAIL TLS $host"; exit 1; fi
done

echo 'PRODUCTION PROOF: PASS'
