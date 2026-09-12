#!/usr/bin/env sh
set -eu

app="faisready"
revision="${GITHUB_SHA:-manual}"
short="$(printf '%s' "$revision" | cut -c1-12)"
image="${app}:izakhono-${short}"
canary="${app}-canary"
canary_port="${IZAKHONO_CANARY_PORT:-18208}"
prod_port="${IZAKHONO_PRODUCTION_PORT:-18108}"
data_volume="faisready_data"
canary_volume="faisready_canary_data"

docker build   --label "za.co.izakhono.product=FAISReady"   --label "za.co.izakhono.commit=$revision"   --label "za.co.izakhono.channel=controlled-pilot"   -f FAISReady/Dockerfile.izakhono-runtime   -t "$image" FAISReady

docker volume create "$data_volume" >/dev/null
docker volume create "$canary_volume" >/dev/null
docker rm -f "$canary" >/dev/null 2>&1 || true

run_args="--env FAISREADY_PAYMENT_ORCHESTRATOR=direct --env PAYFAST_SANDBOX=true --env FAISREADY_IZAKHONO_PAY_LIVE_APPROVED=false"
if [ -n "${FAISREADY_ENV_FILE:-}" ] && [ -f "$FAISREADY_ENV_FILE" ]; then
  env_file_args="--env-file $FAISREADY_ENV_FILE"
else
  env_file_args=""
fi

# shellcheck disable=SC2086
docker run -d --name "$canary" $env_file_args $run_args   -v "${canary_volume}:/var/lib/faisready"   -p "127.0.0.1:${canary_port}:8080" "$image" >/dev/null
cleanup(){ docker rm -f "$canary" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${canary_port}/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:${canary_port}/health" >/dev/null
cfg="$(curl -fsS "http://127.0.0.1:${canary_port}/api/config")"
printf '%s' "$cfg" | grep -q '"payments_configured": false' || {
  printf '%s
' "$cfg"
  echo "Migration canary unexpectedly has payments configured; refusing promotion." >&2
  exit 4
}

old_image=""
if docker container inspect "$app" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Config.Image}}' "$app")"
  docker rm -f "$app" >/dev/null
fi

rollback(){
  docker rm -f "$app" >/dev/null 2>&1 || true
  if [ -n "$old_image" ]; then
    # shellcheck disable=SC2086
    docker run -d --name "$app" --restart unless-stopped $env_file_args $run_args       -v "${data_volume}:/var/lib/faisready"       -p "127.0.0.1:${prod_port}:8080" "$old_image" >/dev/null || true
  fi
}

# shellcheck disable=SC2086
docker run -d --name "$app" --restart unless-stopped $env_file_args $run_args   -v "${data_volume}:/var/lib/faisready"   -p "127.0.0.1:${prod_port}:8080" "$image" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:${prod_port}/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:${prod_port}/health" >/dev/null || { rollback; exit 6; }
cfg="$(curl -fsS "http://127.0.0.1:${prod_port}/api/config")"
printf '%s' "$cfg" | grep -q '"payments_configured": false' || { rollback; exit 7; }

echo "[PASS] FAISReady controlled-pilot runtime promoted to IZAKHONO owner host with payments locked."
