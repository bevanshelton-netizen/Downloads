#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "CHANCELLOR-CUTOVER.json"
$Pinned = "22914758d9bc24217d63c87515186f5d4a9806ab"

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
Write-Host "Deploying THE CHANCELLOR as a loopback-only private pilot with payments disabled..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/the-chancellor"
ENV_FILE="$ROOT/chancellor-private-pilot.env"
mkdir -p "$ROOT"

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/the-chancellor.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated Chancellor checkout has local changes; refusing to overwrite." >&2
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
      "NODE_ENV":"production",
      "PORT":"3000",
      "APP_URL":"https://chancellor.private.invalid",
      "DATA_DIR":"/app/data",
      "SESSION_SECRET":secrets.token_urlsafe(48),
      "ADMIN_EMAIL":"owner@chancellor.private.invalid",
      "ADMIN_PASSWORD":secrets.token_urlsafe(24),
      "OPENAI_API_KEY":"",
      "PAYFAST_MODE":"sandbox",
      "PAYFAST_MERCHANT_ID":"",
      "PAYFAST_MERCHANT_KEY":"",
      "PAYFAST_PASSPHRASE":"",
      "RESEND_API_KEY":"",
      "TWILIO_ACCOUNT_SID":"",
      "TWILIO_AUTH_TOKEN":"",
    }
    path.write_text("\n".join(f"{k}={v}" for k,v in values.items())+"\n",encoding="utf-8")
    path.chmod(0o600)
PY

app="the-chancellor"
canary="the-chancellor-canary"
image="the-chancellor:izakhono-$(printf '%s' "$PINNED" | cut -c1-12)"
canary_port="18206"
prod_port="18106"
data_volume="the_chancellor_data"
canary_volume="the_chancellor_canary_data"

docker build   --label "za.co.izakhono.product=THE CHANCELLOR"   --label "za.co.izakhono.commit=$PINNED"   --label "za.co.izakhono.channel=private-pilot"   -t "$image" .

docker volume create "$data_volume" >/dev/null
docker volume create "$canary_volume" >/dev/null
docker rm -f "$canary" >/dev/null 2>&1 || true

docker run -d --name "$canary"   --env-file "$ENV_FILE"   -e PAYFAST_MODE=sandbox   -e IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112   -e PAYFAST_MERCHANT_ID=   -e PAYFAST_MERCHANT_KEY=   -e PAYFAST_PASSPHRASE=   -e IZAKHONO_RUNTIME=true   -e PERSISTENT_STORAGE=true   -v "$canary_volume:/app/data"   -p "127.0.0.1:$canary_port:3000" "$image" >/dev/null

cleanup_canary(){ docker rm -f "$canary" >/dev/null 2>&1 || true; }
trap cleanup_canary EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$canary_port/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$canary_port/api/health" >/dev/null

CANARY_READY="$(curl -fsS "http://127.0.0.1:$canary_port/api/go-live")"
printf '%s' "$CANARY_READY" | grep -q '"readyForPaidTraffic":false' || {
  printf '%s\n' "$CANARY_READY"
  echo "Private pilot unexpectedly became paid-traffic ready; refusing promotion." >&2
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
    docker run -d --name "$app" --restart unless-stopped       --env-file "$ENV_FILE"       -e PAYFAST_MODE=sandbox       -e IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112       -e PAYFAST_MERCHANT_ID=       -e PAYFAST_MERCHANT_KEY=       -e PAYFAST_PASSPHRASE=       -e IZAKHONO_RUNTIME=true       -e PERSISTENT_STORAGE=true       -v "$data_volume:/app/data"       -p "127.0.0.1:$prod_port:3000" "$old_image" >/dev/null || true
  fi
}

docker run -d --name "$app" --restart unless-stopped   --env-file "$ENV_FILE"   -e PAYFAST_MODE=sandbox   -e IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112   -e PAYFAST_MERCHANT_ID=   -e PAYFAST_MERCHANT_KEY=   -e PAYFAST_PASSPHRASE=   -e IZAKHONO_RUNTIME=true   -e PERSISTENT_STORAGE=true   -v "$data_volume:/app/data"   -p "127.0.0.1:$prod_port:3000" "$image" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$prod_port/api/health" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$prod_port/api/health" >/dev/null || { rollback; exit 6; }

READY="$(curl -fsS "http://127.0.0.1:$prod_port/api/go-live")"
printf '%s' "$READY" | grep -q '"readyForPaidTraffic":false' || { rollback; exit 7; }

python3 - "$PINNED" "$READY" <<'PY' > "$ROOT/chancellor-cutover.json"
import datetime, json, sys
ready=json.loads(sys.argv[2])
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"the-chancellor",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-private-pilot",
  "local_url":"http://127.0.0.1:18106",
  "health_passed":True,
  "ready_for_paid_traffic":bool(ready.get("readyForPaidTraffic")),
  "payment_mode":"sandbox-disabled",
  "owner_env_path":"~/izakhono-fleet/chancellor-private-pilot.env",
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/chancellor-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-chancellor-isn01-cutover.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-chancellor-isn01-cutover.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "THE CHANCELLOR private-pilot cutover failed inside WSL." }

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/chancellor-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true) { Fail "Chancellor health proof was not recorded." }
if ($verified.ready_for_paid_traffic -ne $false) { Fail "Chancellor paid-traffic gate unexpectedly opened." }
if ($verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) { Fail "Chancellor readiness boundary was violated." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "Chancellor receipt violated the private-pilot safety boundary."
}

Write-Host ""
Write-Host "THE CHANCELLOR IZAKHONO PRIVATE PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Local pilot: http://127.0.0.1:18106"
Write-Host "Receipt: $Receipt"
Write-Host "Owner credentials remain only in the protected WSL env file." -ForegroundColor Cyan
Write-Host "DNS, public customer traffic and live payments remain unchanged." -ForegroundColor Yellow
