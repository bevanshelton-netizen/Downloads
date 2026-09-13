#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "LEGACYMART-CUTOVER.json"
$Pinned = "2b2e493053e0fff4aadc64f31a73df9f528ca3d2"
$LocalOrigin = "http://127.0.0.1:18110"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

if ($env:OS -ne "Windows_NT") { Fail "Run this launcher on the Windows owner machine." }
if (-not (Test-Path $State)) { New-Item -ItemType Directory -Path $State -Force | Out-Null }
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
Write-Host "Deploying LegacyMart as a loopback-only private pilot with PayFast locked to sandbox..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/legacymart"
ENV_FILE="$ROOT/legacymart-private-pilot.env"
APP="legacymart"
CANARY="legacymart-canary"
CANARY_PORT="18210"
PROD_PORT="18110"
DATA_VOL="legacymart_data"
DOWNLOAD_VOL="legacymart_downloads"
CANARY_DATA_VOL="legacymart_canary_data"
CANARY_DOWNLOAD_VOL="legacymart_canary_downloads"
mkdir -p "$ROOT"

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/bevanshelton-netizen-legacymart.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated LegacyMart checkout has local changes; refusing to overwrite." >&2
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
      "PORT":"3000",
      "BASE_URL":"http://127.0.0.1:18110",
      "PAYFAST_MODE":"sandbox",
      "PAYFAST_MERCHANT_ID":"10000100",
      "PAYFAST_MERCHANT_KEY":"46f0cd694581a",
      "PAYFAST_PASSPHRASE":"",
      "ADMIN_TOKEN":secrets.token_urlsafe(48),
      "PRODUCT_PRICE":"199.00",
    }
    path.write_text("\n".join(f"{k}={v}" for k,v in values.items())+"\n",encoding="utf-8")
    path.chmod(0o600)
PY

grep -q '^PAYFAST_MODE=sandbox$' "$ENV_FILE" || { echo "LegacyMart pilot must remain PayFast sandbox."; exit 4; }
grep -q '^BASE_URL=http://127.0.0.1:18110$' "$ENV_FILE" || { echo "LegacyMart pilot BASE_URL must remain loopback."; exit 4; }

IMAGE="legacymart:izakhono-$(printf '%s' "$PINNED" | cut -c1-12)"
docker build   --label "za.co.izakhono.product=LegacyMart"   --label "za.co.izakhono.commit=$PINNED"   --label "za.co.izakhono.channel=private-pilot"   -t "$IMAGE" .

for volume in "$DATA_VOL" "$DOWNLOAD_VOL" "$CANARY_DATA_VOL" "$CANARY_DOWNLOAD_VOL"; do
  docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null
done

docker rm -f "$CANARY" >/dev/null 2>&1 || true
docker run -d --name "$CANARY"   --env-file "$ENV_FILE"   -e PAYFAST_MODE=sandbox   -e BASE_URL="http://127.0.0.1:$CANARY_PORT"   -v "$CANARY_DATA_VOL:/app/data"   -v "$CANARY_DOWNLOAD_VOL:/app/public/downloads"   -p "127.0.0.1:$CANARY_PORT:3000" "$IMAGE" >/dev/null

cleanup_canary(){ docker rm -f "$CANARY" >/dev/null 2>&1 || true; }
trap cleanup_canary EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$CANARY_PORT/health" >/tmp/legacymart-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$CANARY_PORT/health" >/tmp/legacymart-health.json

python3 - /tmp/legacymart-health.json <<'PY'
import json, sys
health=json.load(open(sys.argv[1],encoding="utf-8"))
if health.get("ok") is not True or health.get("service")!="LegacyMart":
    raise SystemExit("LegacyMart health payload invalid")
PY

for route in / /shop /faith-personified /checkout /become-a-vendor /privacy /refunds /terms; do
  curl -fsS "http://127.0.0.1:$CANARY_PORT$route" | grep -q 'LegacyMart' || {
    echo "LegacyMart candidate route failed: $route" >&2
    exit 5
  }
done

old_image=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Config.Image}}' "$APP")"
  docker rm -f "$APP" >/dev/null
fi

rollback(){
  docker rm -f "$APP" >/dev/null 2>&1 || true
  if [ -n "$old_image" ]; then
    docker run -d --name "$APP" --restart unless-stopped       --env-file "$ENV_FILE"       -e PAYFAST_MODE=sandbox       -e BASE_URL="http://127.0.0.1:$PROD_PORT"       -v "$DATA_VOL:/app/data"       -v "$DOWNLOAD_VOL:/app/public/downloads"       -p "127.0.0.1:$PROD_PORT:3000" "$old_image" >/dev/null || true
  fi
}

docker run -d --name "$APP" --restart unless-stopped   --env-file "$ENV_FILE"   -e PAYFAST_MODE=sandbox   -e BASE_URL="http://127.0.0.1:$PROD_PORT"   -v "$DATA_VOL:/app/data"   -v "$DOWNLOAD_VOL:/app/public/downloads"   -p "127.0.0.1:$PROD_PORT:3000" "$IMAGE" >/dev/null || { rollback; exit 6; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PROD_PORT/health" >/tmp/legacymart-health.json && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PROD_PORT/health" >/tmp/legacymart-health.json || { rollback; exit 7; }

python3 - "$PINNED" /tmp/legacymart-health.json <<'PY' > "$ROOT/legacymart-cutover.json"
import datetime, json, sys
health=json.load(open(sys.argv[2],encoding="utf-8"))
if health.get("ok") is not True or health.get("service")!="LegacyMart":
    raise SystemExit("LegacyMart health payload invalid")
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"legacymart",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-private-pilot",
  "local_url":"http://127.0.0.1:18110",
  "health_passed":True,
  "persistent_data_volume":"legacymart_data",
  "persistent_download_volume":"legacymart_downloads",
  "payment_mode":"sandbox",
  "live_payment_validation_ready":False,
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/legacymart-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-legacymart-isn01-pilot.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-legacymart-isn01-pilot.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "LegacyMart private-pilot deployment failed inside WSL." }

try {
    $appHealth = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/health" -TimeoutSec 8
    if ($appHealth.StatusCode -ne 200 -or $appHealth.Content -notmatch '"ok":true') {
        Fail "LegacyMart loopback health is not reachable from Windows."
    }
} catch {
    Fail ("LegacyMart loopback is not reachable from Windows: " + $_.Exception.Message)
}

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/legacymart-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true) { Fail "LegacyMart health proof was not recorded." }
if ($verified.payment_mode -ne "sandbox" -or $verified.live_payment_validation_ready -ne $false) { Fail "LegacyMart payment safety boundary was violated." }
if ($verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) { Fail "LegacyMart readiness boundary was violated." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "LegacyMart receipt violated the private-pilot safety boundary."
}

Write-Host ""
Write-Host "LEGACYMART IZAKHONO PRIVATE PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Local pilot: $LocalOrigin"
Write-Host "Receipt: $Receipt"
Write-Host "Persistent order/vendor data and download storage remain on the owner host." -ForegroundColor Cyan
Write-Host "PayFast remains sandbox-only; DNS, public traffic and live payments remain unchanged." -ForegroundColor Yellow
