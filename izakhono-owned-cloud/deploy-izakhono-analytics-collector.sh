#!/usr/bin/env bash
set -euo pipefail

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
STATE_DIR="/var/lib/izakhono-deploy"
SECRET_DIR="/var/lib/izakhono-secrets"
HASH_FILE="$SECRET_DIR/analytics-hash-secret"
ADMIN_FILE="$SECRET_DIR/analytics-admin-token"
APP="izakhono-analytics"
CANARY="izakhono-analytics-canary"
CANARY_PORT=18212
PROD_PORT=18112
DATA_VOL="izakhono_analytics_data"

for c in git docker curl python3 node; do command -v "$c" >/dev/null 2>&1 || { echo "$c required"; exit 2; }; done
[ -d "$ROOT/.git" ] || { echo "Canonical IZAKHONO source missing"; exit 3; }
REVISION="$(git -C "$ROOT" rev-parse HEAD)"

mkdir -p "$STATE_DIR" "$SECRET_DIR"
chmod 0700 "$STATE_DIR" "$SECRET_DIR"

if [ ! -s "$HASH_FILE" ]; then
  umask 077
  python3 - <<'PY' >"$HASH_FILE"
import secrets
print(secrets.token_urlsafe(48))
PY
fi
if [ ! -s "$ADMIN_FILE" ]; then
  umask 077
  python3 - <<'PY' >"$ADMIN_FILE"
import secrets
print(secrets.token_urlsafe(48))
PY
fi
HASH_SECRET="$(cat "$HASH_FILE")"
ADMIN_TOKEN="$(cat "$ADMIN_FILE")"
[ "${#HASH_SECRET}" -ge 32 ] || { echo "Analytics hash secret invalid"; exit 4; }
[ "${#ADMIN_TOKEN}" -ge 32 ] || { echo "Analytics admin token invalid"; exit 4; }

PUBLIC_ORIGINS="$(node - "$ROOT/owner-host/platforms.json" <<'NODE'
const fs=require('fs');
const p=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=[];
for(const item of p.platforms||[]){
  const host=String(item.defaultHostname||'').trim().toLowerCase().replace(/\.$/,'');
  if(host) out.push('https://'+host);
}
process.stdout.write([...new Set(out)].join(','));
NODE
)"
LOCAL_ORIGINS="http://127.0.0.1:18106,http://127.0.0.1:18107,http://127.0.0.1:18108,http://127.0.0.1:18110,http://127.0.0.1:18111"
ALLOWED_ORIGINS="$LOCAL_ORIGINS"
[ -z "$PUBLIC_ORIGINS" ] || ALLOWED_ORIGINS="$ALLOWED_ORIGINS,$PUBLIC_ORIGINS"
[ -z "${IZAKHONO_ANALYTICS_PUBLIC_ORIGINS:-}" ] || ALLOWED_ORIGINS="$ALLOWED_ORIGINS,${IZAKHONO_ANALYTICS_PUBLIC_ORIGINS}"

IMAGE="izakhono-analytics:$(printf '%s' "$REVISION" | cut -c1-12)"
cd "$ROOT"
docker build   --label "za.co.izakhono.product=IZAKHONO Analytics"   --label "za.co.izakhono.commit=$REVISION"   --label "za.co.izakhono.channel=infrastructure-private-pilot"   -t "$IMAGE" izakhono-analytics

docker volume inspect "$DATA_VOL" >/dev/null 2>&1 || docker volume create "$DATA_VOL" >/dev/null
docker rm -f "$CANARY" >/dev/null 2>&1 || true
docker run -d --name "$CANARY"   -e ANALYTICS_HASH_SECRET="$HASH_SECRET"   -e ANALYTICS_RETENTION_DAYS=180   -e ANALYTICS_ALLOWED_ORIGINS="$ALLOWED_ORIGINS"   -e ANALYTICS_ADMIN_TOKEN="$ADMIN_TOKEN"   -e ANALYTICS_REQUIRE_ORIGIN=true   -v "$DATA_VOL:/data"   -p "127.0.0.1:$CANARY_PORT:8080" "$IMAGE" >/dev/null

cleanup(){ docker rm -f "$CANARY" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/tmp/izakhono-analytics-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/tmp/izakhono-analytics-health.json
grep -q '"ok":true' /tmp/izakhono-analytics-health.json
grep -q '"privacy":"no-raw-ip-storage"' /tmp/izakhono-analytics-health.json
curl -fsS "http://127.0.0.1:$CANARY_PORT/dashboard" | grep -q 'IZAKHONO Analytics Command Centre'

OLD_IMAGE=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  OLD_IMAGE="$(docker container inspect --format '{{.Config.Image}}' "$APP")"
  docker rm -f "$APP" >/dev/null
fi
rollback(){
  docker rm -f "$APP" >/dev/null 2>&1 || true
  if [ -n "$OLD_IMAGE" ]; then
    docker run -d --name "$APP" --restart unless-stopped       -e ANALYTICS_HASH_SECRET="$HASH_SECRET"       -e ANALYTICS_RETENTION_DAYS=180       -e ANALYTICS_ALLOWED_ORIGINS="$ALLOWED_ORIGINS"       -e ANALYTICS_ADMIN_TOKEN="$ADMIN_TOKEN"       -e ANALYTICS_REQUIRE_ORIGIN=true       -v "$DATA_VOL:/data"       -p "127.0.0.1:$PROD_PORT:8080" "$OLD_IMAGE" >/dev/null || true
  fi
}

docker run -d --name "$APP" --restart unless-stopped   -e ANALYTICS_HASH_SECRET="$HASH_SECRET"   -e ANALYTICS_RETENTION_DAYS=180   -e ANALYTICS_ALLOWED_ORIGINS="$ALLOWED_ORIGINS"   -e ANALYTICS_ADMIN_TOKEN="$ADMIN_TOKEN"   -e ANALYTICS_REQUIRE_ORIGIN=true   -v "$DATA_VOL:/data"   -p "127.0.0.1:$PROD_PORT:8080" "$IMAGE" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/tmp/izakhono-analytics-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/tmp/izakhono-analytics-health.json || { rollback; exit 6; }
grep -q '"ok":true' /tmp/izakhono-analytics-health.json || { rollback; exit 7; }
curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" "http://127.0.0.1:$PROD_PORT/api/summary?days=1" >/tmp/izakhono-analytics-summary.json || { rollback; exit 8; }

node - "$STATE_DIR/izakhono-analytics-collector.json" "$REVISION" <<'NODE'
const fs=require('fs');
const [path,revision]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
 schema:'izakhono.infrastructure-deployment/v1',
 app:'izakhono-analytics-collector',product:'IZAKHONO Analytics',revision,
 runtime_authority:'IZAKHONO_INFRASTRUCTURE',
 runtime:'docker-loopback-private-pilot',
 local_url:'http://127.0.0.1:18112',
 health_passed:true,privacy_mode:'no-raw-ip-storage',
 admin_protected:true,retention_days:180,
 laptop_target:false,platform_to_laptop_traffic:'DENY',
 public_dns_changed:false,public_traffic_changed:false,live_payments_changed:false,
 public_live_claim:false,external_resilience_preserved:true,
 deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE

echo "IZAKHONO_ANALYTICS_INFRASTRUCTURE_DEPLOYMENT=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
