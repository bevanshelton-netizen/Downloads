#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "gospel.domains.izakhonoafrica.co.za")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Admin {
  $id=[Security.Principal.WindowsIdentity]::GetCurrent()
  $p=New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not (Test-Admin)) {
  $proc=Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"')
  exit $proc.ExitCode
}

$State=Join-Path $env:ProgramData "IZAKHONO\ISN-01"
New-Item -ItemType Directory -Force -Path $State | Out-Null
$Report=Join-Path ([Environment]::GetFolderPath("Desktop")) "YHVH-GOSPEL-TV-FINAL-LAUNCH-REPORT.txt"
$Base="https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main"
$Start=Join-Path $State "START-YHVH-GOSPEL-TV-ON-IZAKHONO.ps1"
$Verify=Join-Path $State "VERIFY-YHVH-GOSPEL-TV-PUBLIC.ps1"
$Lines=New-Object System.Collections.Generic.List[string]
function Log([string]$Text){$Lines.Add($Text);Write-Host $Text}
function Save{$Lines|Set-Content -LiteralPath $Report -Encoding UTF8}
function Finish([int]$Code,[string]$Text){Log "";Log $Text;Log ("Report: {0}" -f $Report);Save;exit $Code}

Log "YHVH GOSPEL TV — FINAL HYBRID LAUNCH"
Log ("Started: {0}" -f (Get-Date).ToString("s"))
Log "Preferred path: IZAKHONO DNS/EDGE direct. Fallback path: outbound tunnel to IZAKHONO-owned origin."

Invoke-WebRequest -UseBasicParsing "$Base/owner-host/START-YHVH-GOSPEL-TV-ON-IZAKHONO.ps1" -OutFile $Start
Invoke-WebRequest -UseBasicParsing "$Base/owner-host/VERIFY-YHVH-GOSPEL-TV-PUBLIC.ps1" -OutFile $Verify

Log ""
Log "1/3 DEPLOY OWNED YHVH RUNTIME + TRY DIRECT EDGE"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Start -Hostname $Hostname
$Direct=$LASTEXITCODE
if ($Direct -eq 0) {
  Log "Direct owned public edge: PASS"
} elseif ($Direct -eq 20 -or $Direct -eq 21) {
  Log ("Direct edge is not publicly complete (code {0}). Switching to outbound last-mile bridge." -f $Direct)
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { Finish 12 "WSL is unavailable; cannot start the IZAKHONO outbound bridge." }
  $linux=@'
set -euo pipefail
cd /opt/izakhono-source/Downloads
if [ -n "$(git status --porcelain)" ]; then echo "Owner-host source checkout has local changes; refusing to overwrite." >&2; exit 3; fi
git fetch origin main
git checkout main
git reset --hard origin/main
export YHVH_PUBLIC_HOSTNAME="__HOST__"
bash izakhono-owned-cloud/start-yhvh-outbound-bridge.sh
'@
  $linux=$linux.Replace("__HOST__",$Hostname.Replace('"',''))
  $linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
  $Bridge=$LASTEXITCODE
  if ($Bridge -eq 30) { Finish 30 "The bridge code is installed, but this machine has no protected Cloudflare tunnel/API credential yet." }
  if ($Bridge -ne 0) { Finish $Bridge ("Outbound bridge failed with code {0}." -f $Bridge) }
  Log "Outbound bridge: PASS"
} else {
  Finish $Direct ("Owned runtime/direct-edge stage failed with code {0}." -f $Direct)
}

Log ""
Log "2/3 INDEPENDENT PUBLIC HEALTH + BRAND VERIFICATION"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Verify -Hostname $Hostname
if ($LASTEXITCODE -ne 0) { Finish $LASTEXITCODE "Public verification did not pass." }
Log "Public verification: PASS"

Log ""
Log "3/3 HYBRID RESILIENCE POSITION"
Log "IZAKHONO-owned origin: LIVE VERIFIED"
Log "External distribution/resilience: KEEP ACTIVE (Vercel + GitHub Pages)"
Log "Routing policy: owned-first, external fallback"
Log ""
Log "RESULT: HYBRID PRODUCTION LIVE VERIFIED"
Log ("URL: https://{0}" -f $Hostname)
Log ("Completed: {0}" -f (Get-Date).ToString("s"))
Save
Start-Process ("https://{0}" -f $Hostname)
exit 0
