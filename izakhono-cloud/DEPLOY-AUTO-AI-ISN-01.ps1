#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$EnvFile = Join-Path $State "AUTO-AI.env"
$EnvTemplate = Join-Path $State "AUTO-AI.env.template"
$Receipt = Join-Path $State "AUTO-AI-CUTOVER.json"
$Pinned = "69ec4d0ad41edef19899e3345629cb8d6c989db9"

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

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

if (-not (Test-Path $EnvTemplate)) {
    @"
# Optional AUTO AI conversational gateway.
# Leave AUTO-AI.env absent to run the local safety engine only.
AI_CHAT_URL=
AI_API_KEY=
AI_MODEL=
"@ | Set-Content -Path $EnvTemplate -Encoding UTF8
}

$HasAIEnv = Test-Path $EnvFile
$linuxEnv = "/tmp/auto-ai-isn01.env"
if ($HasAIEnv) {
    Get-Content $EnvFile -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "umask 077; cat > $linuxEnv"
    if ($LASTEXITCODE -ne 0) { Fail "Could not hand AUTO-AI.env into the owner-controlled WSL runtime." }
}

Write-Host "ISN-01 proof verified." -ForegroundColor Green
if ($HasAIEnv) {
    Write-Host "AUTO AI gateway environment detected; secrets will be passed only to the container runtime." -ForegroundColor Green
} else {
    Write-Host "AUTO AI will launch with its local safety engine. Optional template: $EnvTemplate" -ForegroundColor Yellow
}
Write-Host "Deploying AUTO AI as an owner-hosted private beta..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
HAS_ENV="__HAS_ENV__"
ROOT="$HOME/izakhono-fleet/auto-ai"
REPO="$ROOT/Downloads"
IMAGE="izakhono/auto-ai:$PINNED"
CONTAINER="izakhono-auto-ai"
PORT="18120"
SOURCE_ENV="/tmp/auto-ai-isn01.env"
mkdir -p "$ROOT"

cleanup(){ rm -f "$SOURCE_ENV"; }
trap cleanup EXIT INT TERM

for cmd in git docker curl python3; do
  command -v "$cmd" >/dev/null || { echo "$cmd missing"; exit 2; }
done
docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/Downloads.git "$REPO"
fi

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "Dedicated AUTO AI checkout has local changes; refusing to overwrite." >&2
  exit 3
fi

git fetch origin "$PINNED"
git checkout --detach "$PINNED"

test -f auto-ai/Dockerfile
test -f auto-ai/server.mjs
test -f auto-ai/public/index.html

docker build -t "$IMAGE" auto-ai

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "Port $PORT is already in use after removing the prior AUTO AI container." >&2
  exit 4
fi

ENV_ARGS=()
if [ "$HAS_ENV" = "true" ]; then
  [ -s "$SOURCE_ENV" ] || { echo "AUTO AI environment transfer is empty"; exit 4; }
  ENV_ARGS=(--env-file "$SOURCE_ENV")
fi

docker run -d   --name "$CONTAINER"   --restart unless-stopped   --read-only   --tmpfs /tmp:rw,noexec,nosuid,size=64m   --security-opt no-new-privileges   -p "127.0.0.1:$PORT:8080"   "${ENV_ARGS[@]}"   "$IMAGE" >/dev/null

ok=false
for i in $(seq 1 30); do
  if HEALTH="$(curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"; then
    printf '%s' "$HEALTH" | grep -q '"ok":true' && { ok=true; break; }
  fi
  sleep 1
done
[ "$ok" = true ] || { docker logs "$CONTAINER" --tail 100; exit 5; }

python3 - "$PINNED" "$HEALTH" "$PORT" <<'PY' > "$ROOT/auto-ai-cutover.json"
import datetime, json, sys
revision, health_raw, port = sys.argv[1:4]
health=json.loads(health_raw)
print(json.dumps({
  "schema":"izakhono.owner-cutover/v1",
  "node_name":"ISN-01",
  "app":"auto-ai",
  "revision":revision,
  "runtime":"docker-loopback-private-beta",
  "local_url":f"http://127.0.0.1:{port}",
  "health_passed":bool(health.get("ok")),
  "ai_configured":bool(health.get("aiConfigured")),
  "public_dns_changed":False,
  "public_traffic_changed":False,
  "live_payments_changed":False,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$ROOT/auto-ai-cutover.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned).Replace("__HAS_ENV__", $HasAIEnv.ToString().ToLowerInvariant())
$tmp = Join-Path $env:TEMP "izakhono-auto-ai-isn01-cutover.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8
$linuxTmp = "/tmp/izakhono-auto-ai-isn01-cutover.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "AUTO AI private-beta cutover failed inside WSL." }

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-fleet/auto-ai/auto-ai-cutover.json"
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.health_passed -ne $true) { Fail "AUTO AI health proof was not recorded." }
if ($verified.public_ready -ne $false -or $verified.commercial_ready -ne $false) { Fail "AUTO AI readiness boundary was violated." }
if ($verified.public_dns_changed -ne $false -or $verified.public_traffic_changed -ne $false -or $verified.live_payments_changed -ne $false) {
    Fail "AUTO AI receipt violated the private-beta safety boundary."
}

Write-Host ""
Write-Host "AUTO AI IZAKHONO PRIVATE BETA: VERIFIED" -ForegroundColor Green
Write-Host "Local beta: http://127.0.0.1:18120"
Write-Host "Receipt: $Receipt"
Write-Host ("AI gateway configured: " + $verified.ai_configured)
Write-Host "DNS, public customer traffic and live payments remain unchanged." -ForegroundColor Yellow
