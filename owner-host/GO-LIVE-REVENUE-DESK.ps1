#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$owned = Join-Path $PSScriptRoot "START-REVENUE-DESK-ON-IZAKHONO.ps1"
$promote = Join-Path $PSScriptRoot "PROMOTE-REVENUE-DESK-CANONICAL.ps1"

Write-Host ""
Write-Host "IZAKHONO REVENUE DESK - ONE CLICK GO-LIVE" -ForegroundColor Cyan
Write-Host "Sequence: OWNED ORIGIN -> RECEIPT GATE -> CANONICAL ALIAS/DNS/TLS -> PUBLIC VERIFY" -ForegroundColor Cyan
Write-Host "External fallback remains intact throughout." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $owned)) { throw "Owned-origin launcher is missing: $owned" }
if (-not (Test-Path $promote)) { throw "Canonical promotion launcher is missing: $promote" }

& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $owned
$ownedCode = $LASTEXITCODE
if ($ownedCode -ne 0) {
  Write-Host ""
  Write-Host "Revenue Desk stopped safely at the owned-origin gate (code $ownedCode)." -ForegroundColor Yellow
  exit $ownedCode
}

Write-Host ""
Write-Host "OWNED ORIGIN RECEIPT-VERIFIED. ENTERING GUARDED CANONICAL PROMOTION." -ForegroundColor Green

& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $promote
$promoteCode = $LASTEXITCODE
if ($promoteCode -eq 20) {
  Write-Host ""
  Write-Host "Canonical DNS cutover is now the remaining gate. Apply the exact A record printed above, then rerun this SAME launcher." -ForegroundColor Yellow
  exit 20
}
if ($promoteCode -eq 21) {
  Write-Host ""
  Write-Host "Canonical DNS reaches IZAKHONO, but trusted TLS/public ports are incomplete. Correct that gate and rerun this SAME launcher." -ForegroundColor Yellow
  exit 21
}
if ($promoteCode -ne 0) {
  throw "Revenue Desk canonical promotion failed with code $promoteCode."
}

Write-Host ""
Write-Host "IZAKHONO REVENUE DESK: OWNED LIVE VERIFIED" -ForegroundColor Green
Write-Host "https://revenue.izakhonoafrica.co.za" -ForegroundColor Green
Write-Host "External fallback retained: https://izakhono-revenue-desk.vercel.app/" -ForegroundColor Green
exit 0
