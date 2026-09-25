#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Is-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-RemoteFile {
  param([string]$RemotePath,[string]$LocalPath)
  $url = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/$RemotePath"
  Invoke-WebRequest -UseBasicParsing $url -OutFile $LocalPath
}

if (-not (Is-Admin)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$desktop = [Environment]::GetFolderPath("Desktop")
$state = Join-Path $env:ProgramData "IZAKHONO\ONE-R0-OWNED"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$statusPath = Join-Path $desktop "IZAKHONO-ONE-R0-OWNED-STATUS.txt"
$bridgeReceiptPath = Join-Path $desktop "IZAKHONO-ONE-R0-PUBLIC-BRIDGE.json"

Write-Host ""
Write-Host "IZAKHONO ONE - R0 OWNED LAUNCH" -ForegroundColor Cyan
Write-Host "Budget: R0" -ForegroundColor Cyan
Write-Host "Authority: IZAKHONO sovereign runtime / NODE01 equivalent" -ForegroundColor Cyan
Write-Host "Transport: outbound HTTPS bridge only" -ForegroundColor Cyan
Write-Host "External resilience: PRESERVED" -ForegroundColor Green
Write-Host ""

$ownerBootstrap = Join-Path $state "START-IZAKHONO-OWNER-HOST.ps1"
$needsBootstrap = $false
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  $needsBootstrap = $true
} else {
  $distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
  if ($distros -notmatch "Ubuntu-24.04") { $needsBootstrap = $true }
}

if ($needsBootstrap) {
  Get-RemoteFile "owner-host/START-IZAKHONO-OWNER-HOST.ps1" $ownerBootstrap
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ownerBootstrap
  $bootstrapExit = $LASTEXITCODE
  if ($bootstrapExit -eq 20) {
    @(
      "IZAKHONO ONE - R0 OWNED LAUNCH"
      "State: WINDOWS RESTART REQUIRED"
      "Next machine action: restart Windows and run START-IZAKHONO-ONE-R0-OWNED-LAUNCH.cmd again."
      "External resilience preserved: true"
    ) | Set-Content -Path $statusPath -Encoding UTF8
    exit 20
  }
  if ($bootstrapExit -ne 0) { throw "Owner-host bootstrap failed with exit code $bootstrapExit." }
}

$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") { throw "Ubuntu-24.04 owner host is unavailable." }

Write-Host "Refreshing allow-listed IZAKHONO Owner Agent..." -ForegroundColor Cyan
$agentInstaller = Join-Path $state "INSTALL-IZAKHONO-OWNER-AGENT.ps1"
Get-RemoteFile "owner-host/INSTALL-IZAKHONO-OWNER-AGENT.ps1" $agentInstaller
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agentInstaller
if ($LASTEXITCODE -ne 0) { throw "Owner Agent installation failed with exit code $LASTEXITCODE." }

Write-Host "Activating IZAKHONO ONE local model and owned runtime in R0 mode..." -ForegroundColor Cyan
$linux = @'
set -euo pipefail
cd /opt/izakhono-source/Downloads
git fetch origin main
if [ -n "$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing activation." >&2
  exit 3
fi
git checkout -q main
git reset --hard -q origin/main
node - <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync("owner-host/control/one-desired-state.json","utf8"));
if(x.enabled!==true) throw new Error("ONE request is not enabled");
if(x.action!=="activate-one-local-model") throw new Error("ONE request action mismatch");
if(x.params?.r0_mode!==true) throw new Error("ONE request is not in R0 mode");
if(x.params?.hostname!=="one.domains.izakhonoafrica.co.za") throw new Error("ONE hostname mismatch");
if(!x.id) throw new Error("ONE request id missing");
console.log("APPROVED_REQUEST="+x.id);
NODE
IZAKHONO_OWNER_CONTROL_PATH=owner-host/control/one-desired-state.json \
IZAKHONO_OWNER_AGENT_STATE_FILE=/var/lib/izakhono-owner-agent/one-r0-state.json \
  bash owner-host/owner-agent.sh
node - <<'NODE'
const fs=require("fs");
const x=JSON.parse(fs.readFileSync("/var/lib/izakhono-owner-agent/one-r0-state.json","utf8"));
if(x.status!=="success") throw new Error("Owner Agent status: "+x.status);
console.log("OWNER_AGENT_STATUS=success");
console.log("OWNER_AGENT_SOURCE_COMMIT="+String(x.source_commit||""));
NODE
curl -fsS --max-time 8 -H 'Host: one.domains.izakhonoafrica.co.za' http://127.0.0.1:8080/health >/tmp/one-r0-local-health.json
node - <<'NODE'
const x=require("/tmp/one-r0-local-health.json");
const required={product:"IZAKHONO ONE AI",status:"healthy",tracking:false,promptPersistence:false,chatReady:true,accountReachable:true};
for(const [k,v] of Object.entries(required)) if(x[k]!==v) throw new Error(k+" mismatch");
console.log("OWNED_LOCAL_RUNTIME=VERIFIED");
NODE
'@
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "IZAKHONO ONE R0 owned runtime activation failed with exit code $LASTEXITCODE."
}

Write-Host "Completing the outbound R0 public bridge..." -ForegroundColor Cyan
$bridge = Join-Path $state "START-IZAKHONO-ONE-R0-BRIDGE.ps1"
Get-RemoteFile "owner-host/START-IZAKHONO-ONE-R0-BRIDGE.ps1" $bridge
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bridge
$bridgeExit = $LASTEXITCODE
if ($bridgeExit -ne 0) {
  @(
    "IZAKHONO ONE - R0 OWNED LAUNCH"
    "State: BRIDGE NOT YET VERIFIED"
    "Bridge exit: $bridgeExit"
    "Owned local runtime: verified"
    "External resilience preserved: true"
    "Rule: no owned-live claim until the public bridge passes independent HTTPS health verification."
  ) | Set-Content -Path $statusPath -Encoding UTF8
  exit $bridgeExit
}

$raw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/tailscale-funnel-izakhono-one-ai.json") -join [Environment]::NewLine
if (-not $raw.Trim()) { throw "R0 public bridge receipt is missing." }
$receipt = $raw | ConvertFrom-Json
if ($receipt.state -ne "LIVE_VERIFIED" -or $receipt.public_ready -ne $true) {
  throw "R0 bridge receipt does not prove public readiness."
}
if ([string]::IsNullOrWhiteSpace([string]$receipt.public_url) -or -not ([string]$receipt.public_url).StartsWith("https://")) {
  throw "R0 bridge receipt has no valid HTTPS public URL."
}
$raw | Set-Content -Path $bridgeReceiptPath -Encoding UTF8

@(
  "IZAKHONO ONE - R0 OWNED LAUNCH"
  "State: R0 OWNED BRIDGE VERIFIED"
  "Public URL: $($receipt.public_url)"
  "Owned runtime authority: IZAKHONO_OWNED_RUNTIME"
  "Provider role: replaceable outbound transport"
  "Budget ZAR: 0"
  "Custom domain required: false"
  "Public IPv4 required: false"
  "Inbound port forwarding required: false"
  "External resilience preserved: true"
  "Tracking: false"
  "Rule: the branded owned hostname remains unverified until its own independent HTTPS check passes."
) | Set-Content -Path $statusPath -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO ONE R0 OWNED BRIDGE: VERIFIED" -ForegroundColor Green
Write-Host "Public URL: $($receipt.public_url)" -ForegroundColor Green
Write-Host "Status: $statusPath" -ForegroundColor Cyan
Write-Host "Receipt: $bridgeReceiptPath" -ForegroundColor Cyan
