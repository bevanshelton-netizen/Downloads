#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Is-Admin {
  $id=[Security.Principal.WindowsIdentity]::GetCurrent()
  $p=New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if(-not (Is-Admin)){
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$requiredCommit='3d115c5ae5c092beb7011622fdda1534f885e68a'
$state=Join-Path $env:ProgramData 'IZAKHONO\CRM-V020'
New-Item -ItemType Directory -Force -Path $state | Out-Null
$desktop=[Environment]::GetFolderPath('Desktop')
if(-not $desktop){$desktop=$state}
$report=Join-Path $desktop 'IZAKHONO-CRM-V020-GO-LIVE-STATUS.txt'

function Run-WSL([string]$Command){
  & wsl.exe -d Ubuntu-24.04 -u root -- bash -lc $Command
  if($LASTEXITCODE -ne 0){ throw "WSL command failed with exit code $LASTEXITCODE." }
}

Write-Host ''
Write-Host 'IZAKHONO CRM v0.2.0 — OWNED ACTIVATION' -ForegroundColor Cyan
Write-Host 'Authority: IZAKHONO owner host / NODE01 role' -ForegroundColor Cyan
Write-Host 'External resilience: preserved' -ForegroundColor Green
Write-Host 'Public CRM exposure: prohibited' -ForegroundColor Yellow
Write-Host ''

if(-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)){
  throw 'WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd once on this machine.'
}
$distros=(& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if($distros -notmatch 'Ubuntu-24.04'){
  throw 'Ubuntu-24.04 owner-host environment is not installed. Run START-IZAKHONO-OWNER-HOST.cmd once.'
}

Write-Host '[1/6] Starting owned Linux environment...' -ForegroundColor Cyan
Run-WSL "systemctl is-system-running --wait >/dev/null 2>&1 || true"

Write-Host '[2/6] Synchronising canonical owner controls...' -ForegroundColor Cyan
Run-WSL "set -euo pipefail; ROOT=/opt/izakhono-source/Downloads; test -d \"\$ROOT/.git\"; test -z \"\$(git -C \"\$ROOT\" status --porcelain)\"; git -C \"\$ROOT\" fetch -q origin main; git -C \"\$ROOT\" checkout -q main; git -C \"\$ROOT\" reset --hard -q origin/main"

Write-Host '[3/6] Executing allow-listed CRM deployment...' -ForegroundColor Cyan
Run-WSL "set -euo pipefail; ROOT=/opt/izakhono-source/Downloads; CONTROL=\"\$ROOT/owner-host/control/crm-v020-desired-state.json\"; RID=\$(node -e 'const x=require(process.argv[1]);if(x.schema!==\"izakhono.crm-v020.owner-request/v1\"||x.enabled!==true||x.crm_version!==\"0.2.0\"||x.public_cutover!==false||x.external_resilience_preserve!==true)process.exit(2);process.stdout.write(x.id)' \"\$CONTROL\"); IZAKHONO_CRM_REQUEST_ID=\"\$RID\" bash \"\$ROOT/owner-host/deploy-crm-v020.sh\""

Write-Host '[4/6] Verifying owned CRM + APP FABRIC health...' -ForegroundColor Cyan
Run-WSL "set -euo pipefail; BUILDER=/opt/izakhono-source/izakhono-builder; git -C \"\$BUILDER\" merge-base --is-ancestor $requiredCommit HEAD; bash \"\$BUILDER/infra/app-fabric-runtime/verify-node01.sh\"; jq -e '.overall==\"PASS_INTERNAL_OWNED\" and .crm.health==\"healthy\" and .fabric.health==\"healthy\" and .public_cutover_performed==false' /opt/izakhono/evidence/IZAKHONO-CRM-V020-NODE01-REPORT.json >/dev/null"

Write-Host '[5/6] Recording owned completion notification...' -ForegroundColor Cyan
Run-WSL "set -euo pipefail; ROOT=/opt/izakhono-source/Downloads; bash \"\$ROOT/owner-host/notify-crm-v020-completion.sh\" || true"

Write-Host '[6/6] Restoring owner automation services...' -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "if [ -s /opt/izakhono-actions-runner/.service ]; then systemctl start $(cat /opt/izakhono-actions-runner/.service) || true; fi; cd /opt/izakhono-source/Downloads && bash owner-host/node01-autopilot.sh || true" | Out-Host

$receiptRaw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/crm-v020.json 2>/dev/null || true") -join [Environment]::NewLine
$evidenceRaw=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /opt/izakhono/evidence/IZAKHONO-CRM-V020-NODE01-REPORT.json 2>/dev/null || true") -join [Environment]::NewLine
if(-not $receiptRaw.Trim()){ throw 'CRM deployment receipt is missing.' }
if(-not $evidenceRaw.Trim()){ throw 'CRM deployment evidence is missing.' }

$receipt=$receiptRaw | ConvertFrom-Json
$evidence=$evidenceRaw | ConvertFrom-Json
if($receipt.status -ne 'success'){ throw "CRM deployment receipt is not successful: $($receipt.status)" }
if($receipt.external_resilience_preserved -ne $true){ throw 'External resilience preservation contract failed.' }
if($receipt.public_cutover_performed -ne $false){ throw 'Unexpected public cutover was recorded.' }
if($evidence.overall -ne 'PASS_INTERNAL_OWNED'){ throw "Internal owned proof failed: $($evidence.overall)" }
if($evidence.crm.health -ne 'healthy' -or $evidence.fabric.health -ne 'healthy'){ throw 'CRM or APP FABRIC is not healthy.' }

@(
  'IZAKHONO CRM v0.2.0 — GO-LIVE STATUS'
  "Generated: $(Get-Date -Format o)"
  'Authority: IZAKHONO OWNED / NODE01 ROLE'
  "Request: $($receipt.request_id)"
  "Source commit: $($receipt.source_commit)"
  "CRM version: $($receipt.crm_version)"
  'CRM owned internal runtime: LIVE / HEALTHY'
  'APP FABRIC owned internal runtime: LIVE / HEALTHY'
  'CRM direct public exposure: NO'
  'APP FABRIC public intake: FAIL-CLOSED'
  'External resilience: PRESERVED'
  'Tracking/profiling change: NONE'
  'Public cutover performed: NO'
  "Evidence: $($receipt.evidence_path)"
  ''
  'NEXT PUBLIC GATE'
  'APP FABRIC may be promoted only after an approved hostname resolves to IZAKHONO EDGE/TLS, exact platform origins are allow-listed, and a real scoped event is independently verified.'
) | Set-Content -Path $report -Encoding UTF8

Write-Host ''
Write-Host '============================================================' -ForegroundColor DarkCyan
Write-Host 'IZAKHONO CRM v0.2.0: OWNED INTERNAL LIVE / VERIFIED' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor DarkCyan
Write-Host 'CRM remains private. APP FABRIC remains fail-closed for public intake.' -ForegroundColor Yellow
Write-Host "Status report: $report" -ForegroundColor Cyan
