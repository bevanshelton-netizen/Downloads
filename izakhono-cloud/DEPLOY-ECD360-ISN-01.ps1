#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "ECD360-CUTOVER.json"
$Pinned = "f41693bbd45951825f8a1265ddab2a93d455856e"

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
Write-Host "Deploying EDU-BUILD ECD360 as a loopback-only controlled pilot..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/edubuild-ecd360"
mkdir -p "$ROOT"

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/edubuild-ecd360.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated ECD360 checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$PINNED"
git checkout --detach "$PINNED"

GITHUB_SHA="$PINNED" sh scripts/izakhono/production-cutover.sh

curl -fsS http://127.0.0.1:18105/healthz >/dev/null
READINESS="$(curl -fsS http://127.0.0.1:18105/go-live.json)"
printf '%s' "$READINESS" | grep -q '"readyForPaidTraffic":false'

python3 - "$PINNED" "$READINESS" <<'PY' > "$ROOT/ecd360-cutover.json"
import datetime, json, sys
readiness=json.loads(sys.argv[2])
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"edubuild-ecd360",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-controlled-pilot",
  "local_url":"http://127.0.0.1:18105",
  "health_passed":True,
  "ready_for_paid_traffic":bool(readiness.get("readyForPaidTraffic")),
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/ecd360-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-ecd360-isn01-cutover.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-ecd360-isn01-cutover.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "ECD360 controlled-pilot cutover failed inside WSL." }

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/ecd360-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true) { Fail "ECD360 health proof was not recorded." }
if ($verified.ready_for_paid_traffic -ne $false) { Fail "ECD360 paid-traffic gate unexpectedly opened." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "ECD360 receipt violated the controlled-pilot safety boundary."
}

Write-Host ""
Write-Host "ECD360 IZAKHONO CUTOVER: VERIFIED" -ForegroundColor Green
Write-Host "Local pilot: http://127.0.0.1:18105"
Write-Host "Receipt: $Receipt"
Write-Host "DNS, customer traffic and live payments remain unchanged." -ForegroundColor Yellow
