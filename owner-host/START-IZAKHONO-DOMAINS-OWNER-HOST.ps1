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
$OwnerBootstrap = Join-Path $State "START-IZAKHONO-OWNER-HOST.ps1"
$OwnerBootstrapUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1"
$DomainsDeployUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-owned-cloud/deploy-izakhono-domains.sh"

Write-Host ""
Write-Host "IZAKHONO DOMAINS — ONE-CLICK OWNER HOST CUTOVER" -ForegroundColor Cyan

$needsBootstrap = $true
if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
    $distros = (& wsl.exe --list --quiet 2>$null) -join "
"
    if ($distros -match "Ubuntu-24.04") {
        & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "test -d /opt/izakhono-source/Downloads && test -f /etc/izakhono/runtime-node.env && test -f /etc/izakhono/code-node.env"
        if ($LASTEXITCODE -eq 0) { $needsBootstrap = $false }
    }
}

if ($needsBootstrap) {
    Write-Host "Owner-host core is not complete. Bootstrapping ISN-01 first..." -ForegroundColor Yellow
    Invoke-WebRequest -UseBasicParsing $OwnerBootstrapUrl -OutFile $OwnerBootstrap
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $OwnerBootstrap
    if ($LASTEXITCODE -ne 0) {
        throw "IZAKHONO owner-host bootstrap did not complete. A Windows restart may be required if WSL was just installed."
    }
}

Write-Host "Refreshing owner-host source..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -n \"$(git status --porcelain)\" ]; then echo 'Owner-host source checkout has local changes; refusing to overwrite.' >&2; exit 3; fi; git fetch origin main; git checkout main; git reset --hard origin/main"
if ($LASTEXITCODE -ne 0) { throw "Could not refresh the owner-host source checkout." }

Write-Host "Deploying IZAKHONO DOMAINS through IZAKHONO CODE -> RUNTIME -> EDGE/FORTRESS..." -ForegroundColor Cyan
$deploy = (Invoke-WebRequest -UseBasicParsing $DomainsDeployUrl).Content
$deploy | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { throw "IZAKHONO DOMAINS owner-host deployment failed." }

Write-Host "Verifying local RUNTIME route..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS -H 'Host: domains.izakhonoafrica.co.za' http://127.0.0.1:8080/health | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const x=JSON.parse(s);if(x.ok!==true||x.service!==\"IZAKHONO DOMAINS\")process.exit(2)})'"
if ($LASTEXITCODE -ne 0) { throw "IZAKHONO DOMAINS local runtime health verification failed." }

Write-Host ""
Write-Host "OWNER-HOST DEPLOYMENT: VERIFIED" -ForegroundColor Green
Write-Host "Target: https://domains.izakhonoafrica.co.za" -ForegroundColor Green

try {
    $public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://domains.izakhonoafrica.co.za/health"
    $health = $public.Content | ConvertFrom-Json
    if ($health.ok -eq $true -and $health.service -eq "IZAKHONO DOMAINS") {
        Write-Host "PUBLIC CUTOVER: LIVE AND VERIFIED" -ForegroundColor Green
        Start-Process "https://domains.izakhonoafrica.co.za"
        exit 0
    }
} catch {
    Write-Host "PUBLIC CUTOVER: hostname is not routed to the owner tunnel yet." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "ONE EXTERNAL MAPPING REMAINS:" -ForegroundColor Yellow
Write-Host "Cloudflare Tunnel public hostname: domains.izakhonoafrica.co.za" -ForegroundColor Yellow
Write-Host "Service/origin: http://127.0.0.1:8780" -ForegroundColor Yellow
Write-Host "After adding that mapping, rerun this same launcher; it will verify and open the live site." -ForegroundColor Yellow
