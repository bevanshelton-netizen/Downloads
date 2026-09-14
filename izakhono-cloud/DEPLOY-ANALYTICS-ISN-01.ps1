#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "ANALYTICS-CUTOVER.json"
$Pinned = "01c74fb780b491fb0697ebfdcd3afbcdf2c0d72f"
$LocalOrigin = "http://127.0.0.1:18112"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

if ($env:OS -ne "Windows_NT") { Fail "Run this launcher on the Windows owner machine." }
if (-not (Test-Path $EngineProof)) { Fail "IZAKHONO Engine proof is missing. Run START-IZAKHONO-ENGINE-ISN-01.cmd first." }

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

$bash = @'
set -euo pipefail
PINNED="__PINNED__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/Downloads"
SECRET_FILE="$ROOT/analytics-hash-secret"
APP="izakhono-analytics"
CANARY="izakhono-analytics-canary"
CANARY_PORT="18212"
PROD_PORT="18112"
DATA_VOL="izakhono_analytics_data"
mkdir -p "$ROOT"

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/Downloads.git "$REPO"
fi
cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated Downloads checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$PINNED"
git checkout --detach "$PINNED"

if [ ! -s "$SECRET_FILE" ]; then
  umask 077
  python3 - <<'PY' > "$SECRET_FILE"
import secrets
print(secrets.token_urlsafe(48))
PY
  chmod 600 "$SECRET_FILE"
fi
HASH_SECRET="$(cat "$SECRET_FILE")"
[ "$(printf '%s' "$HASH_SECRET" | wc -c)" -ge 32 ] || { echo "Analytics hash secret invalid"; exit 4; }

IMAGE="izakhono-analytics:$(printf '%s' "$PINNED" | cut -c1-12)"
docker build   --label "za.co.izakhono.product=IZAKHONO Analytics"   --label "za.co.izakhono.commit=$PINNED"   --label "za.co.izakhono.channel=private-pilot"   -t "$IMAGE" izakhono-analytics

docker volume inspect "$DATA_VOL" >/dev/null 2>&1 || docker volume create "$DATA_VOL" >/dev/null

docker rm -f "$CANARY" >/dev/null 2>&1 || true
docker run -d --name "$CANARY"   -e ANALYTICS_HASH_SECRET="$HASH_SECRET"   -e ANALYTICS_RETENTION_DAYS=180   -v "$DATA_VOL:/data"   -p "127.0.0.1:$CANARY_PORT:8080" "$IMAGE" >/dev/null

cleanup_canary(){ docker rm -f "$CANARY" >/dev/null 2>&1 || true; }
trap cleanup_canary EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/tmp/analytics-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/tmp/analytics-health.json
grep -q '"ok":true' /tmp/analytics-health.json
grep -q '"privacy":"no-raw-ip-storage"' /tmp/analytics-health.json
curl -fsS "http://127.0.0.1:$CANARY_PORT/dashboard" | grep -q 'IZAKHONO Analytics Command Centre'

old_image=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Config.Image}}' "$APP")"
  docker rm -f "$APP" >/dev/null
fi

rollback(){
  docker rm -f "$APP" >/dev/null 2>&1 || true
  if [ -n "$old_image" ]; then
    docker run -d --name "$APP" --restart unless-stopped       -e ANALYTICS_HASH_SECRET="$HASH_SECRET"       -e ANALYTICS_RETENTION_DAYS=180       -v "$DATA_VOL:/data"       -p "127.0.0.1:$PROD_PORT:8080" "$old_image" >/dev/null || true
  fi
}

docker run -d --name "$APP" --restart unless-stopped   -e ANALYTICS_HASH_SECRET="$HASH_SECRET"   -e ANALYTICS_RETENTION_DAYS=180   -v "$DATA_VOL:/data"   -p "127.0.0.1:$PROD_PORT:8080" "$IMAGE" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/tmp/analytics-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/tmp/analytics-health.json || { rollback; exit 6; }
grep -q '"ok":true' /tmp/analytics-health.json || { rollback; exit 7; }
curl -fsS "http://127.0.0.1:$PROD_PORT/api/summary?days=1" >/tmp/analytics-summary.json || { rollback; exit 8; }

python3 - "$PINNED" <<'PY' > "$ROOT/analytics-cutover.json"
import datetime, json, sys
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"izakhono-analytics",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-private-pilot",
  "local_url":"http://127.0.0.1:18112",
  "dashboard_url":"http://127.0.0.1:18112/dashboard",
  "health_passed":True,
  "privacy_mode":"no-raw-ip-storage",
  "retention_days":180,
  "persistent_data_volume":"izakhono_analytics_data",
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY
cat "$ROOT/analytics-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-analytics-isn01-pilot.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-analytics-isn01-pilot.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "IZAKHONO Analytics private-pilot deployment failed inside WSL." }

try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/healthz" -TimeoutSec 8
    $dash = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/dashboard" -TimeoutSec 8
    if ($health.StatusCode -ne 200 -or $health.Content -notmatch '"ok":true') { Fail "Analytics Windows health proof failed." }
    if ($dash.Content -notmatch 'IZAKHONO Analytics Command Centre') { Fail "Analytics dashboard proof failed." }
} catch {
    Fail ("IZAKHONO Analytics loopback proof failed: " + $_.Exception.Message)
}

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/analytics-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8
$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true -or $verified.privacy_mode -ne "no-raw-ip-storage") { Fail "Analytics receipt is invalid." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "Analytics receipt violated the private-pilot safety boundary."
}

Write-Host ""
Write-Host "IZAKHONO ANALYTICS COMMAND CENTRE: VERIFIED PRIVATE PILOT" -ForegroundColor Green
Write-Host "Dashboard: $LocalOrigin/dashboard"
Write-Host "Receipt: $Receipt"
Write-Host "Analytics data remains on the owner host; no public edge or live payments changed." -ForegroundColor Yellow
