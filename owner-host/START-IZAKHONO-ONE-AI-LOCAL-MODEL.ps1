#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Model = "qwen2.5:3b",
  [string]$Hostname = "one.domains.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "IZAKHONO ONE AI — LOCAL MODEL ACTIVATION" -ForegroundColor Cyan
Write-Host "Model: $Model" -ForegroundColor Cyan
Write-Host "Target: ISN-01 -> AI GATEWAY -> GPU COMPUTE -> MODEL WORKER -> LOCAL MODEL" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") {
  throw "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$escapedModel = $Model.Replace("'","''")
$escapedHost = $Hostname.Replace("'","''")

$linux = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "`$(git status --porcelain)" ]; then
  echo "Owner-host source checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main
export IZAKHONO_ONE_AI_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/activate-local-model-engine.sh '$escapedModel'
"@

$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "IZAKHONO ONE local-model activation failed."
}

$desktop = [Environment]::GetFolderPath("Desktop")
$report = Join-Path $desktop "IZAKHONO-ONE-LOCAL-MODEL-REPORT.json"
$status = Join-Path $desktop "IZAKHONO-ONE-LOCAL-MODEL-STATUS.txt"

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/izakhono-one-local-model.json" | Set-Content -Path $report -Encoding UTF8
if ($LASTEXITCODE -ne 0) {
  throw "Activation succeeded but the model receipt could not be copied."
}

$json = Get-Content $report -Raw | ConvertFrom-Json
@(
  "IZAKHONO ONE AI — LOCAL MODEL STATUS"
  "Generated: $($json.generated_at)"
  "Model: $($json.model)"
  "Compute mode: $($json.compute_mode)"
  "Chat ready: $($json.chat_ready)"
  "Public signup: $($json.public_signup)"
  "Public HTTPS: $($json.public_https)"
  "Hostname: $($json.hostname)"
  ""
  "The local engine is private on 127.0.0.1 and remains behind IZAKHONO AI GATEWAY/GPU COMPUTE."
  "Public signup requires a verified SMTP transport."
) | Set-Content -Path $status -Encoding UTF8

Write-Host ""
Write-Host "IZAKHONO ONE LOCAL MODEL: ACTIVATED" -ForegroundColor Green
Write-Host "Chat ready: $($json.chat_ready)" -ForegroundColor Green
Write-Host "Public signup: $($json.public_signup)" -ForegroundColor Yellow
Write-Host "Public HTTPS: $($json.public_https)" -ForegroundColor Yellow
Write-Host "Desktop report: $report" -ForegroundColor Cyan
Write-Host "Desktop status: $status" -ForegroundColor Cyan
