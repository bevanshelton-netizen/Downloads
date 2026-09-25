#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "IZAKHONO OWNER AGENT — INSTALL" -ForegroundColor Cyan
Write-Host "This installs an allow-listed deployment agent. It cannot execute arbitrary commands from the control document." -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "\$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing agent installation." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
bash -n owner-host/owner-agent.sh
mkdir -p /var/lib/izakhono-owner-agent/runs
chmod 700 /var/lib/izakhono-owner-agent /var/lib/izakhono-owner-agent/runs
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "Linux owner-agent preparation failed."
}

$state = Join-Path $env:ProgramData "IZAKHONO\OWNER-AGENT"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$tick = Join-Path $state "OWNER-AGENT-TICK.cmd"

@'
@echo off
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && bash owner-host/owner-agent.sh"
exit /b %ERRORLEVEL%
'@ | Set-Content -Path $tick -Encoding ASCII

$taskName = "IZAKHONO Owner Agent"
$action = New-ScheduledTaskAction -Execute $tick
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$logon = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($repeat,$logon) -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

$desktop = [Environment]::GetFolderPath("Desktop")
$statusPath = Join-Path $desktop "IZAKHONO-OWNER-AGENT-STATUS.txt"

@(
  "IZAKHONO OWNER AGENT"
  "Installed: $(Get-Date -Format o)"
  "Task: $taskName"
  "Interval: every 5 minutes while the Windows owner session can run WSL"
  "Control: canonical Downloads/main owner-host/control/desired-state.json"
  "Allowed actions: activate-one-local-model, configure-one-ai, deploy-one-ai, verify-one-ai, deploy-yhvh-gospel-tv"
  "Arbitrary command execution from the control document: DISABLED"
  ""
  "A pending allow-listed deployment request is queued in the canonical control file."
  "Machine execution is only confirmed by /var/lib/izakhono-owner-agent/state.json and deployment receipts."
) | Set-Content -Path $statusPath -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO OWNER AGENT: INSTALLED" -ForegroundColor Green
Write-Host "Task: $taskName" -ForegroundColor Green
Write-Host "Desktop status: $statusPath" -ForegroundColor Cyan
Write-Host "The first safe activation tick has been requested." -ForegroundColor Yellow
