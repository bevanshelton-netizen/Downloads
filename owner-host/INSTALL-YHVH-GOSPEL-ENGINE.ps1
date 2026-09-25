#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
if(-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)){throw "WSL is not installed."}
$linux=@'
set -euo pipefail
cd /opt/izakhono-source/Downloads
git fetch origin main
git checkout main
git reset --hard origin/main
bash izakhono-owned-cloud/install-yhvh-gospel-engine.sh
'@
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$code=$LASTEXITCODE
if($code -eq 20){
  Write-Host ""
  Write-Host "YHVH GOSPEL ENGINE installed but safely paused." -ForegroundColor Yellow
  Write-Host "Set YHVH_GOSPEL_ENGINE_TOKEN in /etc/izakhono/yhvh-gospel-engine.env" -ForegroundColor Cyan
  Write-Host "Then run: sudo systemctl enable --now yhvh-gospel-engine.service" -ForegroundColor Cyan
  exit 20
}
if($code -ne 0){throw "YHVH Gospel Engine installation failed with code $code."}
Write-Host "YHVH GOSPEL ENGINE: ACTIVE" -ForegroundColor Green
exit 0
