#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = "growth.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "IZAKHONO GROWTH OS v2 - OWNED INFRASTRUCTURE" -ForegroundColor Cyan
Write-Host "Target: ISN-01 -> IZAKHONO CODE -> RUNTIME -> EDGE" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$distros = (& wsl.exe --list --quiet 2>$null) -join "
"
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$escapedHost = $Hostname.Replace("'","''")
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
bash izakhono-owned-cloud/migrate-source-to-code.sh
export GROWTH_OS_V2_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-growth-os-v2.sh main
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "Growth OS v2 owned-infrastructure deployment failed."
}

Write-Host ""
Write-Host "GROWTH OS v2: DEPLOYED TO IZAKHONO RUNTIME" -ForegroundColor Green
Write-Host "Hostname: $Hostname" -ForegroundColor Green
Write-Host "The launcher does not force a DNS cutover. Public HTTPS is accepted only when the health receipt verifies it." -ForegroundColor Yellow
