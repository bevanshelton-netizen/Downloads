#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$EnvFile = "$PSScriptRoot\.env.local"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { throw "Missing $Path. Run START-FAISREADY-LIVE.cmd once to create the template." }
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
if (-not $env:PUBLIC_BASE_URL) { throw 'PUBLIC_BASE_URL is missing.' }
$Py = Get-Command py.exe -ErrorAction SilentlyContinue
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Py -and -not $Python) { throw 'Python 3 is required.' }
$Receipt = Join-Path $env:TEMP 'faisready-preflight-proof.json'
Push-Location $PSScriptRoot
try {
  if ($Py) { & $Py.Source -3 verify_activation.py preflight --receipt $Receipt }
  else { & $Python.Source verify_activation.py preflight --receipt $Receipt }
  if ($LASTEXITCODE -ne 0) { throw "Preflight verification failed with exit code $LASTEXITCODE." }
  Write-Host ''
  Write-Host 'FAISReady stable-host preflight: PASS' -ForegroundColor Green
  Write-Host "Receipt: $Receipt"
}
finally { Pop-Location }
