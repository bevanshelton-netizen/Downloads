#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$TokenFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

if ($env:OS -ne "Windows_NT") { Fail "Run this launcher on the Windows owner machine." }
if (-not (Test-Path $TokenFile)) { Fail "Tunnel token file not found: $TokenFile" }

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { Fail "WSL is not available." }

$linuxToken = "/tmp/izakhono-auto-ai-tunnel.token"
Get-Content $TokenFile -Raw | wsl.exe -d Ubuntu-24.04 -- bash -c "umask 077; cat > $linuxToken"
if ($LASTEXITCODE -ne 0) { Fail "Could not transfer the tunnel token into WSL." }

$cmd = @'
set -euo pipefail
ROOT="$HOME/izakhono-owned-bootstrap"
REPO="$ROOT/Downloads"
mkdir -p "$ROOT"

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/Downloads.git "$REPO"
else
  git -C "$REPO" fetch origin main
  git -C "$REPO" checkout main
  git -C "$REPO" reset --hard origin/main
fi

sudo bash "$REPO/izakhono-owned-cloud/deploy-auto-ai.sh" main
sudo bash "$REPO/izakhono-owned-cloud/configure-auto-ai-tunnel.sh" /tmp/izakhono-auto-ai-tunnel.token
rm -f /tmp/izakhono-auto-ai-tunnel.token
'@

$cmd | wsl.exe -d Ubuntu-24.04 -- bash
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "AUTO AI OWNED PUBLIC HOST: VERIFIED" -ForegroundColor Green
    Write-Host "https://autoai.izakhonoafrica.co.za"
    exit 0
}

Write-Host ""
Write-Host "AUTO AI owner-host deployment completed but public cutover is not fully verified." -ForegroundColor Yellow
Write-Host "If the tunnel is connected, confirm Cloudflare Published Application:"
Write-Host "  Hostname: autoai.izakhonoafrica.co.za"
Write-Host "  Service:  http://localhost:8780"
exit 4
