#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "FAISREADY-CUTOVER.json"
$Pinned = "79deb4dd209512e7238536d4f595301cf3acd0a9"
$LocalOrigin = "http://127.0.0.1:18111"

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

unset FAISREADY_ENV_FILE
IZAKHONO_CANARY_PORT=18211 IZAKHONO_PRODUCTION_PORT=18111 IZAKHONO_ANALYTICS_URL=http://127.0.0.1:18112 GITHUB_SHA="$PINNED" sh FAISReady/scripts/izakhono-production-cutover.sh

HEALTH="$(curl -fsS http://127.0.0.1:18111/health)"
CFG="$(curl -fsS http://127.0.0.1:18111/api/config)"
printf '%s' "$CFG" | grep -q '"payments_configured": false'

python3 - "$PINNED" "$HEALTH" "$CFG" <<'PY' > "$ROOT/faisready-cutover.json"
import datetime, json, sys
health=json.loads(sys.argv[2])
cfg=json.loads(sys.argv[3])
if health.get("ok") is not True:
    raise SystemExit("FAISReady health payload invalid")
if cfg.get("payments_configured") is not False:
    raise SystemExit("FAISReady private-pilot payments unexpectedly configured")
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"faisready",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-controlled-pilot",
  "local_url":"http://127.0.0.1:18111",
  "health_passed":True,
  "payments_configured":False,
  "persistent_data_volume":"faisready_data",
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY
cat "$ROOT/faisready-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-faisready-isn01-pilot.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-faisready-isn01-pilot.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "FAISReady controlled-pilot deployment failed inside WSL." }

try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/health" -TimeoutSec 8
    $config = Invoke-WebRequest -UseBasicParsing -Uri "$LocalOrigin/api/config" -TimeoutSec 8
    if ($health.StatusCode -ne 200 -or $health.Content -notmatch '"ok":true') { Fail "FAISReady Windows health proof failed." }
    if ($config.Content -notmatch '"payments_configured": false') { Fail "FAISReady payment gate unexpectedly opened." }
} catch {
    Fail ("FAISReady loopback proof failed: " + $_.Exception.Message)
}

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/faisready-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8
$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true -or $verified.payments_configured -ne $false) { Fail "FAISReady controlled-pilot receipt is invalid." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "FAISReady receipt violated the controlled-pilot safety boundary."
}

Write-Host ""
Write-Host "FAISREADY IZAKHONO CONTROLLED PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Local pilot: $LocalOrigin"
Write-Host "Receipt: $Receipt"
Write-Host "Payment activation remains locked; DNS, public traffic and live payments remain unchanged." -ForegroundColor Yellow
