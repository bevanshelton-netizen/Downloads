#!/usr/bin/env sh
set -eu

slug="${1:?slug required}"
context="${2:?build context required}"
host_port="${3:?host port required}"
health_path="${4:-/healthz.txt}"

case "$slug" in
  ''|*[!a-z0-9-]*) echo "Unsafe slug" >&2; exit 2;;
esac
case "$context" in
  /*|*..*) echo "Unsafe context" >&2; exit 2;;
esac

[ -d "$context" ] || { echo "Missing context: $context" >&2; exit 3; }
[ -f "$context/Dockerfile" ] || { echo "Missing Dockerfile: $context/Dockerfile" >&2; exit 3; }

revision="${GITHUB_SHA:-manual}"
short_revision="$(printf '%s' "$revision" | cut -c1-12)"
image="${slug}:izakhono-${short_revision}"
canary="${slug}-canary"
production="${slug}"
canary_port="$((host_port + 100))"

docker build   --label "za.co.izakhono.product=$slug"   --label "za.co.izakhono.commit=$revision"   --label "za.co.izakhono.channel=production-candidate"   -t "$image" "$context"

docker rm -f "$canary" >/dev/null 2>&1 || true
docker run -d --name "$canary" -p "127.0.0.1:${canary_port}:80" "$image" >/dev/null
cleanup(){ docker rm -f "$canary" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

attempt=0
until curl --fail --silent --show-error "http://127.0.0.1:${canary_port}${health_path}" >/dev/null; do
  attempt=$((attempt+1))
  [ "$attempt" -lt 30 ] || { docker logs "$canary" || true; echo "Canary failed for $slug" >&2; exit 4; }
  sleep 2
done

old_image=""
if docker container inspect "$production" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Config.Image}}' "$production")"
  docker rm -f "$production" >/dev/null
fi

rollback(){
  docker rm -f "$production" >/dev/null 2>&1 || true
  if [ -n "$old_image" ]; then
    docker run -d --name "$production" --restart unless-stopped -p "127.0.0.1:${host_port}:80" "$old_image" >/dev/null || true
  fi
}

if ! docker run -d --name "$production" --restart unless-stopped -p "127.0.0.1:${host_port}:80" "$image" >/dev/null; then
  rollback; exit 5
fi

attempt=0
until curl --fail --silent --show-error "http://127.0.0.1:${host_port}${health_path}" >/dev/null; do
  attempt=$((attempt+1))
  [ "$attempt" -lt 30 ] || { docker logs "$production" || true; rollback; echo "Production health failed for $slug" >&2; exit 6; }
  sleep 2
done

echo "[PASS] $slug promoted to IZAKHONO owner host on loopback port $host_port"
