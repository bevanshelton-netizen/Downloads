#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "hair.domains.izakhonoafrica.co.za")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "CROWNE HAIR - IZAKHONO OWNED INFRASTRUCTURE" -ForegroundColor Magenta
Write-Host "Target: ISN-01 -> IZAKHONO CODE -> RUNTIME -> EDGE/FORTRESS" -ForegroundColor Cyan
Write-Host ""
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first." }
$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") { throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first." }
$escapedHost=$Hostname.Replace("'","''")
$linux=@"
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
export CROWNE_HAIR_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-crowne-hair.sh main
"@
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { throw "CROWNÉ Hair owned-infrastructure deployment failed." }
Write-Host ""
Write-Host "CROWNÉ HAIR: DEPLOYED TO IZAKHONO RUNTIME" -ForegroundColor Green
Write-Host "Hostname: $Hostname" -ForegroundColor Green
try {
  $public=Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://$Hostname/health"
  $health=$public.Content | ConvertFrom-Json
  if($health.ok -eq $true -and $health.service -eq "crowne-hair"){
    Write-Host "PUBLIC HTTPS: LIVE AND VERIFIED" -ForegroundColor Green
    Start-Process "https://$Hostname"
    exit 0
  }
} catch { Write-Host "Runtime is deployed. Public DNS/EDGE may still require the existing IZAKHONO domains cutover." -ForegroundColor Yellow }
exit 20
