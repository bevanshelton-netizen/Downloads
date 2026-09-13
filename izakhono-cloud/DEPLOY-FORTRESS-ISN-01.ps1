#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "FORTRESS-CUTOVER.json"
$Pinned = "f6c8dc04153c4d8d2409019fdd7d1a810f85a9c8"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

if ($env:OS -ne "Windows_NT") { Fail "Run this launcher on the Windows owner machine." }
if (-not (Test-Path $EngineProof)) {
    Fail "IZAKHONO Engine proof is missing. Run START-IZAKHONO-ENGINE-ISN-01.cmd first."
}

$proof = Get-Content $EngineProof -Raw | ConvertFrom-Json
if ($proof.node_name -ne "ISN-01") { Fail "Engine proof is not for ISN-01." }
foreach ($field in @("scheduler_dispatch","image_pull","container_start","http_health")) {
    if ($proof.$field -ne $true) { Fail "Engine proof field '$field' is not verified." }
}
if ($proof.public_ready -ne $false -or $proof.commercial_ready -ne $false) {
    Fail "Unexpected public/commercial readiness state in ENGINE-PROOF.json."
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

Write-Host "ISN-01 proof verified." -ForegroundColor Green
Write-Host "Deploying SHELTON FORTRESS as an isolated local pilot..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/SHELTON-FORTRESS"
ENV_FILE="$ROOT/fortress-private-pilot.env"
NETWORK="fortress-isn01-net"
DB="fortress-isn01-db"
API="fortress-isn01-api"
DB_VOLUME="fortress_isn01_pg"
IMAGE="shelton-fortress:izakhono-$(printf '%s' "$PINNED" | cut -c1-12)"
PORT="18109"
mkdir -p "$ROOT"

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/SHELTON-FORTRESS.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated FORTRESS checkout has local changes; refusing to overwrite." >&2
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
      "MFA_ISSUER":"SHELTON FORTRESS",
      "ACCESS_TOKEN_MINUTES":"30",
      "REFRESH_TOKEN_DAYS":"30",
      "AUTH_MAX_FAILURES":"5",
      "AUTH_WINDOW_MINUTES":"15",
      "AUTH_LOCKOUT_MINUTES":"15",
      "TRUST_PROXY_HEADERS":"false",
      "API_AUTH_REQUESTS_PER_MINUTE":"60",
      "API_BOOTSTRAP_REQUESTS_PER_HOUR":"10",
      "API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE":"60",
      "API_THROTTLE_BLOCK_MINUTES":"5",
      "API_THROTTLE_RETENTION_HOURS":"168",
    }
    path.write_text("\n".join(f"{k}={v}" for k,v in values.items())+"\n",encoding="utf-8")
    path.chmod(0o600)
PY

set -a
. "$ENV_FILE"
set +a

docker build   --label "za.co.izakhono.product=SHELTON FORTRESS"   --label "za.co.izakhono.commit=$PINNED"   --label "za.co.izakhono.channel=private-pilot"   -t "$IMAGE" apps/api

docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
docker volume inspect "$DB_VOLUME" >/dev/null 2>&1 || docker volume create "$DB_VOLUME" >/dev/null

docker rm -f "$API" >/dev/null 2>&1 || true
docker rm -f "$DB" >/dev/null 2>&1 || true

docker run -d --name "$DB" --restart unless-stopped   --network "$NETWORK"   -e POSTGRES_DB="$POSTGRES_DB"   -e POSTGRES_USER="$POSTGRES_USER"   -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD"   -v "$DB_VOLUME:/var/lib/postgresql/data"   postgres:16 >/dev/null

for _ in $(seq 1 40); do
  docker exec "$DB" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break
  sleep 2
done
docker exec "$DB" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

DB_URL="postgresql+psycopg://$POSTGRES_USER:$POSTGRES_PASSWORD@$DB:5432/$POSTGRES_DB"

