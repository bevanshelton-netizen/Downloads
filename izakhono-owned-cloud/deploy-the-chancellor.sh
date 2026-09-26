#!/usr/bin/env bash
set -euo pipefail

MIRROR_ROOT="/var/lib/izakhono-source-mirrors"
REPO="$MIRROR_ROOT/the-chancellor"
REMOTE="https://github.com/bevanshelton-netizen/the-chancellor.git"
ENV_FILE="${CHANCELLOR_ENV_FILE:-/etc/izakhono/the-chancellor.env}"
STATE_DIR="/var/lib/izakhono-deploy"
APP="the-chancellor"
CANARY="the-chancellor-canary"
CANARY_PORT=18206
PROD_PORT=18106
DATA_VOL="the_chancellor_data"
CANARY_VOL="the_chancellor_canary_data"

for c in git docker curl python3 node; do command -v "$c" >/dev/null 2>&1 || { echo "$c required"; exit 2; }; done
mkdir -p "$MIRROR_ROOT" "$STATE_DIR" /etc/izakhono
chmod 0700 "$MIRROR_ROOT" "$STATE_DIR"

if [ ! -s "$ENV_FILE" ]; then
  umask 077
  python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import secrets,sys
p=Path(sys.argv[1])
vals={
"NODE_ENV":"production","PORT":"3000",
"APP_URL":"https://chancellor.private.invalid",
"DATA_DIR":"/app/data","SESSION_SECRET":secrets.token_urlsafe(48),
"ADMIN_EMAIL":"owner@chancellor.private.invalid","ADMIN_PASSWORD":secrets.token_urlsafe(24),
"OPENAI_API_KEY":"","PAYFAST_MODE":"sandbox","PAYFAST_MERCHANT_ID":"",
"PAYFAST_MERCHANT_KEY":"","PAYFAST_PASSPHRASE":"",
"RESEND_API_KEY":"","TWILIO_ACCOUNT_SID":"","TWILIO_AUTH_TOKEN":""
}
p.write_text("\n".join(f"{k}={v}" for k,v in vals.items())+"\n",encoding="utf-8")
p.chmod(0o600)
PY
fi

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none "$REMOTE" "$REPO"
fi
[ -z "$(git -C "$REPO" status --porcelain)" ] || { echo "Chancellor mirror has local changes"; exit 3; }
git -C "$REPO" fetch --quiet origin main
git -C "$REPO" checkout -q main
git -C "$REPO" reset --hard -q origin/main
REVISION="$(git -C "$REPO" rev-parse HEAD)"
IMAGE="the-chancellor:izakhono-$(printf '%s' "$REVISION" | cut -c1-12)"

docker build   --label "za.co.izakhono.product=THE CHANCELLOR"   --label "za.co.izakhono.commit=$REVISION"   --label "za.co.izakhono.channel=infrastructure-private-pilot"   -t "$IMAGE" "$REPO"

docker volume create "$DATA_VOL" >/dev/null
docker volume create "$CANARY_VOL" >/dev/null
docker rm -f "$CANARY" >/dev/null 2>&1 || true
docker run -d --name "$CANARY"   --env-file "$ENV_FILE"   -e PAYFAST_MODE=sandbox   -e IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112   -e PAYFAST_MERCHANT_ID= -e PAYFAST_MERCHANT_KEY= -e PAYFAST_PASSPHRASE=   -e IZAKHONO_RUNTIME=true -e PERSISTENT_STORAGE=true   -v "$CANARY_VOL:/app/data" -p "127.0.0.1:$CANARY_PORT:3000" "$IMAGE" >/dev/null

cleanup(){ docker rm -f "$CANARY" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$CANARY_PORT/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$CANARY_PORT/api/health" >/dev/null
READY="$(curl -fsS "http://127.0.0.1:$CANARY_PORT/api/go-live")"
printf '%s' "$READY" | grep -q '"readyForPaidTraffic":false' || { echo "Chancellor paid-traffic gate unexpectedly open"; exit 4; }

OLD_IMAGE=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  OLD_IMAGE="$(docker container inspect --format '{{.Config.Image}}' "$APP")"
  docker rm -f "$APP" >/dev/null
fi
rollback(){
  docker rm -f "$APP" >/dev/null 2>&1 || true
  if [ -n "$OLD_IMAGE" ]; then
    docker run -d --name "$APP" --restart unless-stopped       --env-file "$ENV_FILE" -e PAYFAST_MODE=sandbox       -e IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112       -e PAYFAST_MERCHANT_ID= -e PAYFAST_MERCHANT_KEY= -e PAYFAST_PASSPHRASE=       -e IZAKHONO_RUNTIME=true -e PERSISTENT_STORAGE=true       -v "$DATA_VOL:/app/data" -p "127.0.0.1:$PROD_PORT:3000" "$OLD_IMAGE" >/dev/null || true
  fi
}

docker run -d --name "$APP" --restart unless-stopped   --env-file "$ENV_FILE" -e PAYFAST_MODE=sandbox   -e IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112   -e PAYFAST_MERCHANT_ID= -e PAYFAST_MERCHANT_KEY= -e PAYFAST_PASSPHRASE=   -e IZAKHONO_RUNTIME=true -e PERSISTENT_STORAGE=true   -v "$DATA_VOL:/app/data" -p "127.0.0.1:$PROD_PORT:3000" "$IMAGE" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PROD_PORT/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PROD_PORT/api/health" >/dev/null || { rollback; exit 6; }
READY="$(curl -fsS "http://127.0.0.1:$PROD_PORT/api/go-live")"
printf '%s' "$READY" | grep -q '"readyForPaidTraffic":false' || { rollback; exit 7; }

node - "$STATE_DIR/the-chancellor.json" "$REVISION" <<'NODE'
const fs=require('fs');
const [path,revision]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
 schema:'izakhono.infrastructure-deployment/v1',
 app:'the-chancellor',product:'THE CHANCELLOR',revision,
 source_authority:'CONTROLLED_EXTERNAL_SOURCE_MIRROR',
 runtime_authority:'IZAKHONO_INFRASTRUCTURE',
 runtime:'docker-loopback-private-pilot',
 local_url:'http://127.0.0.1:18106',
 health_passed:true,ready_for_paid_traffic:false,payment_mode:'sandbox-disabled',
 laptop_target:false,platform_to_laptop_traffic:'DENY',
 public_dns_changed:false,public_traffic_changed:false,live_payments_changed:false,
 public_live_claim:false,external_resilience_preserved:true,
 deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE

echo "CHANCELLOR_INFRASTRUCTURE_DEPLOYMENT=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
