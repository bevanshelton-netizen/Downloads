#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$EnvFile = Join-Path $State "KORA.env"
$Receipt = Join-Path $State "KORA-CUTOVER.json"
$Archive = Join-Path $PSScriptRoot "KORA-ISN01-SOURCE.tar.gz"
$ChecksumFile = "$Archive.sha256"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

if ($env:OS -ne "Windows_NT") { Fail "Run this installer on the Windows owner machine." }
if (-not (Test-Path $EngineProof)) { Fail "Run START-IZAKHONO-ENGINE-ISN-01.cmd first." }
if (-not (Test-Path $EnvFile)) { Fail "Missing owner-controlled environment file: $EnvFile" }
if (-not (Test-Path $Archive)) { Fail "Missing KORA release archive beside this installer." }
if (-not (Test-Path $ChecksumFile)) { Fail "Missing KORA release checksum beside this installer." }

$proof = Get-Content $EngineProof -Raw | ConvertFrom-Json
if ($proof.node_name -ne "ISN-01") { Fail "Engine proof is not for ISN-01." }
foreach ($field in @("scheduler_dispatch","image_pull","container_start","http_health")) {
    if ($proof.$field -ne $true) { Fail "Engine proof field '$field' is not verified." }
}
if ($proof.public_ready -ne $false -or $proof.commercial_ready -ne $false) {
    Fail "Unexpected public/commercial readiness state."
}

$expected = ((Get-Content $ChecksumFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
if ($expected -ne $actual) { Fail "Release checksum mismatch." }

$linuxArchive = "/tmp/kora-isn01-source.tar.gz"
$linuxEnv = "/tmp/kora-isn01-owner.env"
$linuxSource = (wsl.exe -d Ubuntu-24.04 -- wslpath -a $Archive).Trim()
if (-not $linuxSource) { Fail "Could not resolve the Windows release path inside WSL." }
wsl.exe -d Ubuntu-24.04 -- cp -- $linuxSource $linuxArchive
if ($LASTEXITCODE -ne 0) { Fail "Could not transfer the KORA release into WSL." }
Get-Content $EnvFile -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "umask 077; cat > $linuxEnv"
if ($LASTEXITCODE -ne 0) { Fail "Could not transfer KORA.env into WSL." }

$bash = @'
set -euo pipefail
ARCHIVE=/tmp/kora-isn01-source.tar.gz
SOURCE_ENV=/tmp/kora-isn01-owner.env
ROOT="$HOME/izakhono-fleet"
RELEASE="$ROOT/releases/kora-private-beta"
SAFE_ENV="$ROOT/kora-private-beta.env"
cleanup(){ rm -f "$ARCHIVE" "$SOURCE_ENV" "$SAFE_ENV"; }
trap cleanup EXIT INT TERM

for cmd in docker curl python3 tar; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing" >&2; exit 2; }
done
docker info >/dev/null
[ -s "$ARCHIVE" ] && [ -s "$SOURCE_ENV" ]
rm -rf "$RELEASE.next"
mkdir -p "$RELEASE.next"
tar -xzf "$ARCHIVE" -C "$RELEASE.next"
[ -f "$RELEASE.next/kora-network/Dockerfile.izakhono-production" ]

python3 - "$SOURCE_ENV" "$SAFE_ENV" <<'PY'
from pathlib import Path
import sys
source, target = map(Path, sys.argv[1:])
updates = {
  "PAYFAST_SANDBOX":"true",
  "KORA_TICKET_CHECKOUT_MODE":"off",
  "KORA_TICKET_LIVE_APPROVED":"false",
  "KORA_IZAKHONO_PAY_LIVE_APPROVED":"false",
  "KORA_PRIVATE_SIGNUP_ENABLED":"true",
}
out=[]; seen=set()
for line in source.read_text(encoding="utf-8").splitlines():
  key=line.split("=",1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else ""
  if key in updates:
    out.append(f"{key}={updates[key]}"); seen.add(key)
  else: out.append(line)
for key, value in updates.items():
  if key not in seen: out.append(f"{key}={value}")
target.write_text("\n".join(out)+"\n", encoding="utf-8")
target.chmod(0o600)
PY

rm -rf "$RELEASE.previous"
if [ -d "$RELEASE" ]; then mv "$RELEASE" "$RELEASE.previous"; fi
mv "$RELEASE.next" "$RELEASE"
cd "$RELEASE"
KORA_ENV_FILE="$SAFE_ENV" GITHUB_SHA="offline-image-led" sh kora-network/scripts/izakhono-production-cutover.sh
HEALTH="$(curl -fsS http://127.0.0.1:18107/api/health)"
printf '%s' "$HEALTH" | grep -q '"ok":true'
python3 - "$HEALTH" <<'PY' > "$ROOT/kora-cutover.json"
import datetime, json, sys
health=json.loads(sys.argv[1])
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1", "node_name":"ISN-01",
  "app":"kora-network", "revision":"offline-image-led",
  "runtime":"docker-loopback-private-beta", "local_url":"http://127.0.0.1:18107",
  "health_passed":bool(health.get("ok")),
  "payment_guard":"sandbox=true; checkout=off; live approvals=false",
  "public_dns_changed":False, "public_traffic_changed":False,
  "live_payments_changed":False, "public_ready":False, "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY
cat "$ROOT/kora-cutover.json"
'@

$tmp = Join-Path $env:TEMP "izakhono-kora-offline-cutover.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > /tmp/izakhono-kora-offline-cutover.sh"
wsl.exe -d Ubuntu-24.04 -- bash /tmp/izakhono-kora-offline-cutover.sh
if ($LASTEXITCODE -ne 0) { Fail "KORA private-beta cutover failed inside WSL." }

wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/kora-cutover.json" | Set-Content $Receipt -Encoding UTF8
$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true -or $verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) {
    Fail "KORA safety receipt verification failed."
}

Write-Host "KORA IZAKHONO PRIVATE BETA: VERIFIED" -ForegroundColor Green
Write-Host "Open: http://127.0.0.1:18107"
Write-Host "DNS, public traffic and live payments remain unchanged." -ForegroundColor Yellow