docker run --rm --network "$NETWORK"   -e ENVIRONMENT=production   -e AUTO_CREATE_SCHEMA=false   -e DATABASE_URL="$DB_URL"   -e JWT_SECRET="$JWT_SECRET"   -e DEVICE_TOKEN_SECRET="$DEVICE_TOKEN_SECRET"   -e MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY"   -e MFA_ISSUER="$MFA_ISSUER"   -e ACCESS_TOKEN_MINUTES="$ACCESS_TOKEN_MINUTES"   -e REFRESH_TOKEN_DAYS="$REFRESH_TOKEN_DAYS"   -e AUTH_MAX_FAILURES="$AUTH_MAX_FAILURES"   -e AUTH_WINDOW_MINUTES="$AUTH_WINDOW_MINUTES"   -e AUTH_LOCKOUT_MINUTES="$AUTH_LOCKOUT_MINUTES"   -e TRUST_PROXY_HEADERS=false   -e API_AUTH_REQUESTS_PER_MINUTE="$API_AUTH_REQUESTS_PER_MINUTE"   -e API_BOOTSTRAP_REQUESTS_PER_HOUR="$API_BOOTSTRAP_REQUESTS_PER_HOUR"   -e API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE="$API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE"   -e API_THROTTLE_BLOCK_MINUTES="$API_THROTTLE_BLOCK_MINUTES"   -e API_THROTTLE_RETENTION_HOURS="$API_THROTTLE_RETENTION_HOURS"   "$IMAGE" alembic -c alembic.ini upgrade head

docker run -d --name "$API" --restart unless-stopped   --network "$NETWORK"   -e ENVIRONMENT=production   -e AUTO_CREATE_SCHEMA=false   -e DATABASE_URL="$DB_URL"   -e JWT_SECRET="$JWT_SECRET"   -e DEVICE_TOKEN_SECRET="$DEVICE_TOKEN_SECRET"   -e MFA_ENCRYPTION_KEY="$MFA_ENCRYPTION_KEY"   -e MFA_ISSUER="$MFA_ISSUER"   -e ACCESS_TOKEN_MINUTES="$ACCESS_TOKEN_MINUTES"   -e REFRESH_TOKEN_DAYS="$REFRESH_TOKEN_DAYS"   -e AUTH_MAX_FAILURES="$AUTH_MAX_FAILURES"   -e AUTH_WINDOW_MINUTES="$AUTH_WINDOW_MINUTES"   -e AUTH_LOCKOUT_MINUTES="$AUTH_LOCKOUT_MINUTES"   -e TRUST_PROXY_HEADERS=false   -e API_AUTH_REQUESTS_PER_MINUTE="$API_AUTH_REQUESTS_PER_MINUTE"   -e API_BOOTSTRAP_REQUESTS_PER_HOUR="$API_BOOTSTRAP_REQUESTS_PER_HOUR"   -e API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE="$API_AGENT_ACTIVATION_REQUESTS_PER_MINUTE"   -e API_THROTTLE_BLOCK_MINUTES="$API_THROTTLE_BLOCK_MINUTES"   -e API_THROTTLE_RETENTION_HOURS="$API_THROTTLE_RETENTION_HOURS"   -p "127.0.0.1:$PORT:8000" "$IMAGE" >/dev/null

for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$PORT/health" >/tmp/fortress-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PORT/health" >/tmp/fortress-health.json

python3 - "$PINNED" /tmp/fortress-health.json <<'PY' > "$ROOT/fortress-cutover.json"
import datetime, json, sys
health=json.load(open(sys.argv[2],encoding="utf-8"))
if health.get("status")!="ok" or health.get("product")!="FORTRESS":
    raise SystemExit("FORTRESS health payload is invalid")
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"shelton-fortress",
  "revision":sys.argv[1],
  "runtime":"docker-isolated-private-pilot",
  "local_url":"http://127.0.0.1:18109",
  "health_passed":True,
  "database":"dedicated-postgresql-volume",
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/fortress-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-fortress-isn01-pilot.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-fortress-isn01-pilot.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "SHELTON FORTRESS private-pilot deployment failed inside WSL." }

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/fortress-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true) { Fail "FORTRESS health proof was not recorded." }
if ($verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) { Fail "FORTRESS readiness boundary was violated." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "FORTRESS receipt violated the private-pilot safety boundary."
}

Write-Host ""
Write-Host "SHELTON FORTRESS IZAKHONO PRIVATE PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Local pilot: http://127.0.0.1:18109"
Write-Host "Receipt: $Receipt"
Write-Host "Dedicated PostgreSQL data remains on the owner host." -ForegroundColor Cyan
Write-Host "DNS, public customer traffic and live payments remain unchanged." -ForegroundColor Yellow
