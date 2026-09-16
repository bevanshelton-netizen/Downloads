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

$State = Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
New-Item -ItemType Directory -Path $State -Force | Out-Null
$Bootstrap = Join-Path $State "bootstrap-linux.sh"
$Raw = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/bootstrap-linux.sh"

Write-Host ""
Write-Host "IZAKHONO ACCESSIBLE OWNER HOST" -ForegroundColor Cyan
Write-Host "Preparing ISN-01 as the owner-controlled platform host..." -ForegroundColor Cyan

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Windows Subsystem for Linux..." -ForegroundColor Yellow
    & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
    & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null
}

$distros = (& wsl.exe --list --quiet 2>$null) -join "
"
if ($distros -notmatch "Ubuntu-24.04") {
    Write-Host "Installing Ubuntu 24.04 for the IZAKHONO owner host..." -ForegroundColor Yellow
    & wsl.exe --install -d Ubuntu-24.04 --no-launch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Windows may require a restart before Ubuntu can finish installing." -ForegroundColor Yellow
        Write-Host "After restarting, run START-IZAKHONO-OWNER-HOST.cmd again." -ForegroundColor Yellow
        exit 20
    }
}

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
if ($LASTEXITCODE -ne 0) { throw "Could not enable systemd in Ubuntu." }

& wsl.exe --shutdown
Start-Sleep -Seconds 3
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "systemctl is-system-running --wait >/dev/null 2>&1 || true"
if ($LASTEXITCODE -ne 0) { throw "Ubuntu did not start correctly." }

Invoke-WebRequest -UseBasicParsing $Raw -OutFile $Bootstrap
$payload = Get-Content $Bootstrap -Raw
$payload | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { throw "IZAKHONO owner-host bootstrap failed inside Ubuntu." }

Write-Host ""
Write-Host "OWNER HOST CORE: INSTALLED" -ForegroundColor Green
Write-Host "Checking host status..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && bash owner-host/status.sh"

Write-Host ""
Write-Host "If PUBLIC TUNNEL is INACTIVE, the only remaining public-ingress input is the Cloudflare Tunnel token." -ForegroundColor Yellow
Write-Host "The host itself and all private IZAKHONO services are installed independently of Vercel." -ForegroundColor Green
