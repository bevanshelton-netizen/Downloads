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

$State=Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
$Owner=Join-Path $State "START-IZAKHONO-OWNER-HOST.ps1"
New-Item -ItemType Directory -Force -Path $State | Out-Null

if(-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)){
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros=(& wsl.exe --list --quiet 2>$null) -join "`n"
if($distros -notmatch "Ubuntu-24.04"){
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

Write-Host ""
Write-Host "IZAKHONO EXTERNAL BRIDGE - TAILSCALE FUNNEL" -ForegroundColor Cyan
Write-Host "Core remains on ISN-01. Tailscale is public transport only." -ForegroundColor Cyan

$RunBridge = {
  & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -n \"$(git status --porcelain)\" ]; then echo 'Owner-host source checkout has local changes; refusing update.' >&2; exit 3; fi; git fetch origin main; git checkout main; git reset --hard origin/main; bash izakhono-owned-cloud/activate-tailscale-funnel.sh"
  return $LASTEXITCODE
}

$code=& $RunBridge
if($code -eq 20){
  Write-Host ""
  Write-Host "One-time Tailscale sign-in is required." -ForegroundColor Yellow
  Write-Host "Use the secure URL shown by Tailscale. Do not paste any auth key or code into ChatGPT." -ForegroundColor Yellow
  & wsl.exe -d Ubuntu-24.04 -u root -- tailscale up
  if($LASTEXITCODE -ne 0){ throw "Tailscale sign-in did not complete." }
  $code=& $RunBridge
}
if($code -eq 21){
  Write-Host "Tailscale requires one-time Funnel approval for this tailnet. Approve it using the URL/instructions above, then run this launcher again." -ForegroundColor Yellow
  exit 21
}
if($code -eq 22){
  Write-Host "Tailscale Funnel is configured, but public Growth OS health has not verified yet." -ForegroundColor Yellow
  exit 22
}
if($code -ne 0){ throw "IZAKHONO Tailscale bridge failed (code $code)." }

$ReceiptRaw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/tailscale-funnel-growth-os.json") -join "`n"
$Receipt=$ReceiptRaw | ConvertFrom-Json
if($Receipt.public_ready -ne $true){ throw "Tailscale receipt did not prove public readiness." }

Write-Host ""
Write-Host "IZAKHONO EXTERNAL BRIDGE: LIVE AND VERIFIED" -ForegroundColor Green
Write-Host "Public URL: https://$($Receipt.hostname)" -ForegroundColor Green
Start-Process "https://$($Receipt.hostname)"
