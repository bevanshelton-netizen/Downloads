#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Model = "qwen2.5:3b",
  [string]$Hostname = "one.domains.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Is-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-RemoteIzakhonoScript {
  param(
    [Parameter(Mandatory=$true)][string]$RemotePath,
    [Parameter(Mandatory=$true)][string]$LocalPath
  )
  $url = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/$RemotePath"
  Invoke-WebRequest -UseBasicParsing $url -OutFile $LocalPath
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $LocalPath
  if ($LASTEXITCODE -ne 0) {
    throw "$RemotePath failed with exit code $LASTEXITCODE"
  }
}

if (-not (Is-Admin)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$state = Join-Path $env:ProgramData "IZAKHONO\ONE-OWNED-LAUNCH"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$desktop = [Environment]::GetFolderPath("Desktop")
$summaryPath = Join-Path $desktop "IZAKHONO-ONE-OWNED-LAUNCH-STATUS.txt"

Write-Host ""
Write-Host "IZAKHONO ONE — OWNED LAUNCH" -ForegroundColor Cyan
Write-Host "Target: $Hostname" -ForegroundColor Cyan
Write-Host "Model:  $Model" -ForegroundColor Cyan
Write-Host "External resilience route: PRESERVED / NOT MODIFIED" -ForegroundColor Green
Write-Host ""

$needsOwnerHost = $false
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  $needsOwnerHost = $true
} else {
  $distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
  if ($distros -notmatch "Ubuntu-24.04") { $needsOwnerHost = $true }
}

if ($needsOwnerHost) {
  Write-Host "Owner host core is not complete. Running the canonical bootstrap..." -ForegroundColor Yellow
  $bootstrap = Join-Path $state "START-IZAKHONO-OWNER-HOST.ps1"
  $url = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1"
  Invoke-WebRequest -UseBasicParsing $url -OutFile $bootstrap
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bootstrap
  $bootstrapExit = $LASTEXITCODE
  if ($bootstrapExit -eq 20) {
    @(
      "IZAKHONO ONE — OWNED LAUNCH"
      "Result: WINDOWS RESTART REQUIRED"
      "Target: $Hostname"
      "Next machine action: restart Windows, then run START-IZAKHONO-ONE-OWNED-LAUNCH.cmd again."
      "External resilience: preserved"
    ) | Set-Content -Path $summaryPath -Encoding UTF8
    Write-Host "Windows must restart before WSL/Ubuntu can finish. Run the same launcher again after restart." -ForegroundColor Yellow
    exit 20
  }
  if ($bootstrapExit -ne 0) { throw "Owner-host bootstrap failed with exit code $bootstrapExit" }
}

$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 is still unavailable after owner-host bootstrap."
}

Write-Host "Installing or refreshing the allow-listed IZAKHONO Owner Agent..." -ForegroundColor Cyan
$agent = Join-Path $state "INSTALL-IZAKHONO-OWNER-AGENT.ps1"
Invoke-RemoteIzakhonoScript -RemotePath "owner-host/INSTALL-IZAKHONO-OWNER-AGENT.ps1" -LocalPath $agent

Write-Host "Activating the owned ONE AI model/runtime..." -ForegroundColor Cyan
$modelScript = Join-Path $state "START-IZAKHONO-ONE-AI-LOCAL-MODEL.ps1"
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-AI-LOCAL-MODEL.ps1" -OutFile $modelScript
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $modelScript -Model $Model -Hostname $Hostname
if ($LASTEXITCODE -ne 0) { throw "ONE local-model/runtime activation failed with exit code $LASTEXITCODE" }

Write-Host "Running the authoritative ONE deployment-readiness preflight..." -ForegroundColor Cyan
$readinessScript = Join-Path $state "START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1"
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1" -OutFile $readinessScript
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $readinessScript -Hostname $Hostname
if ($LASTEXITCODE -ne 0) { throw "ONE readiness preflight failed with exit code $LASTEXITCODE" }

$readinessPath = Join-Path $desktop "IZAKHONO-ONE-DEPLOYMENT-READINESS.json"
if (-not (Test-Path $readinessPath)) { throw "Readiness receipt was not copied to the Desktop." }
$readiness = Get-Content $readinessPath -Raw | ConvertFrom-Json

$ownerAgentStateRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-owner-agent/state.json 2>/dev/null || true") -join [Environment]::NewLine
$ownerAgentState = $null
if ($ownerAgentStateRaw.Trim()) {
  try { $ownerAgentState = $ownerAgentStateRaw | ConvertFrom-Json } catch {}
}

$releaseClass = "OWNED ROUTE NOT READY"
if ($readiness.readiness.public_pilot_ready -eq $true) {
  $releaseClass = "OWNED PUBLIC PILOT READY"
}
if ($readiness.readiness.commercial_ready -eq $true -and $readiness.readiness.public_pilot_ready -eq $true) {
  $releaseClass = "OWNED COMMERCIAL READY"
}

$lines = @(
  "IZAKHONO ONE — OWNED LAUNCH STATUS"
  "Generated: $(Get-Date -Format o)"
  "Hostname: $Hostname"
  "Model: $Model"
  "Release class: $releaseClass"
  "Overall readiness: $($readiness.overall)"
  "Technical runtime ready: $($readiness.readiness.technical_runtime_ready)"
  "Public pilot ready: $($readiness.readiness.public_pilot_ready)"
  "Commercial ready: $($readiness.readiness.commercial_ready)"
  "External resilience route: PRESERVED / VERIFIED INDEPENDENTLY"
)

if ($ownerAgentState) {
  $lines += "Owner Agent request: $($ownerAgentState.request_id)"
  $lines += "Owner Agent status: $($ownerAgentState.status)"
  $lines += "Owner Agent source commit: $($ownerAgentState.source_commit)"
}

if ($readiness.blockers.Count -gt 0) {
  $lines += "Blockers: $($readiness.blockers -join ', ')"
} else {
  $lines += "Blockers: none reported by readiness preflight"
}

$lines += ""
$lines += "Rule: do not call the owned route VERIFIED LIVE until independent public HTTPS verification confirms the intended ONE release."
$lines | Set-Content -Path $summaryPath -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
if ($readiness.readiness.public_pilot_ready -eq $true) {
  Write-Host $releaseClass -ForegroundColor Green
} else {
  Write-Host $releaseClass -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host "Technical runtime ready: $($readiness.readiness.technical_runtime_ready)" -ForegroundColor Cyan
Write-Host "Public pilot ready:      $($readiness.readiness.public_pilot_ready)" -ForegroundColor Cyan
Write-Host "Commercial ready:        $($readiness.readiness.commercial_ready)" -ForegroundColor Cyan

if ($readiness.blockers.Count -gt 0) {
  Write-Host "Blockers: $($readiness.blockers -join ', ')" -ForegroundColor Yellow
}

Write-Host "Desktop status: $summaryPath" -ForegroundColor Green
Write-Host "External resilience remains untouched." -ForegroundColor Green
