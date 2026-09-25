#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Is-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Is-Admin)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$desktop = [Environment]::GetFolderPath("Desktop")
$statusPath = Join-Path $desktop "IZAKHONO-NODE01-GITHUB-RUNNER-STATUS.txt"

Write-Host ""
Write-Host "IZAKHONO NODE01 — GITHUB RUNNER BOOTSTRAP" -ForegroundColor Cyan
Write-Host "Authority: NODE01" -ForegroundColor Cyan
Write-Host "External resilience: unchanged" -ForegroundColor Green
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$gh = Get-Command gh.exe -ErrorAction SilentlyContinue
if (-not $gh) {
  $candidate = Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"
  if (Test-Path $candidate) { $gh = Get-Item $candidate }
}
if (-not $gh -and (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
  Write-Host "Installing GitHub CLI..." -ForegroundColor Yellow
  & winget.exe install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements
  $candidate = Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"
  if (Test-Path $candidate) { $gh = Get-Item $candidate }
}
if (-not $gh) {
  throw "GitHub CLI is unavailable. Install GitHub CLI, then run this launcher again."
}
$ghPath = $gh.Source
if (-not $ghPath) { $ghPath = $gh.FullName }

& $ghPath auth status --hostname github.com *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "GitHub sign-in is required once to register NODE01." -ForegroundColor Yellow
  & $ghPath auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { throw "GitHub authentication did not complete." }
}

Write-Host "Refreshing owner-host source from canonical main..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && test -z \"$(git status --porcelain)\" && git fetch origin main && git checkout -q main && git reset --hard -q origin/main"
if ($LASTEXITCODE -ne 0) {
  throw "Owner-host source could not be refreshed safely. Local changes may be present."
}

Write-Host "Requesting a short-lived runner registration token..." -ForegroundColor Cyan
$runnerToken = (& $ghPath api --method POST repos/bevanshelton-netizen/Downloads/actions/runners/registration-token --jq .token) -join ""
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($runnerToken)) {
  @(
    "IZAKHONO NODE01 GITHUB RUNNER"
    "Result: REGISTRATION TOKEN REQUEST FAILED"
    "GitHub authentication succeeded, but the account/token lacks permission to register a repository runner."
    "No runner token was stored."
  ) | Set-Content -Path $statusPath -Encoding UTF8
  throw "Could not obtain a GitHub runner registration token. Repository administration permission is required."
}

Write-Host "Installing or refreshing the NODE01 runner service..." -ForegroundColor Cyan
$runnerToken | & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && bash owner-host/install-github-actions-runner.sh --token-stdin"
$runnerExit = $LASTEXITCODE
$runnerToken = $null
[GC]::Collect()

if ($runnerExit -ne 0) {
  throw "NODE01 runner installation failed with exit code $runnerExit."
}

$receiptRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/github-actions-runner.json 2>/dev/null || true") -join [Environment]::NewLine
if (-not $receiptRaw.Trim()) { throw "NODE01 runner receipt is missing." }
$receipt = $receiptRaw | ConvertFrom-Json
if ($receipt.state -ne "ACTIVE" -or $receipt.authority -ne "NODE01" -or $receipt.token_persisted -ne $false) {
  throw "NODE01 runner receipt did not pass the security contract."
}

$keepaliveDir = Join-Path $env:ProgramData "IZAKHONO\NODE01-RUNNER"
New-Item -ItemType Directory -Path $keepaliveDir -Force | Out-Null
$keepaliveCmd = Join-Path $keepaliveDir "NODE01-RUNNER-KEEPALIVE.cmd"
@'
@echo off
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "if [ -s /opt/izakhono-actions-runner/.service ]; then systemctl start $(cat /opt/izakhono-actions-runner/.service); fi"
exit /b 0
'@ | Set-Content -Path $keepaliveCmd -Encoding ASCII

$taskName = "IZAKHONO NODE01 Runner Keepalive"
$taskAction = New-ScheduledTaskAction -Execute $keepaliveCmd
$atLogon = New-ScheduledTaskTrigger -AtLogOn
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger @($atLogon,$repeat) -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

@(
  "IZAKHONO NODE01 GITHUB RUNNER"
  "Generated: $(Get-Date -Format o)"
  "Result: ACTIVE"
  "Runner: $($receipt.runner_name)"
  "Labels: $($receipt.labels -join ', ')"
  "Service: $($receipt.service)"
  "Authority: $($receipt.authority)"
  "Runner token persisted: $($receipt.token_persisted)"
  "External compute authority: $($receipt.external_compute_authority)"
  ""
  "Queued ONE activation:"
  "https://github.com/bevanshelton-netizen/Downloads/actions/runs/36086639646"
  ""
  "Keepalive task: IZAKHONO NODE01 Runner Keepalive"
  "The runner service now remains available for allow-listed IZAKHONO deployment workflows."
) | Set-Content -Path $statusPath -Encoding UTF8

Write-Host ""
Write-Host "NODE01 RUNNER: ACTIVE" -ForegroundColor Green
Write-Host "The queued IZAKHONO ONE activation can now be accepted by NODE01." -ForegroundColor Green
Write-Host "Status: $statusPath" -ForegroundColor Cyan
