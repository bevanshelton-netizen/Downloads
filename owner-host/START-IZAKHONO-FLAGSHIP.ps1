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
$verify = 'curl -fsS -H "Host: izakhono.co.za" http://127.0.0.1:8080/health | node -e "\'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const x=JSON.parse(s);if(x.ok!==true||x.service!==\"IZAKHONO FLAGSHIP\")process.exit(2)})\'"'
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $verify
if ($LASTEXITCODE -ne 0) { Fail "Local runtime verification failed." }

Write-Host ""
Write-Host "IZAKHONO FLAGSHIP: VERIFIED ON OWNER HOST" -ForegroundColor Green

try {
    $public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://izakhono.co.za/health"
    $health = $public.Content | ConvertFrom-Json
    if ($health.ok -eq $true -and $health.service -eq "IZAKHONO FLAGSHIP") {
        Write-Host "PUBLIC WEBSITE: LIVE" -ForegroundColor Green
        Start-Process "https://izakhono.co.za"
        exit 0
    }
} catch {}

Write-Host ""
Write-Host "PUBLIC DOMAIN ROUTE STILL REQUIRED" -ForegroundColor Yellow
Write-Host "In the active IZAKHONO Cloudflare Tunnel, add:" -ForegroundColor Yellow
Write-Host "  Hostname: izakhono.co.za"
Write-Host "  Service:  http://localhost:8780"
Write-Host "Then rerun this launcher. It will verify HTTPS before opening the site."
exit 20
