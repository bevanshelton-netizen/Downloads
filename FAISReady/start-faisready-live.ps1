param(
  [string]$EnvFile = "$PSScriptRoot\.env.local"
)
$ErrorActionPreference = 'Stop'

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { return }
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

Import-DotEnv $EnvFile

if (-not $env:PUBLIC_BASE_URL -or -not $env:PUBLIC_BASE_URL.StartsWith('https://')) {
  throw 'PUBLIC_BASE_URL must be set to the approved HTTPS FAISReady hostname in FAISReady/.env.local.'
}
if (-not $env:TUNNEL_TOKEN -and -not $env:TUNNEL_TOKEN_FILE) {
  throw 'Set TUNNEL_TOKEN or TUNNEL_TOKEN_FILE in FAISReady/.env.local. The token is never placed on the command line.'
}
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python 3 is required on the owner host.'
}
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared is required for the stable named HTTPS edge.'
}

if ($env:PAYFAST_SANDBOX -eq 'false') {
  if (-not $env:PAYFAST_MERCHANT_ID -or -not $env:PAYFAST_MERCHANT_KEY -or -not $env:PAYFAST_PASSPHRASE) {
    throw 'Live PayFast is selected but merchant credentials are incomplete.'
  }
  if ($env:FAISREADY_LIVE_PAYMENTS_APPROVED -ne 'true') {
    throw 'Live PayFast remains fail-closed. Set FAISREADY_LIVE_PAYMENTS_APPROVED=true only after merchant approval and a successful sandbox proof.'
  }
}

Push-Location $PSScriptRoot
try {
  Write-Host ''
  Write-Host 'FAISReady — IZAKHONO owner-host launch' -ForegroundColor Cyan
  Write-Host "Public URL: $env:PUBLIC_BASE_URL"
  if ($env:PAYFAST_SANDBOX -eq 'false') {
    Write-Host 'Payments: LIVE-approved mode' -ForegroundColor Green
  } else {
    Write-Host 'Payments: sandbox/disabled until PayFast approval' -ForegroundColor Yellow
  }
  Write-Host ''

  if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 edge_runner.py --mode named
  } else {
    & python edge_runner.py --mode named
  }
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
