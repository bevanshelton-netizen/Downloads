#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "revenue.domains.izakhonoafrica.co.za")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ReceiptLinux = "/var/lib/izakhono-deploy/revenue-desk.json"
$DesktopReport = Join-Path ([Environment]::GetFolderPath("Desktop")) "IZAKHONO-REVENUE-DESK-GO-LIVE-REPORT.txt"

function Get-RevenueReceipt {
  $raw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat '$ReceiptLinux'" 2>$null) -join "`n"
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    throw "Revenue Desk deployment receipt is missing: $ReceiptLinux"
  }
  return ($raw | ConvertFrom-Json)
}

function Assert-RevenueReceipt([object]$Receipt) {
  if ($Receipt.app -ne "izakhono-revenue-desk") { throw "Receipt app identity mismatch." }
  if ($Receipt.source -ne "IZAKHONO_CODE") { throw "Receipt source is not IZAKHONO_CODE." }
  if ($Receipt.runtime -ne "IZAKHONO_RUNTIME") { throw "Receipt runtime is not IZAKHONO_RUNTIME." }
  if ($Receipt.hostname -ne $Hostname) { throw "Receipt hostname mismatch: $($Receipt.hostname)" }
  if ($Receipt.public_https -ne "VERIFIED") {
    throw "Owned public HTTPS is not receipt-verified. PUBLIC_HTTPS=$($Receipt.public_https)"
  }
}

function Write-Report([string]$Status,[string]$Detail) {
  @"
IZAKHONO REVENUE DESK GO-LIVE REPORT
STATUS=$Status
OWNED_ORIGIN=https://$Hostname
CUSTOMER_HOSTNAME=revenue.izakhonoafrica.co.za
EXTERNAL_FALLBACK=https://izakhono-revenue-desk.vercel.app/
EXTERNAL_FALLBACK_ACTION=KEEP_INTACT
PAYMENT_BOUNDARY=UNCHANGED
DETAIL=$Detail
GENERATED_AT=$([DateTime]::UtcNow.ToString("o"))
"@ | Set-Content -Encoding UTF8 $DesktopReport
  Write-Host "Report: $DesktopReport" -ForegroundColor Cyan
}

function Refresh-Receipt {
  $escaped = $Hostname.Replace("'","''")
  $refresh = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
export IZAKHONO_REVENUE_HOSTNAME='$escaped'
bash izakhono-owned-cloud/deploy-revenue-desk.sh main
"@
  $refresh | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
  if ($LASTEXITCODE -ne 0) { throw "Revenue Desk receipt refresh failed." }
}

function Test-PublicRevenue {
  try {
    $public = Invoke-WebRequest -UseBasicParsing -TimeoutSec 12 "https://$Hostname/health"
    $health = $public.Content | ConvertFrom-Json
    return ($public.StatusCode -eq 200 -and $health.ok -eq $true -and $health.service -eq "izakhono-revenue-desk")
  } catch {
    return $false
  }
}

Write-Host ""
Write-Host "IZAKHONO REVENUE DESK - OWNED INFRASTRUCTURE" -ForegroundColor Cyan
Write-Host "Target: ISN-01 -> IZAKHONO CODE -> RUNTIME -> EDGE/TLS" -ForegroundColor Cyan
Write-Host "Promotion rule: no success unless the receipt itself says PUBLIC_HTTPS=VERIFIED." -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$escapedHost = $Hostname.Replace("'","''")
$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
bash izakhono-owned-cloud/migrate-source-to-code.sh
export IZAKHONO_REVENUE_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-revenue-desk.sh main
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  Write-Report "DEPLOYMENT_FAILED" "Owned runtime deployment failed before public promotion."
  throw "Revenue Desk owned-infrastructure deployment failed."
}

Write-Host ""
Write-Host "REVENUE DESK: DEPLOYED TO IZAKHONO RUNTIME" -ForegroundColor Green
Write-Host "Hostname: $Hostname" -ForegroundColor Green

if (Test-PublicRevenue) {
  # The original launcher could return success here even when the stored receipt
  # still said NOT_VERIFIED. Refresh once, then require the receipt to prove it.
  Refresh-Receipt
  $receipt = Get-RevenueReceipt
  Assert-RevenueReceipt $receipt
  Write-Report "OWNED_ORIGIN_LIVE_VERIFIED" "Runtime, public HTTPS and stored deployment receipt are verified. Canonical customer-host promotion is now eligible."
  Write-Host "PUBLIC HTTPS: LIVE AND RECEIPT-VERIFIED" -ForegroundColor Green
  Start-Process "https://$Hostname"
  exit 0
}

Write-Host "Public HTTPS is not reachable yet. Activating IZAKHONO-owned DNS and EDGE..." -ForegroundColor Yellow

$edgeLinux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
export IZAKHONO_PUBLIC_ZONE='domains.izakhonoafrica.co.za'
export IZAKHONO_PUBLIC_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/activate-owned-public-edge.sh
"@
$edgeLinux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$edgeCode = $LASTEXITCODE

if ($edgeCode -eq 20) {
  Write-Report "BLOCKED_PARENT_DNS_OR_ROUTER" "Owned runtime is deployed. Apply the parent DNS/router handoff printed by IZAKHONO EDGE, then rerun this launcher."
  Write-Host ""
  Write-Host "Revenue Desk runtime is deployed and the owned multi-host DNS zone is installed." -ForegroundColor Green
  Write-Host "ONE-TIME NETWORK CUTOVER is still required. Apply the parent-DNS/router values printed above, then run this launcher again." -ForegroundColor Yellow
  exit 20
}
if ($edgeCode -eq 21) {
  Write-Report "BLOCKED_TLS_OR_PUBLIC_PORTS" "Owned DNS delegation is visible, but TCP 80/443 or trusted TLS is incomplete."
  Write-Host ""
  Write-Host "Owned DNS delegation is visible. Public TCP 80/443 or trusted TLS still needs to complete." -ForegroundColor Yellow
  exit 21
}
if ($edgeCode -ne 0) {
  Write-Report "EDGE_ACTIVATION_FAILED" "IZAKHONO-owned public edge activation failed with code $edgeCode."
  throw "IZAKHONO-owned public edge activation failed (code $edgeCode)."
}

if (-not (Test-PublicRevenue)) {
  Write-Report "PUBLIC_HEALTH_FAILED" "EDGE reported success but the Revenue Desk public /health identity did not verify."
  throw "Public Revenue Desk health verification failed."
}

# Critical finalization: refresh the receipt AFTER EDGE/TLS becomes public.
Refresh-Receipt
$receipt = Get-RevenueReceipt
Assert-RevenueReceipt $receipt

Write-Report "OWNED_ORIGIN_LIVE_VERIFIED" "PUBLIC_HTTPS=VERIFIED is stored in the owned deployment receipt. External fallback remains intact. Canonical customer-host promotion is now eligible."

Write-Host ""
Write-Host "IZAKHONO REVENUE DESK: OWNED ORIGIN LIVE AND RECEIPT-VERIFIED" -ForegroundColor Green
Write-Host "https://$Hostname" -ForegroundColor Green
Write-Host "Next guarded phase: promote revenue.izakhonoafrica.co.za without removing the external fallback." -ForegroundColor Cyan
Start-Process "https://$Hostname"
exit 0
