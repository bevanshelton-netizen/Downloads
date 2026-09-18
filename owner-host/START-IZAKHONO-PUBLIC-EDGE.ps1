#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

function Is-Admin {
  $id=[Security.Principal.WindowsIdentity]::GetCurrent()
  $p=New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if(-not (Is-Admin)){
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$state=Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$owner=Join-Path $state "START-IZAKHONO-OWNER-HOST.ps1"
if(-not (Test-Path $owner)){
  Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1' -OutFile $owner
}
$distros=(& wsl.exe --list --quiet 2>$null) -join "`n"
if($distros -notmatch 'Ubuntu-24.04'){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $owner
  if($LASTEXITCODE -ne 0){ throw "Owner-host bootstrap did not complete." }
}

Write-Host "Activating IZAKHONO-owned DNS and direct PUBLIC EDGE..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -n \"$(git status --porcelain)\" ]; then echo 'Owner-host checkout has local changes; refusing update.' >&2; exit 3; fi; git fetch origin main; git checkout main; git reset --hard origin/main; bash izakhono-owned-cloud/activate-owned-public-edge.sh"
$code=$LASTEXITCODE

if($code -eq 20){
  Write-Host ""
  Write-Host "IZAKHONO DNS NODE and PUBLIC EDGE are installed and locally verified." -ForegroundColor Green
  Write-Host "The console above shows the one-time parent DNS and router-forward values still needed." -ForegroundColor Yellow
  exit 20
}
if($code -eq 21){
  Write-Host ""
  Write-Host "Owned DNS delegation is visible; trusted TLS/direct EDGE still needs public TCP 80/443 reachability." -ForegroundColor Yellow
  exit 21
}
if($code -ne 0){ throw "Owned public-edge activation did not complete (code $code)." }

Write-Host ""
Write-Host "IZAKHONO OWNED PUBLIC EDGE: ACTIVATED" -ForegroundColor Green
Start-Process "https://domains.izakhonoafrica.co.za"
