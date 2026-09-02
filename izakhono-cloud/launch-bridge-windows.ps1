#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Manifest,
    [string]$RepoRoot = ".",
    [switch]$ProofOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Error $Message
    exit 1
}

if ($env:OS -ne "Windows_NT") {
    Fail "This helper is for Windows owner-controlled hardware."
}

$RepoRoot = (Resolve-Path $RepoRoot).Path
$Manifest = (Resolve-Path $Manifest).Path
$Launcher = Join-Path $RepoRoot "izakhono-cloud\launch-bridge.py"
if (-not (Test-Path $Launcher)) {
    Fail "launch-bridge.py not found under $RepoRoot"
}

$Py = Get-Command py.exe -ErrorAction SilentlyContinue
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Py -and -not $Python) {
    Fail "Python 3 is required. Install Python 3, then rerun this command."
}

function Invoke-Python([string[]]$Arguments) {
    if ($Py) {
        & $Py.Source -3 @Arguments
    }
    else {
        & $Python.Source @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        Fail "Python command failed with exit code $LASTEXITCODE"
    }
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Plan = Join-Path $env:TEMP "izakhono-launch-plan-$Stamp.json"
$ProofReceipt = Join-Path $env:TEMP "izakhono-launch-proof-$Stamp.json"
$LiveReceipt = Join-Path $env:TEMP "izakhono-launch-live-$Stamp.json"

Write-Host "IZAKHONO CLOUD launch bridge preflight"
Write-Host "repo_root=$RepoRoot"
Write-Host "manifest=$Manifest"

Invoke-Python @($Launcher, "plan", $Manifest, "--out", $Plan)
Invoke-Python @($Launcher, "run", $Plan, "--repo-root", $RepoRoot, "--proof-only", "--receipt", $ProofReceipt)

$Receipt = Get-Content $ProofReceipt -Raw | ConvertFrom-Json
if (-not $Receipt.local_health_passed) { Fail "Local health proof did not pass." }
if ($Receipt.docker_used) { Fail "Launch bridge unexpectedly used Docker." }
if ($Receipt.public_ip_used) { Fail "Launch bridge unexpectedly required a public IP." }

Write-Host "IZAKHONO native runtime proof: PASS"
Write-Host "plan=$Plan"
Write-Host "proof_receipt=$ProofReceipt"
Write-Host "docker_used=false"
Write-Host "public_ip_used=false"

if ($ProofOnly) {
    Write-Host "Proof-only mode complete. No public-readiness claim has been made."
    exit 0
}

Write-Host "Starting the live loopback-only application process."
Write-Host "Public access must be provided separately by the named outbound HTTPS tunnel."
Write-Host "live_receipt=$LiveReceipt"
Invoke-Python @($Launcher, "run", $Plan, "--repo-root", $RepoRoot, "--receipt", $LiveReceipt)
