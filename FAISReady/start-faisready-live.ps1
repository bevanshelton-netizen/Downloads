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

$orchestrator = if ($env:FAISREADY_PAYMENT_ORCHESTRATOR) { $env:FAISREADY_PAYMENT_ORCHESTRATOR.ToLower() } else { 'izakhono' }
if ($orchestrator -eq 'izakhono') {
  $env:FAISREADY_PAYMENT_ORCHESTRATOR = 'izakhono'
  if (-not $env:IZAKHONO_PAY_URL -or -not $env:IZAKHONO_PAY_URL.StartsWith('https://')) {
    throw 'IZAKHONO_PAY_URL must be configured as an HTTPS origin.'
  }
  if (-not $env:IZAKHONO_PAY_API_KEY -or -not $env:IZAKHONO_PAY_WEBHOOK_SECRET) {
    throw 'IZAKHONO PAY API and webhook credentials are required for paid checkout.'
  }
} elseif ($orchestrator -eq 'direct') {
  if ($env:PAYFAST_SANDBOX -eq 'false') {
    if (-not $env:PAYFAST_MERCHANT_ID -or -not $env:PAYFAST_MERCHANT_KEY -or -not $env:PAYFAST_PASSPHRASE) {
      throw 'Direct live PayFast is selected but merchant credentials are incomplete.'
    }
    if ($env:FAISREADY_LIVE_PAYMENTS_APPROVED -ne 'true') {
      throw 'Direct live PayFast remains fail-closed until the external merchant rail is approved.'
    }
  }
} else {
  throw "Unsupported FAISREADY_PAYMENT_ORCHESTRATOR: $orchestrator"
}

Push-Location $PSScriptRoot
try {
  Write-Host ''
  Write-Host 'FAISReady — IZAKHONO owner-host launch' -ForegroundColor Cyan
  Write-Host "Public URL: $env:PUBLIC_BASE_URL"
  if ($orchestrator -eq 'izakhono') {
    Write-Host 'Payments: IZAKHONO PAY native orchestration' -ForegroundColor Green
  } elseif ($env:PAYFAST_SANDBOX -eq 'false') {
    Write-Host 'Payments: direct live settlement rail' -ForegroundColor Green
  } else {
    Write-Host 'Payments: direct sandbox rail' -ForegroundColor Yellow
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
