#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = "gospel.domains.izakhonoafrica.co.za",
  [string]$ExternalBase = "https://kora-network.vercel.app"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ownedLauncher = Join-Path $PSScriptRoot "START-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"
if (-not (Test-Path $ownedLauncher)) { throw "Owned Gospel launcher not found: $ownedLauncher" }

Write-Host ""
Write-Host "YHVH GOSPEL TV - HYBRID ACTIVATION" -ForegroundColor Yellow
Write-Host "Primary: IZAKHONO owned infrastructure" -ForegroundColor Cyan
Write-Host "External: KORA/Vercel + public fallback + Supabase intake" -ForegroundColor Cyan
Write-Host ""

$ownedExit = 99
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ownedLauncher -Hostname $Hostname
  $ownedExit = $LASTEXITCODE
} catch {
  Write-Host "Owned activation threw an error: $($_.Exception.Message)" -ForegroundColor Yellow
}

function Probe-Json([string]$Url, [int]$Timeout = 12) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec $Timeout -Uri $Url -Headers @{"cache-control"="no-cache"}
    return [pscustomobject]@{ ok=$true; status=[int]$r.StatusCode; body=($r.Content | ConvertFrom-Json) }
  } catch {
    return [pscustomobject]@{ ok=$false; status=$null; body=$null; error=$_.Exception.Message }
  }
}

function Probe-Web([string]$Url, [int]$Timeout = 12) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec $Timeout -Uri $Url -Headers @{"cache-control"="no-cache"}
    return [pscustomobject]@{ ok=([int]$r.StatusCode -ge 200 -and [int]$r.StatusCode -lt 400); status=[int]$r.StatusCode }
  } catch {
    return [pscustomobject]@{ ok=$false; status=$null; error=$_.Exception.Message }
  }
}

$hybrid = Probe-Json "$ExternalBase/api/gospel/hybrid-status"
$kora = Probe-Web "$ExternalBase/gospel"
$pages = Probe-Web "https://bevanshelton-netizen.github.io/Downloads/kora-gospel-tv/"
$owned = Probe-Json "https://$Hostname/health"

$hybridIdentity = $false
if ($hybrid.ok -and $null -ne $hybrid.body) {
  $hybridIdentity = ($hybrid.body.service -eq "kora-gospel-hybrid-gateway" -and $hybrid.body.authority -eq "IZAKHONO")
}

$report = [ordered]@{
  schema = "izakhono.kora-gospel-hybrid-verification/v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  authority = "IZAKHONO"
  routing_policy = "owned-first-external-fallback"
  owned = [ordered]@{
    hostname = $Hostname
    launcher_exit = $ownedExit
    public_health = $owned.ok
    service = if ($owned.ok) { $owned.body.service } else { $null }
    runtime = if ($owned.ok) { $owned.body.runtime } else { $null }
  }
  external = [ordered]@{
    kora = $kora.ok
    hybrid_status = $hybridIdentity
    selected_route = if ($hybridIdentity) { $hybrid.body.selected_route } else { $null }
    public_mirror = $pages.ok
  }
  overall = if (($owned.ok -or $hybridIdentity) -and $kora.ok) { "AVAILABLE" } else { "DEGRADED" }
}

$out = Join-Path ([Environment]::GetFolderPath("Desktop")) "KORA-GOSPEL-HYBRID-REPORT.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $out

Write-Host ""
Write-Host "HYBRID REPORT" -ForegroundColor Yellow
Write-Host "Owned public health: $($owned.ok)"
Write-Host "KORA external:      $($kora.ok)"
Write-Host "Hybrid gateway:     $($hybridIdentity)"
Write-Host "Public mirror:      $($pages.ok)"
if ($hybridIdentity) { Write-Host "Selected route:     $($hybrid.body.selected_route)" -ForegroundColor Green }
Write-Host "Report:             $out" -ForegroundColor Cyan

if ($hybridIdentity -and $kora.ok) {
  Start-Process "$ExternalBase/gospel/live"
  exit 0
}
if ($ownedExit -eq 20) { exit 20 }
if ($ownedExit -eq 21) { exit 21 }
exit 22
