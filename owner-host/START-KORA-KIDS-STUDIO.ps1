#requires -Version 5.1
[CmdletBinding()]
param([int]$Port = 8890)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "KORA KIDS ANIMATION FACTORY - IZAKHONO OWNER STUDIO" -ForegroundColor Cyan
Write-Host "Private owner-side production control - not a public website" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
command -v node >/dev/null 2>&1 || { echo "Node.js is required on the IZAKHONO owner host." >&2; exit 4; }
mkdir -p /var/log/izakhono
pkill -f 'kora-kids-studio/server.mjs' 2>/dev/null || true
export HOST=127.0.0.1
export PORT=$Port
nohup node kora-kids-studio/server.mjs >/var/log/izakhono/kora-kids-studio.log 2>&1 &
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:$Port/health >/tmp/kora-kids-studio-health.json; then
    break
  fi
  sleep 1
done
node -e 'const x=require("/tmp/kora-kids-studio-health.json"); if(x.ok!==true||x.service!=="kora-kids-studio"||x.public!==false) process.exit(2)'
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "KORA KIDS Animation Factory failed to start on IZAKHONO owner host."
}

$health = Invoke-RestMethod -TimeoutSec 8 "http://127.0.0.1:$Port/health"
if ($health.ok -ne $true -or $health.service -ne "kora-kids-studio" -or $health.public -ne $false) {
  throw "Animation Factory health verification failed."
}

Write-Host ""
Write-Host "ANIMATION FACTORY: READY" -ForegroundColor Green
Write-Host "Owner studio: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Public exposure: NO" -ForegroundColor Green
Start-Process "http://127.0.0.1:$Port"
exit 0
