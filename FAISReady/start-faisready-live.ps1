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

function Fail([string]$Message) {
  Write-Host ''
  Write-Host "FAISReady live launch stopped safely: $Message" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $EnvFile)) {
  $Template = Join-Path $PSScriptRoot '.env.example'
  if (-not (Test-Path $Template)) { Fail '.env.example is missing.' }
  Copy-Item $Template $EnvFile -Force
  Write-Host ''
  Write-Host 'Created FAISReady\.env.local from the safe template.' -ForegroundColor Yellow
  Write-Host 'Add the named-tunnel token and authorised payment credentials, then run START-FAISREADY-LIVE.cmd again.'
  if (Get-Command notepad.exe -ErrorAction SilentlyContinue) {
    Start-Process notepad.exe $EnvFile
  }
  exit 2
}

Import-DotEnv $EnvFile

if (-not $env:PUBLIC_BASE_URL -or -not $env:PUBLIC_BASE_URL.StartsWith('https://')) {
  Fail 'PUBLIC_BASE_URL must be the approved HTTPS FAISReady hostname.'
}
try {
  $PublicUri = [Uri]$env:PUBLIC_BASE_URL
} catch {
  Fail 'PUBLIC_BASE_URL is not a valid HTTPS URL.'
}
$HostName = $PublicUri.DnsSafeHost.ToLowerInvariant()
if ($HostName -ne 'faisready.co.za' -and -not $HostName.EndsWith('.faisready.co.za')) {
  Fail 'PUBLIC_BASE_URL must use faisready.co.za or an approved subdomain of faisready.co.za.'
}

if (-not $env:TUNNEL_TOKEN -and -not $env:TUNNEL_TOKEN_FILE) {
  Fail 'Set TUNNEL_TOKEN or TUNNEL_TOKEN_FILE in FAISReady\.env.local.'
}
if ($env:TUNNEL_TOKEN_FILE -and -not (Test-Path $env:TUNNEL_TOKEN_FILE)) {
  Fail 'TUNNEL_TOKEN_FILE does not exist.'
}

$Py = Get-Command py.exe -ErrorAction SilentlyContinue
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Py -and -not $Python) {
  Fail 'Python 3 is required on the owner host.'
}

$Cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
if (-not $Cloudflared) {
  $Winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $Winget) { Fail 'cloudflared is missing and winget is unavailable.' }
  Write-Host 'Installing Cloudflare Tunnel client...' -ForegroundColor Cyan
  & $Winget.Source install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { Fail "cloudflared installation failed with code $LASTEXITCODE." }
  $MachinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
  $UserPath = [Environment]::GetEnvironmentVariable('Path','User')
  $env:Path = "$MachinePath;$UserPath"
  $Cloudflared = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
  if (-not $Cloudflared) { Fail 'cloudflared was installed; reopen the launcher once so Windows refreshes PATH.' }
}

$Provider = if ($env:FAISREADY_PAYMENT_PROVIDER) { $env:FAISREADY_PAYMENT_PROVIDER.Trim().ToLowerInvariant() } else { 'ikhokha' }
switch ($Provider) {
  'ikhokha' {
    $IKKey = if ($env:IKHOKHA_APP_KEY) { $env:IKHOKHA_APP_KEY } else { $env:IKHOKHA_APP_SECRET }
    if ($env:IKHOKHA_LIVE_APPROVED -eq 'true') {
      if (-not $env:IKHOKHA_APP_ID -or -not $IKKey) {
        Fail 'iKhokha live approval is enabled but IKHOKHA_APP_ID / IKHOKHA_APP_KEY are missing.'
      }
      Write-Host 'iKhokha checkout: CONTROLLED LIVE TRANSACTION ENABLED' -ForegroundColor Green
    } else {
      Write-Host 'iKhokha checkout: LOCKED (stable-host preflight only)' -ForegroundColor Yellow
      Write-Host 'The public site may be verified, but /api/checkout remains fail-closed.'
    }
  }
  'payfast' {
    if ($env:PAYFAST_SANDBOX -ne 'false') {
      Fail 'The LIVE launcher will not treat PayFast sandbox as production. Use START-FAISREADY-SANDBOX.cmd for sandbox proof.'
    }
    if (-not $env:PAYFAST_MERCHANT_ID -or -not $env:PAYFAST_MERCHANT_KEY -or -not $env:PAYFAST_PASSPHRASE) {
      Fail 'PayFast live is selected but merchant credentials are incomplete.'
    }
    if ($env:FAISREADY_LIVE_PAYMENTS_APPROVED -ne 'true') {
      Fail 'PayFast live remains fail-closed until FAISREADY_LIVE_PAYMENTS_APPROVED=true.'
    }
  }
  'izakhono' {
    if (-not $env:IZAKHONO_PAY_URL -or -not $env:IZAKHONO_PAY_API_KEY -or -not $env:IZAKHONO_PAY_WEBHOOK_SECRET) {
      Fail 'IZAKHONO PAY is selected but its URL/API/webhook credentials are incomplete.'
    }
  }
  default {
    Fail 'FAISREADY_PAYMENT_PROVIDER must be ikhokha, payfast, or izakhono.'
  }
}

Push-Location $PSScriptRoot
try {
  Write-Host ''
  Write-Host 'FAISReady — IZAKHONO owner-host production launch' -ForegroundColor Cyan
  Write-Host "Public URL: $env:PUBLIC_BASE_URL"
  Write-Host "Payment provider: $Provider"
  Write-Host 'Origin: loopback only (127.0.0.1:18091)'
  Write-Host 'Public edge: named outbound HTTPS tunnel'
  Write-Host ''

  if ($Py) {
    & $Py.Source -3 edge_runner.py --mode named
  } else {
    & $Python.Source edge_runner.py --mode named
  }
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
