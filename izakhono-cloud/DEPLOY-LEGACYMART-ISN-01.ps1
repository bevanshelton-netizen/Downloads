#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$Receipt = Join-Path $State "LEGACYMART-CUTOVER.json"
$Hostname = "market.domains.izakhonoafrica.co.za"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

if ($env:OS -ne "Windows_NT") { Fail "Run this launcher on the Windows owner machine." }
if (-not (Test-Path $State)) { New-Item -ItemType Directory -Path $State -Force | Out-Null }
if (-not (Test-Path $EngineProof)) {
    Fail "IZAKHONO Engine proof is missing. Run START-IZAKHONO-ENGINE-ISN-01.cmd first."
}
$proof = Get-Content $EngineProof -Raw | ConvertFrom-Json
if ($proof.node_name -ne "ISN-01") { Fail "Engine proof is not for ISN-01." }
foreach ($field in @("scheduler_dispatch","image_pull","container_start","http_health")) {
    if ($proof.$field -ne $true) { Fail "Engine proof field '$field' is not verified." }
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { Fail "WSL is not available." }
$distros = (& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if ($distros -notmatch "Ubuntu-24.04") { Fail "Ubuntu-24.04 owner host is not installed." }

Write-Host ""
Write-Host "LEGACYMART MAKERS - IZAKHONO OWNED PILOT" -ForegroundColor Cyan
Write-Host "Reference shop: BEVAN SHELTON(TM)" -ForegroundColor Cyan
Write-Host "Source path: approved GitHub mirror -> IZAKHONO CODE -> RUNTIME" -ForegroundColor Cyan
Write-Host "Legacy PayFast checkout remains disabled." -ForegroundColor Yellow
Write-Host ""

$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "`$(git status --porcelain)" ]; then
  echo "Owner-host Downloads checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main

sudo bash izakhono-owned-cloud/import-repo-to-code.sh   legacymart   https://github.com/bevanshelton-netizen/bevanshelton-netizen-legacymart.git   /etc/izakhono/legacymart-code.env

export LEGACYMART_HOSTNAME='$Hostname'
bash izakhono-owned-cloud/deploy-legacymart.sh main
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { Fail "LegacyMart IZAKHONO-owned deployment failed inside WSL." }

$linuxReceipt = wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/legacymart.json"
if ($LASTEXITCODE -ne 0 -or -not $linuxReceipt) { Fail "LegacyMart deployment receipt is unavailable." }
$linuxReceipt | Set-Content -Path $Receipt -Encoding UTF8

$verified = Get-Content $Receipt -Raw | ConvertFrom-Json
if ($verified.app -ne "legacymart") { Fail "LegacyMart receipt app mismatch." }
if ($verified.source -ne "IZAKHONO_CODE") { Fail "LegacyMart did not deploy from IZAKHONO CODE." }
if ($verified.runtime -ne "IZAKHONO_RUNTIME") { Fail "LegacyMart did not deploy on IZAKHONO RUNTIME." }
if ($verified.legacy_checkout_enabled -ne $false) { Fail "Legacy PayFast checkout safety boundary was violated." }

Write-Host ""
Write-Host "LEGACYMART IZAKHONO OWNED PILOT: VERIFIED" -ForegroundColor Green
Write-Host "Reference shop: BEVAN SHELTON(TM)" -ForegroundColor Green
Write-Host "Owned hostname target: https://$Hostname/shop?seller=bevan-shelton"
Write-Host "Receipt: $Receipt"
Write-Host "The BEVAN SHELTON reference checkout remains environment-gated through IZAKHONO PAY." -ForegroundColor Yellow
Write-Host "No public-live claim is made unless PUBLIC_HTTPS is VERIFIED in the receipt." -ForegroundColor Yellow
exit 0
