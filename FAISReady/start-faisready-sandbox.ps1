#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "FAISReady launch stopped: $Message" -ForegroundColor Red
    exit 1
}

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $Here

Write-Host ""
Write-Host "============================================"
Write-Host " FAISReady - IZAKHONO first-revenue sandbox"
Write-Host "============================================"
Write-Host ""
Write-Host "This starts a REAL public sandbox proof only."
Write-Host "No live customer money will be taken."
Write-Host ""

$Py = Get-Command py.exe -ErrorAction SilentlyContinue
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Py -and -not $Python) {
    Fail 'Python 3 is not installed or is not available on PATH.'
}

function Invoke-Python([string[]]$Arguments) {
    if ($Py) {
        & $Py.Source -3 @Arguments
    } else {
        & $Python.Source @Arguments
    }
    if ($LASTEXITCODE -ne 0) {
        Fail "Python command failed with exit code $LASTEXITCODE"
    }
}

$Cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
if (-not $Cloudflared) {
    $Winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $Winget) {
        Fail 'cloudflared is missing and Windows Package Manager (winget) is unavailable.'
    }

    Write-Host 'Installing Cloudflare Tunnel client with winget...'
    & $Winget.Source install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {
        Fail "cloudflared installation failed with exit code $LASTEXITCODE"
    }

    $MachinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
    $UserPath = [Environment]::GetEnvironmentVariable('Path','User')
    $env:Path = "$MachinePath;$UserPath"
    $Cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
    if (-not $Cloudflared) {
        $Candidates = @(
            "$env:ProgramFiles\cloudflared\cloudflared.exe",
            "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
        ) | Where-Object { $_ -and (Test-Path $_) }
        if ($Candidates.Count -gt 0) {
            $env:Path = "$(Split-Path -Parent $Candidates[0]);$env:Path"
            $Cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
        }
    }
    if (-not $Cloudflared) {
        Fail 'cloudflared was installed but this terminal cannot locate it yet. Reopen this launcher once.'
    }
}

Write-Host "cloudflared=$($Cloudflared.Source)"
Write-Host 'Running IZAKHONO owner-machine native proof...'

$Bridge = Join-Path $RepoRoot 'izakhono-cloud\launch-bridge-windows.ps1'
$Manifest = Join-Path $Here '.izakhono-launch-windows.json'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Bridge -Manifest $Manifest -RepoRoot $RepoRoot -ProofOnly
if ($LASTEXITCODE -ne 0) {
    Fail 'The owner-machine Launch Bridge proof failed.'
}

Write-Host ""
Write-Host 'Owner-machine proof PASS.' -ForegroundColor Green
Write-Host 'Starting temporary public HTTPS + PayFast SANDBOX...'
Write-Host 'The URL printed below is temporary and must NOT be advertised as production.'
Write-Host 'Press Ctrl+C in this window when the sandbox rehearsal is finished.'
Write-Host ""

Push-Location $RepoRoot
try {
    Invoke-Python @('FAISReady/edge_runner.py','--mode','quick-sandbox','--public-payfast-sandbox')
} finally {
    Pop-Location
}
