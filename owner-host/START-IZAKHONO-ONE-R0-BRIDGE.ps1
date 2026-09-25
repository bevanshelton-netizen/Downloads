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

if(-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)){
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros=(& wsl.exe --list --quiet 2>$null) -join "`n"
if($distros -notmatch "Ubuntu-24.04"){
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$desktop=[Environment]::GetFolderPath("Desktop")
$receiptOut=Join-Path $desktop "IZAKHONO-ONE-R0-PUBLIC-BRIDGE.json"
$statusOut=Join-Path $desktop "IZAKHONO-ONE-R0-PUBLIC-BRIDGE.txt"

Write-Host ""
Write-Host "IZAKHONO ONE - R0 PUBLIC BRIDGE" -ForegroundColor Cyan
Write-Host "Authority: IZAKHONO sovereign runtime / ISN-01 equivalent" -ForegroundColor Cyan
Write-Host "Transport: outbound HTTPS bridge only" -ForegroundColor Cyan
Write-Host "Domain purchase: NOT REQUIRED" -ForegroundColor Green
Write-Host "Public IPv4: NOT REQUIRED" -ForegroundColor Green
Write-Host "Inbound router ports: NOT REQUIRED" -ForegroundColor Green
Write-Host "External resilience: PRESERVED" -ForegroundColor Green

$RunBridge = {
  $cmd = @'
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing update." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
export IZAKHONO_BRIDGE_APP="izakhono-one-ai"
export IZAKHONO_BRIDGE_HEALTH_PATH="/health"
export IZAKHONO_BRIDGE_EXPECTED_SERVICE=""
export IZAKHONO_BRIDGE_EXPECTED_PRODUCT="IZAKHONO ONE AI"
export IZAKHONO_BRIDGE_EXPECTED_STATUS="healthy"
bash izakhono-owned-cloud/activate-tailscale-funnel.sh
'@
  $cmd | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
  return $LASTEXITCODE
}

$code=& $RunBridge
if($code -eq 20){
  Write-Host ""
  Write-Host "One-time Tailscale sign-in is required." -ForegroundColor Yellow
  Write-Host "Use the secure Tailscale sign-in flow. Do not paste credentials or auth keys into ChatGPT." -ForegroundColor Yellow
  & wsl.exe -d Ubuntu-24.04 -u root -- tailscale up
  if($LASTEXITCODE -ne 0){ throw "Tailscale sign-in did not complete." }
  $code=& $RunBridge
}
if($code -eq 21){
  @(
    "IZAKHONO ONE - R0 PUBLIC BRIDGE"
    "State: FUNNEL APPROVAL REQUIRED"
    "No domain purchase is required."
    "Approve Tailscale Funnel once, then run START-IZAKHONO-ONE-R0-BRIDGE.cmd again."
    "External resilience remains active."
  ) | Set-Content -Path $statusOut -Encoding UTF8
  exit 21
}
if($code -eq 22){
  @(
    "IZAKHONO ONE - R0 PUBLIC BRIDGE"
    "State: PUBLIC HEALTH PENDING"
    "No domain purchase is required."
    "The outbound bridge is configured but ONE health has not yet passed publicly."
    "External resilience remains active."
  ) | Set-Content -Path $statusOut -Encoding UTF8
  exit 22
}
if($code -ne 0){ throw "IZAKHONO ONE R0 bridge failed (code $code)." }

$raw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/tailscale-funnel-izakhono-one-ai.json") -join "`n"
if(-not $raw.Trim()){ throw "ONE R0 bridge receipt is missing." }
$receipt=$raw | ConvertFrom-Json
if($receipt.public_ready -ne $true -or $receipt.state -ne "LIVE_VERIFIED"){
  throw "ONE R0 bridge receipt did not prove public readiness."
}
$raw | Set-Content -Path $receiptOut -Encoding UTF8

@(
  "IZAKHONO ONE - R0 PUBLIC BRIDGE"
  "State: LIVE_VERIFIED"
  "Public URL: $($receipt.public_url)"
  "Engine authority: IZAKHONO_OWNED_RUNTIME"
  "Provider role: replaceable outbound transport"
  "Domain purchase required: false"
  "Public IPv4 required: false"
  "Inbound port forwarding required: false"
  "External resilience preserved: true"
  "Rule: keep the stable GitHub Pages/Supabase front door until the R0 owned bridge is independently verified."
) | Set-Content -Path $statusOut -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO ONE R0 BRIDGE: LIVE AND VERIFIED" -ForegroundColor Green
Write-Host "Public URL: $($receipt.public_url)" -ForegroundColor Green
Write-Host "Receipt: $receiptOut" -ForegroundColor Green
Write-Host "Status: $statusOut" -ForegroundColor Green
