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

# Portfolio directive 26 Sep 2026: the owner laptop is ADMIN CLIENT ONLY.
# Production runtime, deployment runners, NODE roles, queues, data-plane services,
# DNS/TLS/EDGE and background platform availability must run on IZAKHONO infrastructure.
$PolicyStatus = Join-Path ([Environment]::GetFolderPath("Desktop")) "IZAKHONO-LAPTOP-ROLE.txt"
@(
  "IZAKHONO LAPTOP ROLE"
  "Generated: $(Get-Date -Format o)"
  "Role: ADMIN CLIENT ONLY"
  "Runtime authority: IZAKHONO_INFRASTRUCTURE"
  "Laptop runtime dependency: false"
  "Laptop deployment target: false"
  "Laptop data plane: false"
  "Production runner label: izakhono-infrastructure"
  "Action: BLOCKED_LEGACY_LAPTOP_RUNTIME"
) | Set-Content -Path $PolicyStatus -Encoding UTF8
Write-Host ""
Write-Host "IZAKHONO LAPTOP: ADMIN CLIENT ONLY" -ForegroundColor Green
Write-Host "Platform runtime/deployment on this laptop is blocked by portfolio policy." -ForegroundColor Yellow
Write-Host "Use IZAKHONO infrastructure for NODE01 and all production execution." -ForegroundColor Cyan
Write-Host "Status: $PolicyStatus" -ForegroundColor Cyan
exit 0


if(-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)){
  throw 'WSL is unavailable. Use a dedicated Ubuntu/Debian host for production NODE01, or install WSL first.'
}

$distros=(& wsl.exe --list --quiet 2>$null) -join [Environment]::NewLine
if($distros -notmatch 'Ubuntu-24.04'){
  Write-Host 'Installing Ubuntu 24.04 for the current NODE01 host...' -ForegroundColor Yellow
  & wsl.exe --install -d Ubuntu-24.04 --no-launch
  if($LASTEXITCODE -ne 0){ throw 'Ubuntu installation could not complete. A Windows restart may be required.' }
}

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
& wsl.exe --shutdown
Start-Sleep -Seconds 3

$bootstrap=@'
set -euo pipefail
if [ ! -d /opt/izakhono-source/Downloads/.git ]; then
  mkdir -p /opt/izakhono-source
  git clone https://github.com/bevanshelton-netizen/Downloads.git /opt/izakhono-source/Downloads
fi
cd /opt/izakhono-source/Downloads
if [ -n "$(git status --porcelain)" ]; then
  echo "Local IZAKHONO source changes exist; refusing destructive refresh." >&2
  exit 20
fi
git fetch origin main
git checkout -q main
git reset --hard -q origin/main
bash BUILD-IZAKHONO-NODE01.sh
'@

$bootstrap | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if($LASTEXITCODE -ne 0){ throw "NODE01 build returned exit code $LASTEXITCODE." }

$status=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS http://127.0.0.1:8940/v1/status") -join [Environment]::NewLine
$desktop=[Environment]::GetFolderPath('Desktop')
$path=Join-Path $desktop 'IZAKHONO-NODE01-STATUS.json'
$status | Set-Content -Path $path -Encoding UTF8

Write-Host ''
Write-Host 'IZAKHONO NODE01: BUILT ON CURRENT OWNER HOST' -ForegroundColor Green
Write-Host 'Authority: IZAKHONO' -ForegroundColor Green
Write-Host 'External runtime dependency: false' -ForegroundColor Green
Write-Host "Status: $path" -ForegroundColor Cyan
Write-Host 'For primary production, migrate the same NODE01 package to dedicated Linux hardware when ready.' -ForegroundColor Yellow
