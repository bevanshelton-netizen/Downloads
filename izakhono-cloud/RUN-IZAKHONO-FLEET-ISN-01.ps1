#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
$EngineProof = Join-Path $State "ENGINE-PROOF.json"
$FleetReceipt = Join-Path $State "FLEET-STATUS.json"

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

$apps = @(
    @{ name="ECD360"; script="DEPLOY-ECD360-ISN-01.ps1"; receipt="ECD360-CUTOVER.json"; required=$true },
    @{ name="ALLEGRO VIBEZ"; script="DEPLOY-ALLEGRO-ISN-01.ps1"; receipt="ALLEGRO-CUTOVER.json"; required=$false },
    @{ name="THE CHANCELLOR"; script="DEPLOY-CHANCELLOR-ISN-01.ps1"; receipt="CHANCELLOR-CUTOVER.json"; required=$true },
    @{ name="SHELTON FORTRESS"; script="DEPLOY-FORTRESS-ISN-01.ps1"; receipt="FORTRESS-CUTOVER.json"; required=$true },
    @{ name="KORA"; script="DEPLOY-KORA-ISN-01.ps1"; receipt="KORA-CUTOVER.json"; required=$false }
)

$results = @()
foreach ($app in $apps) {
    if ($app.name -eq "ALLEGRO VIBEZ") {
        $allegroEnv = Join-Path $State "ALLEGRO.env"
        if (-not (Test-Path $allegroEnv)) {
            Write-Host "ALLEGRO VIBEZ skipped: owner-host ALLEGRO.env is not present." -ForegroundColor Yellow
            $results += [pscustomobject]@{ app=$app.name; status="blocked_config"; receipt=$app.receipt }
            continue
        }
    }
    if ($app.name -eq "KORA") {
        $koraEnv = Join-Path $State "KORA.env"
        if (-not (Test-Path $koraEnv)) {
            Write-Host "KORA skipped: owner-host KORA.env is not present." -ForegroundColor Yellow
            $results += [pscustomobject]@{ app=$app.name; status="blocked_config"; receipt=$app.receipt }
            continue
        }
    }

    $localScript = Join-Path $State $app.script
    $url = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-cloud/$($app.script)"
    Invoke-WebRequest -UseBasicParsing $url -OutFile $localScript

    Write-Host ""
    Write-Host "=== $($app.name) ===" -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $localScript
    $code = $LASTEXITCODE
    $receiptPath = Join-Path $State $app.receipt

    if ($code -eq 0 -and (Test-Path $receiptPath)) {
        $results += [pscustomobject]@{ app=$app.name; status="verified_local_pilot"; receipt=$app.receipt }
        Write-Host "$($app.name): VERIFIED LOCAL PILOT" -ForegroundColor Green
    } else {
        $results += [pscustomobject]@{ app=$app.name; status="failed"; receipt=$app.receipt }
        if ($app.required) {
            $payload = [pscustomobject]@{
                schema = "izakhono.fleet-status/v1"
                node_name = "ISN-01"
                generated_at = (Get-Date).ToUniversalTime().ToString("s") + "Z"
                results = $results
                public_dns_changed = $false
                public_traffic_changed = $false
                live_payments_changed = $false
            }
            $payload | ConvertTo-Json -Depth 5 | Set-Content -Path $FleetReceipt -Encoding UTF8
            Fail "$($app.name) failed. Remaining required pilots were not started."
        }
    }
}

$final = [pscustomobject]@{
    schema = "izakhono.fleet-status/v1"
    node_name = "ISN-01"
    generated_at = (Get-Date).ToUniversalTime().ToString("s") + "Z"
    results = $results
    public_dns_changed = $false
    public_traffic_changed = $false
    live_payments_changed = $false
    public_ready = $false
    commercial_ready = $false
}
$final | ConvertTo-Json -Depth 5 | Set-Content -Path $FleetReceipt -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO OWNER-HOST FLEET PASS COMPLETE" -ForegroundColor Green
Write-Host "Fleet receipt: $FleetReceipt"
Write-Host "All verified services remain loopback/private. DNS, public traffic and live payments are unchanged." -ForegroundColor Yellow
