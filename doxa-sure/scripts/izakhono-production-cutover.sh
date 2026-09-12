#!/usr/bin/env sh
set -eu
app="doxa-sure"
revision="${GITHUB_SHA:-manual}"
short="$(printf '%s' "$revision" | cut -c1-12)"
image="${app}:izakhono-${short}"
canary="${app}-canary"
canary_port="${IZAKHONO_CANARY_PORT:-18206}"
prod_port="${IZAKHONO_PRODUCTION_PORT:-18106}"
data_volume="doxa_sure_data"
canary_volume="doxa_sure_canary_data"

docker build   --label "za.co.izakhono.product=DOXA-SURE"   --label "za.co.izakhono.commit=$revision"   --label "za.co.izakhono.channel=controlled-pilot"   -t "$image" doxa-sure

docker volume create "$data_volume" >/dev/null
docker volume create "$canary_volume" >/dev/null
docker rm -f "$canary" >/dev/null 2>&1 || true
docker run -d --name "$canary"   -e DOXA_PAYMENT_CALLBACK_ENABLED=false   -v "${canary_volume}:/var/lib/doxa-sure"   -p "127.0.0.1:${canary_port}:8080" "$image" >/dev/null
cleanup(){ docker rm -f "$canary" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${canary_port}/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:${canary_port}/api/health" >/dev/null

old_image=""
if docker container inspect "$app" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Config.Image}}' "$app")"
  docker rm -f "$app" >/dev/null
fi
rollback(){
  docker rm -f "$app" >/dev/null 2>&1 || true
  [ -z "$old_image" ] || docker run -d --name "$app" --restart unless-stopped     -e DOXA_PAYMENT_CALLBACK_ENABLED=false     -v "${data_volume}:/var/lib/doxa-sure"     -p "127.0.0.1:${prod_port}:8080" "$old_image" >/dev/null || true
}
docker run -d --name "$app" --restart unless-stopped   -e DOXA_PAYMENT_CALLBACK_ENABLED=false   -v "${data_volume}:/var/lib/doxa-sure"   -p "127.0.0.1:${prod_port}:8080" "$image" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${prod_port}/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:${prod_port}/api/health" >/dev/null || { rollback; exit 6; }

echo "[PASS] DOXA-SURE controlled pilot promoted to IZAKHONO owner host."
