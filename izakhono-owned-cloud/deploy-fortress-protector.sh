#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

PINNED="f6c8dc04153c4d8d2409019fdd7d1a810f85a9c8"
ROOT="/opt/izakhono-fortress"
REPO="$ROOT/source"
ENV_FILE="/etc/izakhono/fortress-protector.env"
NETWORK="fortress-protector-net"
DB="fortress-protector-db"
API="fortress-protector-api"
DB_VOLUME="fortress_protector_pg"
IMAGE="shelton-fortress:protector-${PINNED:0:12}"
PORT="18109"
REPORT_DIR="/var/lib/izakhono-deploy"
RECEIPT="$REPORT_DIR/fortress-protector.json"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "FORTRESS requires $1" >&2; exit 2; }; }
for cmd in git docker curl python3; do need "$cmd"; done
docker info >/dev/null
mkdir -p "$ROOT" /etc/izakhono "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/SHELTON-FORTRESS.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "FORTRESS source checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$PINNED"
git checkout --detach "$PINNED"

python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import secrets, sys
path=Path(sys.argv[1])
if not path.exists():
    values={
      "POSTGRES_DB":"fortress",
      "POSTGRES_USER":"fortress",
      "POSTGRES_PASSWORD":secrets.token_urlsafe(48),
      "JWT_SECRET":secrets.token_urlsafe(72),
      "DEVICE_TOKEN_SECRET":secrets.token_urlsafe(72),
      "MFA_ENCRYPTION_KEY":secrets.token_urlsafe(72),
      "MFA_ISSUER":"SHELTON FORTRESS — THEE PROTECTOR",
      "ACCESS_TOKEN_MINUTES":"30",
      "REFRESH_TOKEN_DAYS":"30",
      "AUTH_MAX_FAILURES":"5",
      "AUTH_WINDOW_MINUTES":"15",
      "AUTH_LOCKOUT_MINUTES":"15",
      "API_AUTH_REQUESTS_PER_MINUTE":"60",
      "API_BOOTSTRAP_REQUESTS_PER_HOUR":"10",
      "API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE":"60",
      "API_THROTTLE_BLOCK_MINUTES":"5",
      "API_THROTTLE_RETENTION_HOURS":"168",
    }
    path.write_text("\n".join(f"{k}={v}" for k,v in values.items())+"\n",encoding="utf-8")
    path.chmod(0o600)
PY
chown root:root "$ENV_FILE"
chmod 0600 "$ENV_FILE"

set -a
. "$ENV_FILE"
set +a

docker build \
  --label "za.co.izakhono.product=SHELTON FORTRESS" \
  --label "za.co.izakhono.role=THEE-PROTECTOR" \
  --label "za.co.izakhono.commit=$PINNED" \
  --label "za.co.izakhono.channel=private-defensive-control-plane" \
  -t "$IMAGE" apps/api

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create --internal "$NETWORK" >/dev/null
docker volume inspect "$DB_VOLUME" >/dev/null 2>&1 || docker volume create "$DB_VOLUME" >/dev/null

docker rm -f "$API" >/dev/null 2>&1 || true
docker rm -f "$DB" >/dev/null 2>&1 || true

docker run -d --name "$DB" --restart unless-stopped \
  --network "$NETWORK" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -e POSTGRES_USER="$POSTGRES_USER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -v "$DB_VOLUME:/var/lib/postgresql/data" \
  postgres:16 >/dev/null

for _ in $(seq 1 40); do
  docker exec "$DB" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break
  sleep 2
done
docker exec "$DB" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

DB_URL="postgresql+psycopg://$POSTGRES_USER:$POSTGRES_PASSWORD@$DB:5432/$POSTGRES_DB"
COMMON_ENV=(
  -e ENVIRONMENT=production
  -e AUTO_CREATE_SCHEMA=false
  -e DATABASE_URL="$DB_URL"
  -e JWT_SECRET="$JWT_SECRET"
  -e DEVICE_TOKEN_SECRET="$DEVICE_TOKEN_SECRET"
  -e MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY"
  -e MFA_ISSUER="$MFA_ISSUER"
  -e ACCESS_TOKEN_MINUTES="$ACCESS_TOKEN_MINUTES"
  -e REFRESH_TOKEN_DAYS="$REFRESH_TOKEN_DAYS"
  -e AUTH_MAX_FAILURES="$AUTH_MAX_FAILURES"
  -e AUTH_WINDOW_MINUTES="$AUTH_WINDOW_MINUTES"
  -e AUTH_LOCKOUT_MINUTES="$AUTH_LOCKOUT_MINUTES"
  -e TRUST_PROXY_HEADERS=false
  -e API_AUTH_REQUESTS_PER_MINUTE="$API_AUTH_REQUESTS_PER_MINUTE"
  -e API_BOOTSTRAP_REQUESTS_PER_HOUR="$API_BOOTSTRAP_REQUESTS_PER_HOUR"
  -e API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE="$API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE"
  -e API_THROTTLE_BLOCK_MINUTES="$API_THROTTLE_BLOCK_MINUTES"
  -e API_THROTTLE_RETENTION_HOURS="$API_THROTTLE_RETENTION_HOURS"
)

docker run --rm --network "$NETWORK" "${COMMON_ENV[@]}" "$IMAGE" alembic -c alembic.ini upgrade head

docker run -d --name "$API" --restart unless-stopped \
  --network "$NETWORK" \
  "${COMMON_ENV[@]}" \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  -p "127.0.0.1:$PORT:8000" \
  "$IMAGE" >/dev/null

for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$PORT/health" >/tmp/fortress-protector-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PORT/health" >/tmp/fortress-protector-health.json

python3 - "$PINNED" /tmp/fortress-protector-health.json "$RECEIPT" <<'PY'
import datetime, json, sys
health=json.load(open(sys.argv[2],encoding="utf-8"))
if health.get("status")!="ok" or health.get("product")!="FORTRESS":
    raise SystemExit("FORTRESS health payload is invalid")
receipt={
  "schema":"izakhono.fortress-protector/v1",
  "role":"THEE PROTECTOR",
  "revision":sys.argv[1],
  "runtime":"docker-isolated-private-control-plane",
  "local_url":"http://127.0.0.1:18109",
  "health_passed":True,
  "database":"dedicated-postgresql-volume",
  "public_bind":False,
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "payment_credentials_stored":False,
  "commercial_release_claimed":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}
open(sys.argv[3],"w",encoding="utf-8").write(json.dumps(receipt,indent=2)+"\n")
print(json.dumps(receipt,indent=2))
PY
chmod 0600 "$RECEIPT"

echo
echo "SHELTON FORTRESS — THEE PROTECTOR: PRIVATE CONTROL PLANE ACTIVE"
echo "Health: http://127.0.0.1:$PORT/health"
echo "Receipt: $RECEIPT"
echo "Public traffic remains on IZAKHONO EDGE; FORTRESS is not publicly exposed."
