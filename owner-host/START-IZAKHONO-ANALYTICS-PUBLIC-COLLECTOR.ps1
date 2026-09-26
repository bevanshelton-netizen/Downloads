#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message, [int]$Code = 2) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit $Code
}

function HttpStatus([scriptblock]$Request) {
    try {
        $response = & $Request
        return [int]$response.StatusCode
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

function Is-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if ($env:OS -ne "Windows_NT") { Fail "Run this launcher on the Windows owner machine." }
if (-not (Is-Admin)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
    exit 0
}

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$AnalyticsReceipt = Join-Path $State "ANALYTICS-CUTOVER.json"
$PublicReceipt = Join-Path $State "ANALYTICS-PUBLIC-COLLECTOR.json"
$AnalyticsScript = Join-Path $State "DEPLOY-ANALYTICS-ISN-01.ps1"
$EdgeScript = Join-Path $State "START-IZAKHONO-PUBLIC-EDGE.ps1"
$Collector = "https://analytics.domains.izakhonoafrica.co.za"
$ApprovedOrigin = "https://market.domains.izakhonoafrica.co.za"

if (-not (Test-Path $State)) { New-Item -ItemType Directory -Path $State -Force | Out-Null }
if (-not (Test-Path $EngineProof)) {
    Fail "IZAKHONO Engine proof is missing. Run START-IZAKHONO-ENGINE-ISN-01.cmd first."
}

Write-Host "Stage 1/3: verifying the owner-host Analytics runtime..." -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-cloud/DEPLOY-ANALYTICS-ISN-01.ps1" -OutFile $AnalyticsScript
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $AnalyticsScript
if ($LASTEXITCODE -ne 0) { Fail "Analytics owner-host deployment failed." }
if (-not (Test-Path $AnalyticsReceipt)) { Fail "Analytics owner-host receipt is missing." }

$analytics = Get-Content $AnalyticsReceipt -Raw | ConvertFrom-Json
if ($analytics.health_passed -ne $true) { Fail "Analytics owner-host health proof is missing." }
if ($analytics.privacy_mode -ne "no-raw-ip-storage") { Fail "Analytics privacy contract is not verified." }
if ($analytics.require_origin -ne $true) { Fail "Analytics browser-origin enforcement is not verified." }
if ($analytics.admin_protected -ne $true) { Fail "Analytics reporting is not administrator protected." }

Write-Host "Stage 2/3: activating the IZAKHONO-owned HTTPS edge..." -ForegroundColor Cyan
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-PUBLIC-EDGE.ps1" -OutFile $EdgeScript
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $EdgeScript
$edgeCode = $LASTEXITCODE
if ($edgeCode -eq 20) {
    Write-Host "Owned DNS/router handoff is still required. No public-live Analytics claim has been made." -ForegroundColor Yellow
    exit 20
}
if ($edgeCode -eq 21) {
    Write-Host "Owned DNS is visible, but trusted TLS/direct HTTPS still needs reachability. No public-live Analytics claim has been made." -ForegroundColor Yellow
    exit 21
}
if ($edgeCode -ne 0) { Fail "Owned public edge activation failed with code $edgeCode." $edgeCode }

Write-Host "Stage 3/3: independently proving the public collector boundary..." -ForegroundColor Cyan

$health = Invoke-WebRequest -UseBasicParsing -Uri "$Collector/healthz" -TimeoutSec 15
if ($health.StatusCode -ne 200 -or $health.Content -notmatch '"ok":true') {
    Fail "Public Analytics health endpoint failed."
}

$beacon = Invoke-WebRequest -UseBasicParsing -Uri "$Collector/beacon.js?platform=legacymart" -TimeoutSec 15
if ($beacon.StatusCode -ne 200 -or $beacon.Content -notmatch 'izakhonoTrack') {
    Fail "Public Analytics beacon endpoint failed."
}

$dashboardStatus = HttpStatus { Invoke-WebRequest -UseBasicParsing -Uri "$Collector/dashboard" -TimeoutSec 15 }
if ($dashboardStatus -ne 404) { Fail "Analytics dashboard is exposed on the public collector hostname." }

$summaryStatus = HttpStatus { Invoke-WebRequest -UseBasicParsing -Uri "$Collector/api/summary?days=1" -TimeoutSec 15 }
if ($summaryStatus -ne 404) { Fail "Analytics reporting API is exposed on the public collector hostname." }

$missingOriginStatus = HttpStatus {
    Invoke-WebRequest -UseBasicParsing -Uri "$Collector/v1/hit" -Method POST -ContentType "application/json" -Body '{"platform":"legacymart","event":"pageview","path":"/proof","visitor_id":"proof","session_id":"proof"}' -TimeoutSec 15
}
if ($missingOriginStatus -ne 403) { Fail "Collector accepted an event without a browser Origin." }

$optionsStatus = HttpStatus {
    Invoke-WebRequest -UseBasicParsing -Uri "$Collector/v1/hit" -Method OPTIONS -Headers @{ Origin = $ApprovedOrigin; "Access-Control-Request-Method" = "POST"; "Access-Control-Request-Headers" = "content-type" } -TimeoutSec 15
}
if ($optionsStatus -ne 204) { Fail "Approved IZAKHONO production origin did not pass collector CORS preflight." }

$body = [ordered]@{
    schema = "izakhono.analytics-public-collector/v1"
    hostname = "analytics.domains.izakhonoafrica.co.za"
    public_https = $true
    health_https_200 = $true
    beacon_https_200 = $true
    dashboard_public = $false
    reporting_api_public = $false
    missing_origin_rejected = $true
    approved_origin_preflight = $true
    raw_ip_storage = $false
    public_paths = @("GET /healthz","GET /beacon.js","POST /v1/hit","OPTIONS /v1/hit")
    private_paths = @("/dashboard","/api/summary","/api/config")
    live_payments_changed = $false
    proved_at_utc = (Get-Date).ToUniversalTime().ToString("s") + "Z"
}
$body | ConvertTo-Json -Depth 6 | Set-Content -Path $PublicReceipt -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO ANALYTICS PUBLIC COLLECTOR: VERIFIED" -ForegroundColor Green
Write-Host "Collector: $Collector" -ForegroundColor Green
Write-Host "Dashboard remains private on the owner host." -ForegroundColor Cyan
Write-Host "Receipt: $PublicReceipt"
Write-Host "No live-payment state was changed." -ForegroundColor Yellow
