#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "gospel.domains.izakhonoafrica.co.za")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "YHVH GOSPEL TV - IZAKHONO OWNED INFRASTRUCTURE" -ForegroundColor Yellow
Write-Host "Target: ISN-01 -> IZAKHONO CODE -> RUNTIME -> EDGE" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first." }
$distros = (& wsl.exe --list --quiet 2>$null) -join "\n"
if ($distros -notmatch "Ubuntu-24.04") { throw "Ubuntu-24.04 owner host is not installed." }

$escapedHost = $Hostname.Replace("'","''")
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
bash izakhono-owned-cloud/migrate-source-to-code.sh
export KORA_GOSPEL_TV_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-kora-gospel-tv.sh main
"@
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { throw "YHVH GOSPEL TV owned-infrastructure deployment failed." }

Write-Host ""
Write-Host "YHVH GOSPEL TV: DEPLOYED TO IZAKHONO RUNTIME" -ForegroundColor Green
Write-Host "Hostname: $Hostname" -ForegroundColor Green

try {
  $public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://$Hostname/health"
  $health = $public.Content | ConvertFrom-Json
  if ($health.ok -eq $true -and $health.service -eq "kora-gospel-tv") {
    Write-Host "PUBLIC HTTPS: LIVE AND VERIFIED" -ForegroundColor Green
    Start-Process "https://$Hostname"
    exit 0
  }
} catch { Write-Host "Public HTTPS is not reachable yet. Activating IZAKHONO-owned DNS and EDGE..." -ForegroundColor Yellow }

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
  Write-Host "Runtime is deployed. One-time parent DNS/router cutover is still required." -ForegroundColor Yellow
  exit 20
}
if ($edgeCode -eq 21) {
  Write-Host "Owned DNS is visible. Public TCP 80/443 or trusted TLS still needs to complete." -ForegroundColor Yellow
  exit 21
}
if ($edgeCode -ne 0) { throw "IZAKHONO-owned public edge activation failed (code $edgeCode)." }

$public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://$Hostname/health"
$health = $public.Content | ConvertFrom-Json
if ($health.ok -ne $true -or $health.service -ne "kora-gospel-tv") { throw "Public YHVH GOSPEL TV health verification failed." }

Write-Host ""
Write-Host "YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED" -ForegroundColor Green
Write-Host "https://$Hostname" -ForegroundColor Green
Start-Process "https://$Hostname"
exit 0
