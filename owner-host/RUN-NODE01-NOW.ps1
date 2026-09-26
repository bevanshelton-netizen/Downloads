#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Is-Admin {
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $principal=New-Object System.Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

if(-not (Is-Admin)){
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$state=Join-Path $env:ProgramData 'IZAKHONO\NODE01-NOW'
New-Item -ItemType Directory -Force -Path $state | Out-Null
$log=Join-Path $state 'NODE01-NOW.log'
$owner=Join-Path $state 'START-IZAKHONO-OWNER-HOST.ps1'
$status=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-NODE01-NOW-RESULT.txt'

Start-Transcript -Path $log -Append | Out-Null
try {
  Write-Host ''
  Write-Host 'IZAKHONO NODE01 — START NOW' -ForegroundColor Cyan
  Write-Host 'Fetching the latest owner-host bootstrap from canonical main...' -ForegroundColor Cyan

  Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1' -OutFile $owner
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $owner
  $ownerExit=$LASTEXITCODE
  if($ownerExit -ne 0){ throw "Owner-host bootstrap exited with code $ownerExit." }

  $nodeRaw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS --max-time 10 http://127.0.0.1:8940/health 2>/dev/null || true") -join [Environment]::NewLine
  if(-not $nodeRaw.Trim()){ throw 'NODE01 health endpoint is still unavailable after owner-host bootstrap.' }
  $node=$nodeRaw | ConvertFrom-Json
  if($node.ok -ne $true -or
     $node.service -ne 'izakhono-node01' -or
     $node.authority -ne 'IZAKHONO' -or
     $node.execution_class -ne 'IZAKHONO_SOVEREIGN_NODE' -or
     $node.external_runtime_dependency -ne $false -or
     $node.public_live_claim -ne $false){
    throw 'NODE01 health contract did not pass.'
  }

  $runner=((& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "if [ -s /opt/izakhono-actions-runner/.service ] && systemctl is-active --quiet $(cat /opt/izakhono-actions-runner/.service); then echo ACTIVE; else echo INACTIVE_OR_UNREGISTERED; fi") -join '').Trim()
  $autopilotRaw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/node01-autopilot.json 2>/dev/null || true") -join [Environment]::NewLine
  $autopilot='NO_RECEIPT'
  if($autopilotRaw.Trim()){
    try {
      $a=$autopilotRaw | ConvertFrom-Json
      $autopilot="RECEIPT_PRESENT; NODE01_LOCAL=$($a.node01_local); YHVH_ENGINE=$($a.yhvh_engine_local); YHVH_CHANNEL=$($a.yhvh_channel_local)"
    } catch {
      $autopilot='RECEIPT_INVALID'
    }
  }

  @(
    'IZAKHONO NODE01 — START NOW RESULT'
    "Generated: $(Get-Date -Format o)"
    'Result: NODE01 LOCAL VERIFIED'
    "Node instance: $($node.node_instance)"
    "Authority: $($node.authority)"
    "Execution class: $($node.execution_class)"
    "Required services healthy: $($node.components.required_healthy)/$($node.components.required_total)"
    "Runner: $runner"
    "Autopilot: $autopilot"
    'Public live claim: false'
    'Independent public HTTPS verification required: true'
    'External resilience preserved: true'
    "Log: $log"
  ) | Set-Content -Path $status -Encoding UTF8

  Write-Host ''
  Write-Host 'NODE01 LOCAL: VERIFIED' -ForegroundColor Green
  Write-Host "Runner: $runner" -ForegroundColor Green
  Write-Host "Result file: $status" -ForegroundColor Cyan
}
catch {
  @(
    'IZAKHONO NODE01 — START NOW RESULT'
    "Generated: $(Get-Date -Format o)"
    'Result: FAILED_TO_VERIFY_NODE01'
    "Error: $($_.Exception.Message)"
    'Public DNS changed: false'
    'Payment routing changed: false'
    "Log: $log"
  ) | Set-Content -Path $status -Encoding UTF8
  Write-Host ''
  Write-Host "NODE01 start failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Result file: $status" -ForegroundColor Yellow
  exit 20
}
finally {
  try { Stop-Transcript | Out-Null } catch {}
}
