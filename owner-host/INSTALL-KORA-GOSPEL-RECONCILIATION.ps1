#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw "WSL is not installed." }
$linux = @'
set -euo pipefail
cd /opt/izakhono-source/Downloads
git fetch origin main
git checkout main
git reset --hard origin/main
bash izakhono-owned-cloud/install-kora-gospel-reconciler.sh
'@
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$code=$LASTEXITCODE
if($code -eq 20){
  Write-Host ""
  Write-Host "Reconciler installed but safely paused." -ForegroundColor Yellow
  Write-Host "Add a dedicated Supabase secret key to:" -ForegroundColor Yellow
  Write-Host "/etc/izakhono/kora-gospel-external.env" -ForegroundColor Cyan
  Write-Host "Then enable kora-gospel-reconcile.timer." -ForegroundColor Cyan
  exit 20
}
if($code -ne 0){ throw "Gospel reconciliation installation failed with code $code." }
Write-Host ""
Write-Host "KORA GOSPEL RECONCILIATION: ACTIVE" -ForegroundColor Green
exit 0
