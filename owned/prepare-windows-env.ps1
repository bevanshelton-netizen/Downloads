[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^https://')]
  [string]$PublicBaseUrl,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ownedDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $ownedDir '.env'

if ((Test-Path $envPath) -and -not $Force) {
  throw "Refusing to overwrite existing $envPath. Back it up and rerun with -Force only if you intend to replace it."
}

$uri = [Uri]$PublicBaseUrl
if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment) {
  throw 'PublicBaseUrl must be a canonical HTTPS origin, for example https://videonomy.izakhonoafrica.co.za'
}

$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $adminBytes = New-Object byte[] 48
  $saltBytes = New-Object byte[] 48
  $rng.GetBytes($adminBytes)
  $rng.GetBytes($saltBytes)
  $adminSecret = [Convert]::ToBase64String($adminBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  $abuseSalt = ([BitConverter]::ToString($saltBytes)).Replace('-','').ToLowerInvariant()
}
finally {
  $rng.Dispose()
}

$origin = $uri.GetLeftPart([UriPartial]::Authority)
$lines = @(
  'APP_ENV=production'
  "ADMIN_SECRET=$adminSecret"
  "ABUSE_SALT=$abuseSalt"
  "PUBLIC_BASE_URL=$origin"
  "ALLOWED_ORIGINS=$origin"
  'IKHOKHA_APP_ID='
  'IKHOKHA_APP_SECRET='
  'IKHOKHA_MODE=sandbox'
  'PAYFAST_MERCHANT_ID='
  'PAYFAST_MERCHANT_KEY='
  'PAYFAST_PASSPHRASE='
  'PAYFAST_MODE=sandbox'
  'PAYFAST_ALLOWED_CIDRS='
)
[IO.File]::WriteAllLines($envPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Created protected local configuration: $envPath"
Write-Host "Canonical origin: $origin"
Write-Host 'Random application secrets generated locally; values were not printed.'
Write-Host 'Payment integrations remain in sandbox mode until credentials and live-mode approval are configured.'
Write-Host 'Next: run .\START-VIDEONOMY-OWNED.cmd from this directory.'
