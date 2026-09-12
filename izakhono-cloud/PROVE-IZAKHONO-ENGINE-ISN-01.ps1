param()

$ErrorActionPreference = "Stop"
$State = "$env:ProgramData\IZAKHONO\ISN-01"
$Receipt = Join-Path $State "SOVEREIGN-NODE.json"
$Result = Join-Path $State "ENGINE-PROOF.json"
$Pinned = "c7af2604cfdc2f225db21c18fc7dbed266003eb1"

function Fail([string]$Message) {
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 2
}

if (-not (Test-Path $Receipt)) {
  Fail "SOVEREIGN-NODE.json not found. Run START-ISN-01.cmd first."
}

$identity = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($identity.node_name -ne "ISN-01") { Fail "Receipt is not for ISN-01." }
if ($identity.workload_proof -ne "verified") { Fail "Existing owner-machine workload proof is not verified." }
if ($identity.public_ready -ne $false -or $identity.commercial_ready -ne $false) {
  Fail "Unexpected readiness state in sovereign-node receipt."
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

Write-Host "ISN-01 sovereign identity verified." -ForegroundColor Green
Write-Host "Starting private loopback IZAKHONO Engine proof..." -ForegroundColor Cyan

$bash = @'
set -euo pipefail

PINNED="__PINNED__"
WORK="$HOME/izakhono-engine-proof"
REPO="$WORK/izakhono-builder"
LOG="$WORK/log"
TOKEN_FILE="$WORK/enroll-token"
mkdir -p "$WORK" "$LOG"

command -v git >/dev/null || { echo "git missing"; exit 2; }
command -v node >/dev/null || { echo "node missing"; exit 2; }
command -v docker >/dev/null || { echo "docker missing"; exit 2; }
command -v curl >/dev/null || { echo "curl missing"; exit 2; }

docker info >/dev/null

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/izakhono-builder.git "$REPO"
fi

cd "$REPO"
git fetch --all --prune
git checkout --detach "$PINNED"

cd izakhono-containers

if [ -f "$WORK/control.pid" ]; then kill "$(cat "$WORK/control.pid")" 2>/dev/null || true; fi
if [ -f "$WORK/agent.pid" ]; then kill "$(cat "$WORK/agent.pid")" 2>/dev/null || true; fi
docker rm -f iz-engine-proof >/dev/null 2>&1 || true

python3 - <<'PY' > "$TOKEN_FILE"
import secrets
print(secrets.token_hex(32))
PY
chmod 600 "$TOKEN_FILE"
TOKEN="$(cat "$TOKEN_FILE")"

IZ_NODE_ENROLL_TOKEN="$TOKEN" PORT=8080 node server.js > "$LOG/control.log" 2>&1 &
echo $! > "$WORK/control.pid"

for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:8080/api/health >/dev/null && break
  sleep 1
done
curl -fsS http://127.0.0.1:8080/api/health >/dev/null

IZ_CONTROL_URL="http://127.0.0.1:8080" \
IZ_NODE_NAME="ISN-01" \
IZ_NODE_REGION="Johannesburg" \
IZ_NODE_ENROLL_TOKEN="$TOKEN" \
node engine/agent.js > "$LOG/agent.log" 2>&1 &
echo $! > "$WORK/agent.pid"

for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:8080/api/nodes | grep -q '"ISN-01"' && break
  sleep 1
done

DEPLOY_JSON=$(curl -fsS -X POST http://127.0.0.1:8080/api/deployments \
  -H 'content-type: application/json' \
  -d '{"app":"engine-proof","image":"nginx:alpine","node":"ISN-01","port":8088}')

echo "$DEPLOY_JSON" > "$WORK/deployment.json"

for i in $(seq 1 60); do
  if curl -fsSI http://127.0.0.1:8088 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsSI http://127.0.0.1:8088 >/dev/null

CID=$(docker ps --filter ancestor=nginx:alpine --format '{{.ID}}' | head -n1)
[ -n "$CID" ] || { echo "proof container not running"; exit 2; }

python3 - "$CID" "$PINNED" <<'PY' > "$WORK/proof.json"
import json,sys,datetime
print(json.dumps({
  "schema":"izakhono.engine-proof/v1",
  "node_name":"ISN-01",
  "proof_context":"owner_machine_local_loopback",
  "control_plane":"http://127.0.0.1:8080",
  "workload_image":"nginx:alpine",
  "workload_http":"http://127.0.0.1:8088",
  "container_id":sys.argv[1],
  "engine_commit":sys.argv[2],
  "scheduler_dispatch":True,
  "image_pull":True,
  "container_start":True,
  "http_health":True,
  "public_ready":False,
  "commercial_ready":False,
  "proved_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z")
}, indent=2))
PY

cat "$WORK/proof.json"
'@

$bash = $bash.Replace("__PINNED__", $Pinned)
$tmp = Join-Path $env:TEMP "izakhono-engine-isn01-proof.sh"
Set-Content -Path $tmp -Value $bash -Encoding UTF8

$linuxTmp = "/tmp/izakhono-engine-isn01-proof.sh"
Get-Content $tmp -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "cat > $linuxTmp"
wsl.exe -d Ubuntu-24.04 -- bash $linuxTmp
if ($LASTEXITCODE -ne 0) { Fail "Engine proof failed inside WSL." }

$proof = wsl.exe -d Ubuntu-24.04 -- bash -lc "cat ~/izakhono-engine-proof/proof.json"
$proof | Set-Content -Path $Result -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO ENGINE PROOF: VERIFIED" -ForegroundColor Green
Write-Host "Receipt: $Result"
Write-Host "Public readiness remains FALSE." -ForegroundColor Yellow
