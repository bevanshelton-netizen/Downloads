#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

$State = Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
$Bootstrap = Join-Path $State "START-IZAKHONO-OWNER-HOST.ps1"
$BootstrapUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1"

if (-not (Test-Path $State)) { New-Item -ItemType Directory -Path $State -Force | Out-Null }
Write-Host ""
Write-Host "IZAKHONO.CO.ZA - FLAGSHIP OWNER HOST" -ForegroundColor Cyan

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { Fail "WSL is not installed yet." }
$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") {
    Write-Host "Owner-host Linux is not installed. Running the IZAKHONO bootstrap..." -ForegroundColor Yellow
    Invoke-WebRequest -UseBasicParsing $BootstrapUrl -OutFile $Bootstrap
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Bootstrap
    if ($LASTEXITCODE -ne 0) { Fail "Owner-host bootstrap did not complete." }
}

Write-Host "Refreshing IZAKHONO source..." -ForegroundColor Cyan
$refresh = 'set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -n "$(git status --porcelain)" ]; then echo "Local source changes detected." >&2; exit 3; fi; git fetch origin main; git checkout main; git reset --hard origin/main'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $refresh
if ($LASTEXITCODE -ne 0) { Fail "Could not refresh source." }

Write-Host "Deploying flagship through IZAKHONO CODE -> RUNTIME -> EDGE..." -ForegroundColor Cyan
$deploy = 'cd /opt/izakhono-source/Downloads && bash izakhono-owned-cloud/deploy-izakhono-flagship.sh main'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $deploy
if ($LASTEXITCODE -ne 0) { Fail "Flagship deployment failed." }

Write-Host "Verifying local hostname route..." -ForegroundColor Cyan
$verify = 'curl -fsS -H "Host: izakhono.co.za" http://127.0.0.1:8080/health | grep -q "IZAKHONO FLAGSHIP"'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $verify
if ($LASTEXITCODE -ne 0) { Fail "Local runtime verification failed." }

Write-Host ""
Write-Host "IZAKHONO FLAGSHIP: VERIFIED ON OWNER HOST" -ForegroundColor Green

Write-Host "Checking public TLS and flagship identity..." -ForegroundColor Cyan
$publicVerify = 'cd /opt/izakhono-source/Downloads && bash izakhono-owned-cloud/verify-izakhono-public-tls.sh'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $publicVerify
if ($LASTEXITCODE -eq 0) {
    Write-Host "PUBLIC WEBSITE: LIVE AND TLS VERIFIED" -ForegroundColor Green
    Start-Process "https://izakhono.co.za"
    exit 0
}

Write-Host ""
Write-Host "Public TLS is not valid yet. Checking the existing IZAKHONO tunnel..." -ForegroundColor Yellow
$tunnelRepair = 'set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -s /etc/izakhono/cloudflare-tunnel.token ]; then bash owner-host/install-cloudflare-tunnel.sh; else exit 12; fi'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $tunnelRepair
$tunnelCode = $LASTEXITCODE

if ($tunnelCode -eq 0) {
    Start-Sleep -Seconds 4
    & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $publicVerify
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PUBLIC WEBSITE: LIVE AND TLS VERIFIED" -ForegroundColor Green
        Start-Process "https://izakhono.co.za"
        exit 0
    }
}

Write-Host ""
Write-Host "DO NOT bypass the browser security warning." -ForegroundColor Red
Write-Host "One public hostname route still needs to be set on the tunnel:" -ForegroundColor Yellow
Write-Host "  Hostname: izakhono.co.za"
Write-Host "  Service:  http://localhost:8780"
Write-Host ""
Write-Host "After that route is added, rerun START-IZAKHONO-FLAGSHIP.cmd." -ForegroundColor Yellow
Write-Host "The launcher will refuse to open the site until the certificate is valid." -ForegroundColor Yellow
exit 20
