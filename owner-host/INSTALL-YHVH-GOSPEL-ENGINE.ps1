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
if($code -ne 0){throw "YHVH Gospel Engine installation failed with code $code."}
Write-Host "YHVH GOSPEL ENGINE v2: ACTIVE ON IZAKHONO OWNED INFRASTRUCTURE" -ForegroundColor Green
exit 0
