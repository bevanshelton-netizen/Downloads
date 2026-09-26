#!/usr/bin/env bash
set -euo pipefail

MIRROR_ROOT="/var/lib/izakhono-source-mirrors"
REPO="$MIRROR_ROOT/allegro-vibez"
REMOTE="https://github.com/bevanshelton-netizen/allegro-vibez.git"
ENV_FILE="${ALLEGRO_ENV_FILE:-/etc/izakhono/allegro-vibez.env}"
STATE_DIR="/var/lib/izakhono-deploy"
APP="allegro-vibez"
CANARY="allegro-vibez-canary"
CANARY_PORT=18208
PROD_PORT=18108

for c in git docker curl node; do command -v "$c" >/dev/null 2>&1 || { echo "$c required"; exit 2; }; done
[ -s "$ENV_FILE" ] || { echo "Protected Allegro environment missing: $ENV_FILE"; exit 3; }
mkdir -p "$MIRROR_ROOT" "$STATE_DIR"
chmod 0700 "$MIRROR_ROOT" "$STATE_DIR"

read_env(){
  local key="$1"
  grep -E "^$key=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}
CORE_URL="$(read_env VITE_IZAKHONO_CORE_URL)"
PROJECT="$(read_env VITE_IZAKHONO_PROJECT || true)"
PUBLIC_KEY="$(read_env VITE_IZAKHONO_PUBLIC_KEY)"
[ -n "$PROJECT" ] || PROJECT="allegro-vibez"
[ "$PROJECT" = "allegro-vibez" ] || { echo "VITE_IZAKHONO_PROJECT must be allegro-vibez"; exit 4; }
[ "${#PUBLIC_KEY}" -ge 20 ] || { echo "Browser-safe Allegro public project key is missing"; exit 4; }
case "$CORE_URL" in
  https://*|http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Allegro Core URL must be HTTPS or infrastructure-loopback HTTP"; exit 4 ;;
esac

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none "$REMOTE" "$REPO"
fi
[ -z "$(git -C "$REPO" status --porcelain)" ] || { echo "Allegro mirror has local changes"; exit 5; }
git -C "$REPO" fetch --quiet origin main
git -C "$REPO" checkout -q main
git -C "$REPO" reset --hard -q origin/main
REVISION="$(git -C "$REPO" rev-parse HEAD)"

LOCAL_ORIGIN="http://127.0.0.1:$PROD_PORT"
curl -fsS --max-time 8 -H "Origin: $LOCAL_ORIGIN" "$CORE_URL/healthz" >/tmp/allegro-core-health.json || {
  echo "IZAKHONO Core health is unavailable for Allegro"; exit 6;
}
grep -q '"ok":true' /tmp/allegro-core-health.json || { echo "IZAKHONO Core health payload invalid"; exit 6; }

IMAGE="allegro-vibez:izakhono-$(printf '%s' "$REVISION" | cut -c1-12)"
docker build   --build-arg "VITE_IZAKHONO_CORE_URL=$CORE_URL"   --build-arg "VITE_IZAKHONO_PROJECT=$PROJECT"   --build-arg "VITE_IZAKHONO_PUBLIC_KEY=$PUBLIC_KEY"   --build-arg "VITE_IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112"   --label "za.co.izakhono.product=ALLEGRO VIBEZ"   --label "za.co.izakhono.commit=$REVISION"   --label "za.co.izakhono.channel=infrastructure-private-pilot"   -t "$IMAGE" "$REPO"

docker rm -f "$CANARY" >/dev/null 2>&1 || true
docker run -d --name "$CANARY" -p "127.0.0.1:$CANARY_PORT:8080" "$IMAGE" >/dev/null
cleanup(){ docker rm -f "$CANARY" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/dev/null
for route in / /radio /artists /join-artists /career /revenue /radio-academy /creator-hub /login /register; do
  curl -fsS "http://127.0.0.1:$CANARY_PORT$route" | grep -q 'id="root"' || { echo "Allegro route failed: $route"; exit 7; }
done

OLD_IMAGE=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  OLD_IMAGE="$(docker container inspect --format '{{.Config.Image}}' "$APP")"
  docker rm -f "$APP" >/dev/null
fi
rollback(){
  docker rm -f "$APP" >/dev/null 2>&1 || true
  [ -z "$OLD_IMAGE" ] || docker run -d --name "$APP" --restart unless-stopped -p "127.0.0.1:$PROD_PORT:8080" "$OLD_IMAGE" >/dev/null || true
}

docker run -d --name "$APP" --restart unless-stopped -p "127.0.0.1:$PROD_PORT:8080" "$IMAGE" >/dev/null || { rollback; exit 8; }
for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/dev/null || { rollback; exit 9; }
for route in / /radio /artists /creator-hub; do
  curl -fsS "http://127.0.0.1:$PROD_PORT$route" | grep -q 'id="root"' || { rollback; exit 10; }
done

node - "$STATE_DIR/allegro-vibez.json" "$REVISION" "$CORE_URL" <<'NODE'
const fs=require('fs');
const [path,revision,coreUrl]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
 schema:'izakhono.infrastructure-deployment/v1',
 app:'allegro-vibez',product:'ALLEGRO VIBEZ',revision,
 source_authority:'CONTROLLED_EXTERNAL_SOURCE_MIRROR',
 runtime_authority:'IZAKHONO_INFRASTRUCTURE',
 runtime:'docker-loopback-private-pilot',
 local_url:'http://127.0.0.1:18108',core_url:coreUrl,
 health_passed:true,route_gate_passed:true,
 laptop_target:false,platform_to_laptop_traffic:'DENY',
 public_dns_changed:false,public_traffic_changed:false,live_payments_changed:false,
 public_live_claim:false,external_resilience_preserved:true,
 deployed_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE

echo "ALLEGRO_INFRASTRUCTURE_DEPLOYMENT=VERIFIED"
echo "PUBLIC_LIVE_CLAIM=false"
