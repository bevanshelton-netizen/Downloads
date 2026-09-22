#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = "creative.domains.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "IZAKHONO CREATIVE SUITE - OWNED INFRASTRUCTURE" -ForegroundColor Cyan
Write-Host "Target: ISN-01 -> IZAKHONO CODE -> RUNTIME -> EDGE/FORTRESS" -ForegroundColor Cyan
Write-Host "Commercial safety: registration and checkout remain disabled." -ForegroundColor Yellow
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
export CREATIVE_SUITE_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-creative-suite.sh main
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "Creative Suite owned-infrastructure deployment failed."
}

$healthRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS -H 'Host: $escapedHost' http://127.0.0.1:8080/health")
if ($LASTEXITCODE -ne 0) {
  throw "Creative Suite local runtime health verification failed."
}
$health = $healthRaw | ConvertFrom-Json
if ($health.ok -ne $true -or $health.service -ne "izakhono-creative-suite") {
  throw "Creative Suite local runtime returned an unexpected health response."
}
if ($health.registration_enabled -ne $false -or $health.checkout_enabled -ne $false) {
  throw "Commercial safety gate failed: registration or checkout is unexpectedly enabled."
}

$receiptRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/creative-suite.json")
if ($LASTEXITCODE -ne 0) {
  throw "Creative Suite deployment receipt is unavailable."
}
$receipt = $receiptRaw | ConvertFrom-Json

$desktop = [Environment]::GetFolderPath("Desktop")
$reportPath = Join-Path $desktop "IZAKHONO-CREATIVE-SUITE-DEPLOYMENT.txt"
@(
  "IZAKHONO CREATIVE SUITE - OWNED DEPLOYMENT"
  "Timestamp: $(Get-Date -Format o)"
  "Hostname: $Hostname"
  "Revision: $($receipt.revision)"
  "Runtime: VERIFIED"
  "Edge: $($receipt.edge)"
  "Public HTTPS: $($receipt.public_https)"
  "Registration enabled: $($receipt.registration_enabled)"
  "Checkout enabled: $($receipt.checkout_enabled)"
  "External fallback preserved: $($receipt.external_fallback_preserved)"
) | Set-Content -Encoding UTF8 $reportPath

Write-Host ""
Write-Host "CREATIVE SUITE: DEPLOYED TO IZAKHONO RUNTIME" -ForegroundColor Green
Write-Host "Local runtime health: VERIFIED" -ForegroundColor Green
Write-Host "Hostname: $Hostname" -ForegroundColor Green
Write-Host "Report: $reportPath" -ForegroundColor Cyan

if ($receipt.public_https -eq "VERIFIED") {
  Write-Host "OWNED PUBLIC HTTPS: VERIFIED" -ForegroundColor Green
  Start-Process "https://$Hostname"
} else {
  Write-Host "OWNED PUBLIC HTTPS: NOT VERIFIED YET" -ForegroundColor Yellow
  Write-Host "The application is deployed internally. IZAKHONO PUBLIC EDGE/DNS can expose this registered hostname when the owned edge is activated." -ForegroundColor Yellow
}

Write-Host "Registration and $5 checkout remain OFF until their end-to-end release gates pass." -ForegroundColor Yellow
