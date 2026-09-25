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

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") {
    throw "Ubuntu-24.04 is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$state = Join-Path $env:ProgramData "IZAKHONO\NODE01-AUTOPILOT"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$tick = Join-Path $state "NODE01-AUTOPILOT-TICK.cmd"
@'
@echo off
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && bash owner-host/node01-autopilot.sh"
exit /b %ERRORLEVEL%
'@ | Set-Content -Path $tick -Encoding ASCII

$taskName = "IZAKHONO NODE01 Autopilot"
$action = New-ScheduledTaskAction -Execute $tick
$atLogon = New-ScheduledTaskTrigger -AtLogOn
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($atLogon,$repeat) -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

$desktop = [Environment]::GetFolderPath("Desktop")
$statusPath = Join-Path $desktop "IZAKHONO-NODE01-AUTOPILOT-STATUS.txt"
$receiptRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/node01-autopilot.json 2>/dev/null || true") -join [Environment]::NewLine
if ($receiptRaw.Trim()) {
    $r = $receiptRaw | ConvertFrom-Json
    @(
      "IZAKHONO NODE01 AUTOPILOT"
      "Generated: $(Get-Date -Format o)"
      "Task: $taskName"
      "Interval: every 5 minutes and at Windows logon"
      "Authority: $($r.authority)"
      "Source: $($r.source_state)"
      "Owner agent: $($r.owner_agent)"
      "GitHub runner: $($r.github_runner)"
      "ONE local runtime: $($r.one_local_runtime)"
      "Owned edge: $($r.owned_edge_state)"
      "Public HTTPS: $($r.public_https)"
      "Live claim: $($r.live_claim)"
      "Independent HTTPS verification required: $($r.independent_https_verification_required)"
      "External resilience preserved: $($r.external_resilience_preserved)"
    ) | Set-Content -Path $statusPath -Encoding UTF8
} else {
    @(
      "IZAKHONO NODE01 AUTOPILOT"
      "Task installed: $taskName"
      "Initial receipt is not available yet."
      "The next five-minute tick will retry automatically."
    ) | Set-Content -Path $statusPath -Encoding UTF8
}

Write-Host ""
Write-Host "IZAKHONO NODE01 AUTOPILOT: INSTALLED" -ForegroundColor Green
Write-Host "The owner agent, registered runner, ONE local health and owned EDGE are now retried automatically." -ForegroundColor Green
Write-Host "No public-live claim is made until independent HTTPS verification passes." -ForegroundColor Yellow
Write-Host "Status: $statusPath" -ForegroundColor Cyan
