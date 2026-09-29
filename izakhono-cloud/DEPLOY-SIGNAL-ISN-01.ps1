#requires -Version 5.1
# Source policy: resolve current main to an exact commit and validate the packaged SIGNAL release before cutover.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$EnvFile = Join-Path $State "SIGNAL.env"
$Receipt = Join-Path $State "SIGNAL-CUTOVER.json"
$LocalOrigin = "http://127.0.0.1:18116"
$SourceRef = "main"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

function New-HexSecret([int]$Bytes) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return -join ($buf | ForEach-Object { $_.ToString("x2") })
}

function New-UrlSecret([int]$Bytes) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+','-').Replace('/','_')
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

if (-not (Test-Path $EnvFile)) {
    $master = New-HexSecret 32
    $admin = New-UrlSecret 32
    @(
        "SIGNAL_MASTER_KEY=$master",
        "SIGNAL_ADMIN_KEY=$admin",
        "META_GRAPH_VERSION=",
        "LINKEDIN_VERSION=",
        "SIGNAL_PUBLIC_URL=$LocalOrigin"
    ) | Set-Content -Path $EnvFile -Encoding ASCII
    Write-Host "Generated owner-only SIGNAL runtime keys at $EnvFile" -ForegroundColor Green
}

$envText = Get-Content $EnvFile -Raw
if ($envText -notmatch '(?m)^SIGNAL_MASTER_KEY=[0-9a-fA-F]{64}\s*$') { Fail "SIGNAL_MASTER_KEY is invalid." }
if ($envText -notmatch '(?m)^SIGNAL_ADMIN_KEY=.{20,}\s*$') { Fail "SIGNAL_ADMIN_KEY is invalid." }

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

$linuxEnv = "/tmp/izakhono-signal-owner.env"
Get-Content $EnvFile -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "umask 077; cat > $linuxEnv"
if ($LASTEXITCODE -ne 0) { Fail "Could not transfer SIGNAL.env into the owner-controlled WSL runtime." }

$bash = @'
set -euo pipefail

SOURCE_REF="__SOURCE_REF__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/Downloads"
ZIP="$REPO/izakhono-signal/releases/IZAKHONO-SIGNAL-v2-SOVEREIGN.zip"
SRC="$ROOT/signal-v2-src"
ENV_FILE="/tmp/izakhono-signal-owner.env"
LOCAL="http://127.0.0.1:18116"

cleanup(){ rm -f "$ENV_FILE"; }
trap cleanup EXIT INT TERM

mkdir -p "$ROOT"
for cmd in git docker curl python3 unzip; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null
[ -s "$ENV_FILE" ] || { echo "SIGNAL environment was not transferred"; exit 2; }

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/Downloads.git "$REPO"
fi
cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated Downloads checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$SOURCE_REF"
RESOLVED="$(git rev-parse "origin/$SOURCE_REF")"
git checkout --detach "$RESOLVED"

test -f "$ZIP"
unzip -tq "$ZIP" >/dev/null

rm -rf "$SRC"
mkdir -p "$SRC"
unzip -q "$ZIP" -d "$SRC"
APP="$SRC/izakhono-signal-v2"
[ -f "$APP/Dockerfile" ] || { echo "SIGNAL Dockerfile missing"; exit 2; }
[ -f "$APP/.izakhono.json" ] || { echo "SIGNAL IZAKHONO manifest missing"; exit 2; }

docker build -t izakhono/signal:v2 "$APP"
docker volume create izakhono_signal_data >/dev/null
docker rm -f izakhono-signal-v2 >/dev/null 2>&1 || true
docker run -d \
  --name izakhono-signal-v2 \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -e DATA_DIR=/data \
  -p 127.0.0.1:18116:8080 \
  -v izakhono_signal_data:/data \
  izakhono/signal:v2 >/dev/null

for i in $(seq 1 30); do
  if curl -fsS "$LOCAL/api/health" >/tmp/signal-health.json; then break; fi
  sleep 1
done

HEALTH="$(cat /tmp/signal-health.json)"
CATALOG="$(curl -fsS "$LOCAL/api/catalog")"
python3 - "$RESOLVED" "$HEALTH" "$CATALOG" <<'PY' > "$ROOT/signal-cutover.json"
import datetime, json, sys
revision=sys.argv[1]
health=json.loads(sys.argv[2])
catalog=json.loads(sys.argv[3])
if health.get("ok") is not True:
    raise SystemExit("SIGNAL health payload invalid")
if health.get("configured") is not True:
    raise SystemExit("SIGNAL internal security configuration is not ready")
connectors=catalog.get("connectors") or []
if len(connectors) < 6:
    raise SystemExit("SIGNAL connector catalog incomplete")
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"izakhono-signal-v2",
  "revision":revision,
  "runtime":"docker-loopback-owner-pilot",
  "local_url":"http://127.0.0.1:18116",
  "health_passed":True,
  "configured":True,
  "connector_count":len(connectors),
  "persistent_data_volume":"izakhono_signal_data",
  "external_social_accounts_connected":False,
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY
cat "$ROOT/signal-cutover.json"
'@

$bash = $bash.Replace("__SOURCE_REF__", $SourceRef)
$tmp = Join-Path $env:TEMP "izakhono-signal-isn01-pilot.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-signal-isn01-pilot.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "SIGNAL owner-node deployment failed inside WSL." }

try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/api/health" -TimeoutSec 8
    $catalog = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/api/catalog" -TimeoutSec 8
    if ($health.StatusCode -ne 200 -or $health.Content -notmatch '"ok":true') { Fail "SIGNAL Windows health proof failed." }
    if ($health.Content -notmatch '"configured":true') { Fail "SIGNAL internal security configuration is not ready." }
    $catalogJson = $catalog.Content | ConvertFrom-Json
    if ($catalogJson.connectors.Count -lt 6) { Fail "SIGNAL connector catalog proof failed." }
} catch {
    Fail ("SIGNAL loopback proof failed: " + $_.Exception.Message)
}

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/signal-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8
$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true -or $verified.configured -ne $true) { Fail "SIGNAL owner pilot receipt is invalid." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false) {
    Fail "SIGNAL receipt violated the private deployment boundary."
}

Write-Host ""
Write-Host "IZAKHONO SIGNAL v2 OWNER PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Local control desk: $LocalOrigin"
Write-Host "Receipt: $Receipt"
Write-Host "External social OAuth remains disconnected until provider credentials are explicitly installed." -ForegroundColor Yellow
Write-Host "Public DNS and public traffic remain unchanged." -ForegroundColor Yellow
