#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "revenue.izakhonoafrica.co.za")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first." }
$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") { throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first." }

$escapedHost = $Hostname.Replace("'","''")
$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "`$(git status --porcelain)" ]; then echo "Owner-host source checkout has local changes; refusing to overwrite." >&2; exit 3; fi
git fetch origin main
git checkout main
git reset --hard origin/main
bash izakhono-owned-cloud/migrate-source-to-code.sh
export IZAKHONO_REVENUE_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-revenue-desk.sh main
"@
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { throw "Revenue Desk owned-infrastructure deployment failed." }
Write-Host "Revenue Desk deployed to IZAKHONO RUNTIME." -ForegroundColor Green
Write-Host "Do not advertise the owned hostname until PUBLIC_HTTPS=VERIFIED." -ForegroundColor Yellow
