#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-Admin {
    $id=[Security.Principal.WindowsIdentity]::GetCurrent()
    $p=New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if(-not (Test-Admin)){
    Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"')
    exit 0
}

$Zip=Join-Path $PSScriptRoot 'IZAKHONO-CLOUD-EDGE-v1.6-HARDENED.zip'
if(-not (Test-Path $Zip)){ throw "Missing bundle: $Zip" }
$AcmeEmail=Read-Host 'ACME contact email for the TEST edge zone (entered locally only)'
if($AcmeEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$'){ throw 'Enter a valid email address.' }

if(-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)){ throw 'Windows Subsystem for Linux is not installed.' }
$distros=(& wsl.exe --list --quiet 2>$null) -join "`n"
if($distros -notmatch 'Ubuntu-24.04'){
    Write-Host 'Installing Ubuntu 24.04 for NODE01...' -ForegroundColor Yellow
    & wsl.exe --install -d Ubuntu-24.04 --no-launch
    Write-Host 'Windows may require a restart. After restarting, run this same launcher again.' -ForegroundColor Yellow
    exit 20
}

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
& wsl.exe --shutdown
Start-Sleep -Seconds 3
$ZipWsl=(& wsl.exe -d Ubuntu-24.04 -u root -- wslpath -a $Zip).Trim()
if(-not $ZipWsl){ throw 'Could not map the v1.6 bundle into WSL.' }

$Linux='set -euo pipefail; export DEBIAN_FRONTEND=noninteractive; apt-get update >/dev/null; apt-get install -y unzip ca-certificates curl python3 openssl dnsutils docker.io docker-compose-v2 >/dev/null; systemctl enable --now docker >/dev/null 2>&1 || true; rm -rf /opt/izakhono-v16-owner-proof; mkdir -p /opt/izakhono-v16-owner-proof; unzip -q "$KIT_ZIP" -d /opt/izakhono-v16-owner-proof; cd /opt/izakhono-v16-owner-proof/izakhono-cloud-v1.6-ha-edge; ACME_EMAIL_INPUT="$ACME_EMAIL_INPUT" IZAKHONO_TEST_ZONE=edge-test.izakhonoafrica.co.za bash START-V16-PRIMARY.sh'
& wsl.exe -d Ubuntu-24.04 -u root -- env "KIT_ZIP=$ZipWsl" "ACME_EMAIL_INPUT=$AcmeEmail" bash -lc $Linux
if($LASTEXITCODE -ne 0){ throw "NODE01 v1.6 primary activation failed with code $LASTEXITCODE." }

$Report=(& wsl.exe -d Ubuntu-24.04 -u root -- cat /var/lib/izakhono-deploy/V16-PRIMARY-REPORT.txt) -join "`n"
$Desktop=[Environment]::GetFolderPath('Desktop')
if(-not $Desktop){$Desktop=$env:ProgramData}
$Out=Join-Path $Desktop 'IZAKHONO-V16-PRIMARY-REPORT.txt'
$Report | Set-Content -Path $Out -Encoding UTF8
Write-Host ''
Write-Host 'NODE01 v1.6 PRIMARY LOCAL PROOF: PASS' -ForegroundColor Green
Write-Host 'Production DNS delegation remains LOCKED.' -ForegroundColor Yellow
Write-Host "Report: $Out" -ForegroundColor Cyan
Start-Process notepad.exe $Out
