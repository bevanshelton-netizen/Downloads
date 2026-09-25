#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$OwnedHostname = "revenue.domains.izakhonoafrica.co.za",
  [string]$CanonicalHostname = "revenue.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "IZAKHONO REVENUE DESK - GUARDED CANONICAL PROMOTION" -ForegroundColor Cyan
Write-Host "Owned origin: $OwnedHostname" -ForegroundColor Cyan
Write-Host "Customer hostname: $CanonicalHostname" -ForegroundColor Cyan
Write-Host "External fallback will remain intact." -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed."
}

$ownedEsc = $OwnedHostname.Replace("'","''")
$canonicalEsc = $CanonicalHostname.Replace("'","''")
$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "`$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
export IZAKHONO_REVENUE_OWNED_HOST='$ownedEsc'
export IZAKHONO_REVENUE_CANONICAL_HOST='$canonicalEsc'
bash izakhono-owned-cloud/promote-revenue-desk-canonical.sh
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$code = $LASTEXITCODE

if ($code -eq 20) {
  Write-Host ""
  Write-Host "OWNED ORIGIN VERIFIED. CANONICAL DNS CUTOVER IS NOW THE ONLY REQUIRED PROMOTION STEP." -ForegroundColor Yellow
  Write-Host "Apply the A-record printed above, keep the external fallback unchanged, then rerun this launcher." -ForegroundColor Yellow
  exit 20
}
if ($code -eq 21) {
  Write-Host ""
  Write-Host "Canonical DNS reaches the owner route, but trusted TLS/public ports still need completion." -ForegroundColor Yellow
  exit 21
}
if ($code -ne 0) {
  throw "Revenue Desk canonical promotion failed with code $code."
}

Write-Host ""
Write-Host "REVENUE DESK: OWNED LIVE VERIFIED" -ForegroundColor Green
Write-Host "https://$CanonicalHostname" -ForegroundColor Green
Start-Process "https://$CanonicalHostname"
exit 0
