#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$EnvFile = Join-Path $State "KORA.env"
$EnvTemplate = Join-Path $State "KORA.env.template"
$Receipt = Join-Path $State "KORA-CUTOVER.json"
$SourceRef = "main"

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

if (-not (Test-Path $EnvFile)) {
    Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/kora-network/.env.example" -OutFile $EnvTemplate
    Write-Host "KORA owner-host environment is not present." -ForegroundColor Yellow
    Write-Host "A secret-free template was written to: $EnvTemplate"
    Write-Host "Create $EnvFile from that template using the already-approved KORA runtime values, then rerun this launcher."
    Fail "KORA.env is required and is never committed to source control."
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

$linuxEnv = "/tmp/kora-isn01-owner.env"
Get-Content $EnvFile -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "umask 077; cat > $linuxEnv"
if ($LASTEXITCODE -ne 0) { Fail "Could not hand KORA.env into the owner-controlled WSL runtime." }

Write-Host "ISN-01 proof verified." -ForegroundColor Green
Write-Host "Deploying KORA as an owner-hosted private beta with live-money gates forced closed..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

SOURCE_REF="__SOURCE_REF__"
ROOT="$HOME/izakhono-fleet"
REPO="$ROOT/Downloads"
SOURCE_ENV="/tmp/kora-isn01-owner.env"
SAFE_ENV="$ROOT/kora-private-beta.env"
mkdir -p "$ROOT"

cleanup_secret_copy(){ rm -f "$SOURCE_ENV" "$SAFE_ENV"; }
trap cleanup_secret_copy EXIT INT TERM

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null
[ -s "$SOURCE_ENV" ] || { echo "KORA owner environment was not transferred"; exit 2; }

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/Downloads.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated KORA checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$SOURCE_REF"
RESOLVED="$(git rev-parse "origin/$SOURCE_REF")"
git checkout --detach "$RESOLVED"

cd "$REPO/kora-network"
npm install --no-audit --no-fund
npm run typecheck
npm run build
cd "$REPO"

python3 - "$SOURCE_ENV" "$SAFE_ENV" <<'PY'
from pathlib import Path
import sys

source=Path(sys.argv[1])
target=Path(sys.argv[2])
raw=source.read_text(encoding="utf-8")
updates={
    "PAYFAST_SANDBOX":"true",
    "KORA_TICKET_CHECKOUT_MODE":"off",
    "KORA_TICKET_LIVE_APPROVED":"false",
    "KORA_IZAKHONO_PAY_LIVE_APPROVED":"false",
    "KORA_PRIVATE_SIGNUP_ENABLED":"true",
}
lines=raw.splitlines()
seen=set()
out=[]
for line in lines:
    stripped=line.strip()
    if stripped and not stripped.startswith("#") and "=" in line:
        key=line.split("=",1)[0].strip()
        if key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
            continue
    out.append(line)
for key,value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
target.write_text("\n".join(out)+"\n",encoding="utf-8")
target.chmod(0o600)
PY

KORA_ENV_FILE="$SAFE_ENV" GITHUB_SHA="$RESOLVED" sh kora-network/scripts/izakhono-production-cutover.sh

HEALTH="$(curl -fsS http://127.0.0.1:18107/api/health)"
printf '%s' "$HEALTH" | grep -q '"ok":true'

python3 - "$RESOLVED" "$HEALTH" <<'PY' > "$ROOT/kora-cutover.json"
import datetime, json, sys
health=json.loads(sys.argv[2])
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"kora-network",
  "revision":sys.argv[1],
  "runtime":"docker-loopback-private-beta",
  "local_url":"http://127.0.0.1:18107",
  "health_passed":bool(health.get("ok")),
  "payment_guard":"PAYFAST_SANDBOX=true; KORA_TICKET_CHECKOUT_MODE=off; live approval flags=false",
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/kora-cutover.json"
'@

$bash = $bash.Replace("__SOURCE_REF__", $SourceRef)
$tmp = Join-Path $env:TEMP "izakhono-kora-isn01-cutover.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-kora-isn01-cutover.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "KORA private-beta cutover failed inside WSL." }

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/kora-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true) { Fail "KORA health proof was not recorded." }
if ($verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) { Fail "KORA readiness boundary was violated." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "KORA receipt violated the private-beta safety boundary."
}

Write-Host ""
Write-Host "KORA IZAKHONO PRIVATE BETA: VERIFIED" -ForegroundColor Green
Write-Host "Local beta: http://127.0.0.1:18107"
Write-Host "Receipt: $Receipt"
Write-Host "DNS, public customer traffic and live payments remain unchanged." -ForegroundColor Yellow
