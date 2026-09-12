#!/usr/bin/env sh
set -eu

: "${KORA_ENV_FILE:?KORA_ENV_FILE must point to an owner-hosted env file}"
[ -f "$KORA_ENV_FILE" ] || { echo "Missing KORA env file" >&2; exit 2; }

read_env(){
  key="$1"
  line="$(grep -E "^${key}=" "$KORA_ENV_FILE" | tail -n1 || true)"
  value="${line#*=}"
  value="$(printf '%s' "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  printf '%s' "$value"
}

app_url="$(read_env NEXT_PUBLIC_APP_URL)"
supabase_url="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
publishable="$(read_env NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
anon="$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"
operator="$(read_env NEXT_PUBLIC_OPERATOR_NAME)"
support="$(read_env NEXT_PUBLIC_SUPPORT_EMAIL)"
privacy="$(read_env NEXT_PUBLIC_PRIVACY_EMAIL)"
rights="$(read_env NEXT_PUBLIC_RIGHTS_EMAIL)"

case "$app_url" in https://*) ;; *) echo "NEXT_PUBLIC_APP_URL must be HTTPS" >&2; exit 3;; esac
case "$supabase_url" in https://*) ;; *) echo "NEXT_PUBLIC_SUPABASE_URL must be HTTPS" >&2; exit 3;; esac
[ -n "$publishable$anon" ] || { echo "Missing browser-safe Supabase key" >&2; exit 3; }

revision="${GITHUB_SHA:-manual}"
short="$(printf '%s' "$revision" | cut -c1-12)"
image="kora-network:izakhono-${short}"
canary="kora-network-canary"
app="kora-network"
canary_port="${IZAKHONO_CANARY_PORT:-18207}"
prod_port="${IZAKHONO_PRODUCTION_PORT:-18107}"

docker build -f kora-network/Dockerfile.izakhono-production \
  --build-arg "NEXT_PUBLIC_APP_URL=$app_url" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$supabase_url" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishable" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon" \
  --build-arg "NEXT_PUBLIC_OPERATOR_NAME=$operator" \
  --build-arg "NEXT_PUBLIC_SUPPORT_EMAIL=$support" \
  --build-arg "NEXT_PUBLIC_PRIVACY_EMAIL=$privacy" \
  --build-arg "NEXT_PUBLIC_RIGHTS_EMAIL=$rights" \
  --label "za.co.izakhono.product=KORA" \
  --label "za.co.izakhono.commit=$revision" \
  --label "za.co.izakhono.channel=private-beta" \
  -t "$image" kora-network

docker run --rm --env-file "$KORA_ENV_FILE" \
  -e KORA_PREFLIGHT_MODE=private_beta "$image" npm run preflight:production

docker rm -f "$canary" >/dev/null 2>&1 || true
docker run -d --name "$canary" --env-file "$KORA_ENV_FILE" \
  -e KORA_PREFLIGHT_MODE=private_beta \
  -p "127.0.0.1:${canary_port}:3000" "$image" >/dev/null
cleanup(){ docker rm -f "$canary" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
for _ in $(seq 1 45); do
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
  [ -z "$old_image" ] || docker run -d --name "$app" --restart unless-stopped     --env-file "$KORA_ENV_FILE" -e KORA_PREFLIGHT_MODE=private_beta     -p "127.0.0.1:${prod_port}:3000" "$old_image" >/dev/null || true
}
docker run -d --name "$app" --restart unless-stopped   --env-file "$KORA_ENV_FILE" -e KORA_PREFLIGHT_MODE=private_beta   -p "127.0.0.1:${prod_port}:3000" "$image" >/dev/null || { rollback; exit 5; }
for _ in $(seq 1 45); do
  curl -fsS "http://127.0.0.1:${prod_port}/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:${prod_port}/api/health" >/dev/null || { rollback; exit 6; }

echo "[PASS] KORA private-beta runtime promoted to IZAKHONO owner host."
