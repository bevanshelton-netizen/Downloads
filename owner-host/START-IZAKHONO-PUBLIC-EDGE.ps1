#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"

function Is-Admin {
  $id=[Security.Principal.WindowsIdentity]::GetCurrent()
  $p=New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if(-not (Is-Admin)){
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$state=Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$owner=Join-Path $state "START-IZAKHONO-OWNER-HOST.ps1"
if(-not (Test-Path $owner)){
  Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1' -OutFile $owner
}
$distros=(& wsl.exe --list --quiet 2>$null) -join "`n"
if($distros -notmatch 'Ubuntu-24.04'){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $owner
  if($LASTEXITCODE -ne 0){ throw "Owner-host bootstrap did not complete." }
}

Write-Host "Activating IZAKHONO-owned DNS and direct PUBLIC EDGE..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -n \"$(git status --porcelain)\" ]; then echo 'Owner-host checkout has local changes; refusing update.' >&2; exit 3; fi; git fetch origin main; git checkout main; git reset --hard origin/main; bash izakhono-owned-cloud/activate-owned-public-edge.sh"
$code=$LASTEXITCODE

$desktop=[Environment]::GetFolderPath("Desktop")
if(-not $desktop){$desktop=$state}
$handoff=Join-Path $desktop "IZAKHONO-PARENT-DNS-HANDOFF.txt"

$receiptRaw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/owned-public-edge.json 2>/dev/null || true") -join [Environment]::NewLine
$receipt=$null
if($receiptRaw.Trim()){
  try{$receipt=$receiptRaw | ConvertFrom-Json}catch{$receipt=$null}
}

$handoffLines=New-Object System.Collections.Generic.List[string]
$handoffLines.Add("IZAKHONO PARENT DNS / PUBLIC EDGE HANDOFF")
$handoffLines.Add("Generated: $(Get-Date -Format o)")
$handoffLines.Add("Primary owned zone: domains.izakhonoafrica.co.za")
$handoffLines.Add("ONE hostname: one.domains.izakhonoafrica.co.za")
$handoffLines.Add("External resilience: PRESERVED")
$handoffLines.Add("")

if($receipt){
  $handoffLines.Add("Owner LAN IPv4: $($receipt.owner_host_lan_ipv4)")
  $handoffLines.Add("Owner public IPv4: $($receipt.public_ipv4)")
  $handoffLines.Add("Parent delegation observed: $($receipt.parent_delegation_observed)")
  $handoffLines.Add("TLS ready: $($receipt.tls_ready)")
  $handoffLines.Add("Direct EDGE ready: $($receipt.edge_direct)")
  $handoffLines.Add("")
  $handoffLines.Add("PARENT DNS RECORDS REQUIRED")
  if($receipt.nameservers.Count -ge 1){
    $handoffLines.Add("A  $($receipt.nameservers[0]) -> $($receipt.public_ipv4)")
    $handoffLines.Add("NS domains.izakhonoafrica.co.za -> $($receipt.nameservers[0])")
  }
  if($receipt.nameservers.Count -ge 2){
    $handoffLines.Add("A  $($receipt.nameservers[1]) -> <secondary-public-ip>")
    $handoffLines.Add("NS domains.izakhonoafrica.co.za -> $($receipt.nameservers[1])")
  }
  $handoffLines.Add("")
  $handoffLines.Add("After parent delegation, IZAKHONO DNS publishes:")
  $handoffLines.Add("A  one.domains.izakhonoafrica.co.za -> $($receipt.public_ipv4)")
  foreach($hostName in @($receipt.extra_hostnames)){
    if($hostName -and $hostName -ne "one.domains.izakhonoafrica.co.za"){
      $handoffLines.Add("A  $hostName -> $($receipt.public_ipv4)")
    }
  }
  $handoffLines.Add("")
  $handoffLines.Add("ROUTER / FIREWALL FORWARDING TO OWNER HOST")
  $handoffLines.Add("UDP 53 -> $($receipt.owner_host_lan_ipv4)")
  $handoffLines.Add("TCP 53 -> $($receipt.owner_host_lan_ipv4)")
  $handoffLines.Add("TCP 80 -> $($receipt.owner_host_lan_ipv4)")
  $handoffLines.Add("TCP 443 -> $($receipt.owner_host_lan_ipv4)")
}else{
  $handoffLines.Add("Owned-public-edge receipt not available. Re-run START-IZAKHONO-PUBLIC-EDGE.cmd after owner-host bootstrap.")
}

$handoffLines.Add("")
$handoffLines.Add("PUBLIC VERIFICATION")
$handoffLines.Add("GitHub workflow: IZAKHONO ONE Owned Public Verify")
$handoffLines.Add("Required result before owned-live claim: HTTPS / = 200, /health = 200, ONE health contract passes, tracking=false.")
$handoffLines | Set-Content -Path $handoff -Encoding UTF8

if($code -eq 20){
  Write-Host ""
  Write-Host "IZAKHONO DNS NODE and PUBLIC EDGE are installed and locally verified." -ForegroundColor Green
  Write-Host "Parent DNS delegation and/or router forwarding is still required." -ForegroundColor Yellow
  Write-Host "Desktop handoff: $handoff" -ForegroundColor Cyan
  Start-Process notepad.exe $handoff
  exit 20
}
if($code -eq 21){
  Write-Host ""
  Write-Host "Owned DNS delegation is visible; trusted TLS/direct EDGE still needs public TCP 80/443 reachability." -ForegroundColor Yellow
  Write-Host "Desktop handoff: $handoff" -ForegroundColor Cyan
  Start-Process notepad.exe $handoff
  exit 21
}
if($code -ne 0){ throw "Owned public-edge activation did not complete (code $code)." }

Write-Host ""
Write-Host "IZAKHONO OWNED PUBLIC EDGE: ACTIVATED" -ForegroundColor Green
Write-Host "Desktop handoff: $handoff" -ForegroundColor Cyan
Start-Process "https://domains.izakhonoafrica.co.za"
