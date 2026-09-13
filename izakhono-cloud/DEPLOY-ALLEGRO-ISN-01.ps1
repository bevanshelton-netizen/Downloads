#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$EnvFile = Join-Path $State "ALLEGRO.env"
$EnvTemplate = Join-Path $State "ALLEGRO.env.template"
$Receipt = Join-Path $State "ALLEGRO-CUTOVER.json"
$Pinned = "5aa51d0bd94040f5c180418c6e1973228f5f2044"
$LocalOrigin = "http://127.0.0.1:18108"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

function Read-EnvValue([string]$Path, [string]$Name) {
    $line = Get-Content $Path | Where-Object { $_ -match ("^" + [regex]::Escape($Name) + "=") } | Select-Object -Last 1
    if (-not $line) { return "" }
    $value = ($line -split "=", 2)[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    return $value
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

if (-not (Test-Path $EnvFile)) {
    @"
# Browser-reachable owner-controlled IZAKHONO Core origin.
# HTTPS is preferred. Same-machine loopback HTTP is allowed for the private pilot.
VITE_IZAKHONO_CORE_URL=http://127.0.0.1:18787
VITE_IZAKHONO_PROJECT=allegro-vibez
# Browser-safe public project key only. Never place an ik_sec_* secret here.
VITE_IZAKHONO_PUBLIC_KEY=ik_pub_REPLACE_ME
"@ | Set-Content -Path $EnvTemplate -Encoding UTF8
    Write-Host "ALLEGRO owner-host environment is not present." -ForegroundColor Yellow
    Write-Host "A secret-free template was written to: $EnvTemplate"
    Write-Host "Create $EnvFile with the browser-reachable IZAKHONO Core URL and ALLEGRO public project key, then rerun."
    Fail "ALLEGRO.env is required and is never committed to source control."
}

$coreUrl = Read-EnvValue $EnvFile "VITE_IZAKHONO_CORE_URL"
$project = Read-EnvValue $EnvFile "VITE_IZAKHONO_PROJECT"
$publicKey = Read-EnvValue $EnvFile "VITE_IZAKHONO_PUBLIC_KEY"

if (-not $coreUrl) { Fail "VITE_IZAKHONO_CORE_URL is missing from ALLEGRO.env." }
if (-not $project) { $project = "allegro-vibez" }
if ($project -ne "allegro-vibez") { Fail "VITE_IZAKHONO_PROJECT must be allegro-vibez." }
if (-not $publicKey -or $publicKey -match "REPLACE_ME" -or $publicKey.Length -lt 20) {
    Fail "VITE_IZAKHONO_PUBLIC_KEY must contain the browser-safe ALLEGRO project key."
}

try {
    $uri = [Uri]$coreUrl
} catch {
    Fail "VITE_IZAKHONO_CORE_URL is not a valid URL."
}
$loopback = $uri.Scheme -eq "http" -and @("127.0.0.1","localhost") -contains $uri.Host
if ($uri.Scheme -ne "https" -and -not $loopback) {
    Fail "ALLEGRO private pilot accepts HTTPS Core or same-machine loopback HTTP only."
}

try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri ($coreUrl.TrimEnd("/") + "/healthz") -Headers @{ Origin = $LocalOrigin } -TimeoutSec 8
    if ($health.StatusCode -ne 200 -or $health.Content -notmatch '"ok":true') {
        Fail "IZAKHONO Core health did not pass from Windows."
    }
    $cors = [string]$health.Headers["Access-Control-Allow-Origin"]
    if ($cors -ne $LocalOrigin) {
        Fail "IZAKHONO Core does not allow the ALLEGRO private-pilot origin $LocalOrigin."
    }
} catch {
    Fail ("IZAKHONO Core is not browser-ready for ALLEGRO private pilot: " + $_.Exception.Message)
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

$linuxEnv = "/tmp/allegro-isn01-owner.env"
Get-Content $EnvFile -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "umask 077; cat > $linuxEnv"
if ($LASTEXITCODE -ne 0) { Fail "Could not hand ALLEGRO.env into the owner-controlled WSL runtime." }

Write-Host "ISN-01 and IZAKHONO Core verified." -ForegroundColor Green
Write-Host "Deploying ALLEGRO VIBEZ as a loopback-only owner-host private pilot..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/allegro-vibez"
SOURCE_ENV="/tmp/allegro-isn01-owner.env"
APP="allegro-vibez"
CANARY="allegro-vibez-canary"
CANARY_PORT="18208"
PROD_PORT="18108"
mkdir -p "$ROOT"

cleanup_env(){ rm -f "$SOURCE_ENV"; }
trap cleanup_env EXIT INT TERM

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null
[ -s "$SOURCE_ENV" ] || { echo "ALLEGRO owner environment was not transferred"; exit 2; }

read_env(){
  key="$1"
  grep -E "^$key=" "$SOURCE_ENV" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

CORE_URL="$(read_env VITE_IZAKHONO_CORE_URL)"
PROJECT="$(read_env VITE_IZAKHONO_PROJECT || true)"
PUBLIC_KEY="$(read_env VITE_IZAKHONO_PUBLIC_KEY)"
[ -n "$PROJECT" ] || PROJECT="allegro-vibez"
[ "$PROJECT" = "allegro-vibez" ] || { echo "Unsafe ALLEGRO project id"; exit 3; }
[ -n "$PUBLIC_KEY" ] || { echo "Missing ALLEGRO public project key"; exit 3; }

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/allegro-vibez.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated ALLEGRO checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$PINNED"
git checkout --detach "$PINNED"

IMAGE="allegro-vibez:izakhono-$(printf '%s' "$PINNED" | cut -c1-12)"
docker build   --build-arg "VITE_IZAKHONO_CORE_URL=$CORE_URL"   --build-arg "VITE_IZAKHONO_PROJECT=$PROJECT"   --build-arg "VITE_IZAKHONO_PUBLIC_KEY=$PUBLIC_KEY"   --label "za.co.izakhono.product=ALLEGRO VIBEZ"   --label "za.co.izakhono.commit=$PINNED"   --label "za.co.izakhono.channel=private-pilot"   -t "$IMAGE" .

docker rm -f "$CANARY" >/dev/null 2>&1 || true
docker run -d --name "$CANARY" -p "127.0.0.1:$CANARY_PORT:8080" "$IMAGE" >/dev/null
cleanup_canary(){ docker rm -f "$CANARY" >/dev/null 2>&1 || true; }
trap 'cleanup_canary; cleanup_env' EXIT INT TERM

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$CANARY_PORT/healthz" >/dev/null

for route in / /radio /artists /join-artists /career /revenue /radio-academy /creator-hub /login /register; do
  curl -fsS "http://127.0.0.1:$CANARY_PORT$route" | grep -q 'id="root"' || {
    echo "ALLEGRO candidate route failed: $route" >&2
    exit 4
  }
done

old_image=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  old_image="$(docker container inspect --format '{{.Config.Image}}' "$APP")"
  docker rm -f "$APP" >/dev/null
fi

rollback(){
  docker rm -f "$APP" >/dev/null 2>&1 || true
  [ -z "$old_image" ] || docker run -d --name "$APP" --restart unless-stopped     -p "127.0.0.1:$PROD_PORT:8080" "$old_image" >/dev/null || true
}

docker run -d --name "$APP" --restart unless-stopped   -p "127.0.0.1:$PROD_PORT:8080" "$IMAGE" >/dev/null || { rollback; exit 5; }

for _ in $(seq 1 30); do
  curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/dev/null && break
  sleep 2
done
curl -fsS "http://127.0.0.1:$PROD_PORT/healthz" >/dev/null || { rollback; exit 6; }

for route in / /radio /artists /creator-hub; do
  curl -fsS "http://127.0.0.1:$PROD_PORT$route" | grep -q 'id="root"' || { rollback; exit 7; }
done

python3 - "$PINNED" "$CORE_URL" <<'PY' > "$ROOT/allegro-cutover.json"
import datetime, json, sys
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"allegro-vibez",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-private-pilot",
  "local_url":"http://127.0.0.1:18108",
  "core_url":sys.argv[2],
  "health_passed":True,
  "route_gate_passed":True,
  "payments_changed":False,
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/allegro-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-allegro-isn01-pilot.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-allegro-isn01-pilot.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "ALLEGRO private-pilot deployment failed inside WSL." }

try {
    $appHealth = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/healthz" -TimeoutSec 8
    if ($appHealth.StatusCode -ne 200) { Fail "ALLEGRO loopback health is not reachable from Windows." }
} catch {
    Fail ("ALLEGRO loopback is not reachable from Windows: " + $_.Exception.Message)
}

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/allegro-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true -or $verified.route_gate_passed -ne $true) { Fail "ALLEGRO local proof was incomplete." }
if ($verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) { Fail "ALLEGRO readiness boundary was violated." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "ALLEGRO receipt violated the private-pilot safety boundary."
}

Write-Host ""
Write-Host "ALLEGRO VIBEZ IZAKHONO PRIVATE PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Local pilot: $LocalOrigin"
Write-Host "Receipt: $Receipt"
Write-Host "IZAKHONO Core connectivity and CORS were verified from Windows before deployment." -ForegroundColor Cyan
Write-Host "DNS, public customer traffic and live payments remain unchanged." -ForegroundColor Yellow
