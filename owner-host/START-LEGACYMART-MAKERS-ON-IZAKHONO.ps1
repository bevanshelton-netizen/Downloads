#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "market.domains.izakhonoafrica.co.za")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "LEGACYMART MAKERS - IZAKHONO OWNED INFRASTRUCTURE" -ForegroundColor Gold
Write-Host "Reference shop: BEVAN SHELTON(TM)" -ForegroundColor Cyan
Write-Host "Target: IZAKHONO CODE -> RUNTIME -> EDGE/FORTRESS" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$escapedHost = $Hostname.Replace("'","''")
$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "`$(git status --porcelain)" ]; then
  echo "Owner-host Downloads checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main

sudo bash izakhono-owned-cloud/import-repo-to-code.sh   legacymart   https://github.com/bevanshelton-netizen/bevanshelton-netizen-legacymart.git   /etc/izakhono/legacymart-code.env

export LEGACYMART_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-legacymart.sh main
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "LegacyMart Makers owned-infrastructure deployment failed."
}

Write-Host ""
Write-Host "LEGACYMART MAKERS: DEPLOYED TO IZAKHONO RUNTIME" -ForegroundColor Green
Write-Host "Hostname: $Hostname" -ForegroundColor Green

try {
  $public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://$Hostname/health"
  $health = $public.Content | ConvertFrom-Json
  if ($health.ok -eq $true -and $health.service -eq "LegacyMart") {
    Write-Host "PUBLIC HTTPS: LIVE AND VERIFIED" -ForegroundColor Green
    Start-Process "https://$Hostname/shop?seller=bevan-shelton"
    exit 0
  }
} catch {
  Write-Host "Public HTTPS is not reachable yet. Activating IZAKHONO-owned DNS and EDGE..." -ForegroundColor Yellow
}

$edgeLinux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
export IZAKHONO_PUBLIC_ZONE='domains.izakhonoafrica.co.za'
export IZAKHONO_PUBLIC_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/activate-owned-public-edge.sh
"@

$edgeLinux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$edgeCode = $LASTEXITCODE

if ($edgeCode -eq 20) {
  Write-Host ""
  Write-Host "LegacyMart is deployed to IZAKHONO RUNTIME, but one-time network cutover is still required." -ForegroundColor Yellow
  exit 20
}
if ($edgeCode -eq 21) {
  Write-Host ""
  Write-Host "Owned DNS delegation is visible. Public TCP 80/443 or trusted TLS still needs to complete." -ForegroundColor Yellow
  exit 21
}
if ($edgeCode -ne 0) {
  throw "IZAKHONO-owned public edge activation failed (code $edgeCode)."
}

$public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://$Hostname/health"
$health = $public.Content | ConvertFrom-Json
if ($health.ok -ne $true -or $health.service -ne "LegacyMart") {
  throw "Public LegacyMart health verification failed."
}

Write-Host ""
Write-Host "LEGACYMART MAKERS: PUBLIC HTTPS LIVE AND VERIFIED" -ForegroundColor Green
Write-Host "https://$Hostname/shop?seller=bevan-shelton" -ForegroundColor Green
Start-Process "https://$Hostname/shop?seller=bevan-shelton"
exit 0
