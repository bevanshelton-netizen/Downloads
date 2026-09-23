#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = "one.domains.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "IZAKHONO ONE — DEPLOYMENT READINESS" -ForegroundColor Cyan
Write-Host "Target: $Hostname" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed."
}

$escapedHost = $Hostname.Replace("'","''")
$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "\$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing readiness update." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
export IZAKHONO_ONE_AI_HOSTNAME='$escapedHost'
bash -n izakhono-owned-cloud/preflight-izakhono-one.sh
bash izakhono-owned-cloud/preflight-izakhono-one.sh
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "IZAKHONO ONE deployment preflight failed to execute."
}

$desktop = [Environment]::GetFolderPath("Desktop")
$jsonPath = Join-Path $desktop "IZAKHONO-ONE-DEPLOYMENT-READINESS.json"
$textPath = Join-Path $desktop "IZAKHONO-ONE-DEPLOYMENT-READINESS.txt"

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/izakhono-one-deployment-readiness.json" | Set-Content -Path $jsonPath -Encoding UTF8
if ($LASTEXITCODE -ne 0) { throw "Could not copy JSON readiness receipt." }

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/izakhono-one-deployment-readiness.txt" | Set-Content -Path $textPath -Encoding UTF8
if ($LASTEXITCODE -ne 0) { throw "Could not copy readiness summary." }

$readiness = Get-Content $jsonPath -Raw | ConvertFrom-Json
Write-Host ""
Write-Host "Overall: $($readiness.overall)" -ForegroundColor Yellow
Write-Host "Technical runtime ready: $($readiness.readiness.technical_runtime_ready)" -ForegroundColor Cyan
Write-Host "Public pilot ready: $($readiness.readiness.public_pilot_ready)" -ForegroundColor Cyan
Write-Host "Commercial ready: $($readiness.readiness.commercial_ready)" -ForegroundColor Cyan
if ($readiness.blockers.Count -gt 0) {
  Write-Host "Blockers: $($readiness.blockers -join ', ')" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Desktop JSON: $jsonPath" -ForegroundColor Green
Write-Host "Desktop summary: $textPath" -ForegroundColor Green
