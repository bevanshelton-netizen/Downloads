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

$state = Join-Path $env:ProgramData "IZAKHONO\NODE01-BOOT-WAKE"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$wakePath = Join-Path $state "NODE01-BOOT-WAKE.ps1"
$statusPath = Join-Path $state "NODE01-BOOT-WAKE-STATUS.txt"

@'
#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$state = Join-Path $env:ProgramData "IZAKHONO\NODE01-BOOT-WAKE"
$statusPath = Join-Path $state "NODE01-BOOT-WAKE-STATUS.txt"
$started = Get-Date
$last = ""

for ($attempt = 1; $attempt -le 18; $attempt++) {
    try {
        & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'systemctl start izakhono-node01.service >/dev/null 2>&1 || true; if [ -s /opt/izakhono-actions-runner/.service ]; then systemctl start "$(cat /opt/izakhono-actions-runner/.service)" >/dev/null 2>&1 || true; fi; cd /opt/izakhono-source/Downloads && bash owner-host/node01-autopilot.sh'
        $wakeExit = $LASTEXITCODE

        $healthRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'curl -fsS --max-time 8 http://127.0.0.1:8940/health 2>/dev/null || true') -join [Environment]::NewLine
        if ($healthRaw.Trim()) {
            $health = $healthRaw | ConvertFrom-Json
            if ($health.ok -eq $true -and
                $health.service -eq "izakhono-node01" -and
                $health.authority -eq "IZAKHONO" -and
                $health.execution_class -eq "IZAKHONO_SOVEREIGN_NODE" -and
                $health.external_runtime_dependency -eq $false -and
                $health.public_live_claim -eq $false) {

                $runner = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc 'if [ -s /opt/izakhono-actions-runner/.service ] && systemctl is-active --quiet "$(cat /opt/izakhono-actions-runner/.service)"; then echo ACTIVE; else echo INACTIVE_OR_UNREGISTERED; fi') -join ""
                @(
                    "IZAKHONO NODE01 BOOT WAKE"
                    "Started: $($started.ToString('o'))"
                    "Verified: $((Get-Date).ToString('o'))"
                    "Attempt: $attempt"
                    "Wake exit: $wakeExit"
                    "NODE01: VERIFIED"
                    "Node instance: $($health.node_instance)"
                    "Authority: $($health.authority)"
                    "Execution class: $($health.execution_class)"
                    "Runner: $runner"
                    "Autopilot: INVOKED"
                    "Public live claim: false"
                    "External runtime dependency: false"
                ) | Set-Content -Path $statusPath -Encoding UTF8
                exit 0
            }
            $last = "NODE01 health contract did not pass."
        } else {
            $last = "NODE01 local health unavailable."
        }
    } catch {
        $last = $_.Exception.Message
    }
    Start-Sleep -Seconds 10
}

@(
    "IZAKHONO NODE01 BOOT WAKE"
    "Started: $($started.ToString('o'))"
    "Finished: $((Get-Date).ToString('o'))"
    "Result: FAILED_TO_VERIFY_NODE01"
    "Last error: $last"
    "Public DNS changed: false"
    "Payment routing changed: false"
) | Set-Content -Path $statusPath -Encoding UTF8
exit 20
'@ | Set-Content -Path $wakePath -Encoding UTF8

$taskName = "IZAKHONO NODE01 Boot Wake"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $wakePath + '"')
$atStartup = New-ScheduledTaskTrigger -AtStartup
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType S4U -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 6 -RestartInterval (New-TimeSpan -Minutes 1)

$mode = "S4U_AT_STARTUP"
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $atStartup -Principal $principal -Settings $settings -Force | Out-Null
} catch {
    $mode = "INTERACTIVE_LOGON_FALLBACK"
    $atLogon = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $fallbackPrincipal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $atLogon -Principal $fallbackPrincipal -Settings $settings -Force | Out-Null
}

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

@(
    "IZAKHONO NODE01 BOOT WAKE INSTALLER"
    "Generated: $(Get-Date -Format o)"
    "Task: $taskName"
    "Mode: $mode"
    "User context: $currentUser"
    "Wake script: $wakePath"
    "No GitHub runner token stored by this task: true"
    "Public DNS mutation: false"
    "Payment routing mutation: false"
) | Set-Content -Path (Join-Path $state "INSTALL-STATUS.txt") -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO NODE01 BOOT WAKE: INSTALLED" -ForegroundColor Green
Write-Host "Mode: $mode" -ForegroundColor Cyan
if ($mode -eq "INTERACTIVE_LOGON_FALLBACK") {
    Write-Host "This Windows account could not register S4U startup execution; logon fallback is active." -ForegroundColor Yellow
} else {
    Write-Host "NODE01 can wake under the owning Windows account at machine startup without interactive logon." -ForegroundColor Green
}
Write-Host "No GitHub runner token is stored in the boot task." -ForegroundColor Green
Write-Host "Status: $statusPath" -ForegroundColor Cyan
