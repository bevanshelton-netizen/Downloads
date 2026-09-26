#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$EnvFile = "$PSScriptRoot\.env.local",
  [string]$Order = ""
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Missing $Path." }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { return }
    $name = $parts[0].Trim(); $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}
Import-DotEnv $EnvFile
if ($env:IKHOKHA_LIVE_APPROVED -ne 'true') { throw 'IKHOKHA_LIVE_APPROVED must be true for controlled first-sale proof.' }
$Py = Get-Command py.exe -ErrorAction SilentlyContinue
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Py -and -not $Python) { throw 'Python 3 is required.' }
$Receipt = Join-Path $env:TEMP 'faisready-first-sale-proof.json'
$Args = @('verify_activation.py','first-sale','--receipt',$Receipt)
if ($Order) { $Args += @('--order',$Order) }
Push-Location $PSScriptRoot
try {
  if ($Py) { & $Py.Source -3 @Args }
  else { & $Python.Source @Args }
  if ($LASTEXITCODE -ne 0) { throw "First-sale verification failed with exit code $LASTEXITCODE." }
  Write-Host ''
  Write-Host 'FAISReady controlled first-sale proof: PASS' -ForegroundColor Green
  Write-Host "Receipt: $Receipt"
  Write-Host 'Revenue path verified. Broad promotion remains separately gated.'
}
finally { Pop-Location }
