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
$edgeReceiptPath = Join-Path $desktop "IZAKHONO-ONE-OWNED-EDGE.json"
$dnsHandoffPath = Join-Path $desktop "IZAKHONO-PARENT-DNS-HANDOFF.txt"

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

$controlRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /opt/izakhono-source/Downloads/owner-host/control/one-desired-state.json") -join [Environment]::NewLine
if (-not $controlRaw.Trim()) { throw "Owner Agent control document is unavailable." }
try { $control = $controlRaw | ConvertFrom-Json } catch { throw "Owner Agent control document is invalid JSON." }
if ($control.enabled -ne $true -or $control.action -ne "activate-one-local-model") {
  throw "Current Owner Agent request is not an enabled ONE local-model activation."
}
$expectedRequestId = [string]$control.id
if ([string]::IsNullOrWhiteSpace($expectedRequestId)) { throw "Owner Agent request ID is missing." }

Write-Host "Requesting approved ONE activation: $expectedRequestId" -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && IZAKHONO_OWNER_CONTROL_PATH=owner-host/control/one-desired-state.json IZAKHONO_OWNER_AGENT_STATE_FILE=/var/lib/izakhono-owner-agent/one-state.json bash owner-host/owner-agent.sh"
if ($LASTEXITCODE -ne 0) { throw "Owner Agent invocation failed with exit code $LASTEXITCODE" }

$ownerAgentState = $null
for ($i = 0; $i -lt 360; $i++) {
  $raw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-owner-agent/one-state.json 2>/dev/null || true") -join [Environment]::NewLine
  if ($raw.Trim()) {
    try { $ownerAgentState = $raw | ConvertFrom-Json } catch { $ownerAgentState = $null }
  }
  if ($ownerAgentState -and $ownerAgentState.request_id -eq $expectedRequestId) {
    if ($ownerAgentState.status -eq "success") { break }
    if ($ownerAgentState.status -eq "blocked-dirty-source") { throw "Owner Agent blocked because the owner-host source checkout has local changes." }
    if ($ownerAgentState.status -eq "failed" -and [int]$ownerAgentState.attempts -ge 2) {
      throw "Owner Agent exhausted the approved activation attempts. Inspect $($ownerAgentState.log_path)."
    }
  }
  Start-Sleep -Seconds 5
}

if (-not $ownerAgentState -or $ownerAgentState.request_id -ne $expectedRequestId -or $ownerAgentState.status -ne "success") {
  throw "Owner Agent did not produce a successful ONE activation receipt."
}

Write-Host "Owner Agent activation receipt: SUCCESS" -ForegroundColor Green

Write-Host "Activating/staging owned DNS, TLS and EDGE for ONE..." -ForegroundColor Cyan
$escapedHost = $Hostname.Replace("'","''")
$edgeLinux = @"
set +e
cd /opt/izakhono-source/Downloads
export IZAKHONO_PUBLIC_HOSTNAME='$escapedHost'
export IZAKHONO_PUBLIC_ZONE='domains.izakhonoafrica.co.za'
export IZAKHONO_PUBLIC_EXTRA_HOSTS='$escapedHost'
bash izakhono-owned-cloud/activate-owned-public-edge.sh
rc=$?
exit $rc
"@
$edgeLinux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$edgeExit = $LASTEXITCODE
if ($edgeExit -notin @(0,20,21)) {
  throw "Owned DNS/TLS/EDGE activation failed unexpectedly with exit code $edgeExit."
}

$edgeRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/owned-public-edge.json 2>/dev/null || true") -join [Environment]::NewLine
$edgeState = $null
if ($edgeRaw.Trim()) {
  $edgeRaw | Set-Content -Path $edgeReceiptPath -Encoding UTF8
  try { $edgeState = $edgeRaw | ConvertFrom-Json } catch { $edgeState = $null }
}
$handoffRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/IZAKHONO-PARENT-DNS-HANDOFF.txt 2>/dev/null || true") -join [Environment]::NewLine
if ($handoffRaw.Trim()) {
  $handoffRaw | Set-Content -Path $dnsHandoffPath -Encoding UTF8
}
$edgeAction = switch ($edgeExit) {
  0 { "OWNED EDGE LOCALLY PROVED" }
  20 { "PARENT DNS / ROUTER ACTION REQUIRED" }
  21 { "TLS / PORTS ACTION REQUIRED" }
  default { "OWNED EDGE STATUS UNKNOWN" }
}
Write-Host "Owned EDGE result: $edgeAction" -ForegroundColor $(if($edgeExit -eq 0){"Green"}else{"Yellow"})

Write-Host "Running the authoritative ONE deployment-readiness preflight..." -ForegroundColor Cyan
$readinessScript = Join-Path $state "START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1"
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1" -OutFile $readinessScript
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $readinessScript -Hostname $Hostname
if ($LASTEXITCODE -ne 0) { throw "ONE readiness preflight failed with exit code $LASTEXITCODE" }

$readinessPath = Join-Path $desktop "IZAKHONO-ONE-DEPLOYMENT-READINESS.json"
if (-not (Test-Path $readinessPath)) { throw "Readiness receipt was not copied to the Desktop." }
$readiness = Get-Content $readinessPath -Raw | ConvertFrom-Json

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

$lines += "Owned EDGE action: $edgeAction"
if ($edgeState) {
  $lines += "Owned public IPv4: $($edgeState.public_ipv4)"
  $lines += "Parent delegation observed: $($edgeState.parent_delegation_observed)"
  $lines += "Hostname resolves to owner IP: $($edgeState.hostname_resolves_to_owner_ip)"
  $lines += "TLS ready: $($edgeState.tls_ready)"
  $lines += "EDGE direct: $($edgeState.edge_direct)"
  if ($edgeState.required_inbound_ports) {
    $lines += "Required inbound ports: $($edgeState.required_inbound_ports -join ', ')"
  }
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
if (Test-Path $edgeReceiptPath) {
  Write-Host "Desktop EDGE/DNS receipt: $edgeReceiptPath" -ForegroundColor Green
}
if (Test-Path $dnsHandoffPath) {
  Write-Host "Desktop parent DNS handoff: $dnsHandoffPath" -ForegroundColor Green
}
Write-Host "External resilience remains untouched." -ForegroundColor Green
