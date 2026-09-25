#requires -Version 5.1
[CmdletBinding()]
param([string]$Hostname = "commands.domains.izakhonoafrica.co.za")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "IZAKHONO COMMAND CENTRE - OWNED INFRASTRUCTURE" -ForegroundColor Cyan
Write-Host "CONTROL -> NODE -> RUNTIME -> EDGE/TLS" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = @(& wsl.exe --list --quiet 2>$null | ForEach-Object { ($_ -replace "`0",'').Trim() } | Where-Object { $_ })
$Distro = if ($distros -contains "Ubuntu-24.04") { "Ubuntu-24.04" } elseif ($distros -contains "Ubuntu") { "Ubuntu" } else { $null }
if (-not $Distro) {
  throw "IZAKHONO owner-host Ubuntu is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

$escapedHost = $Hostname.Replace("'","''")
$linux = @"
set -euo pipefail
DOWNLOADS=/opt/izakhono-source/Downloads
BUILDER=/opt/izakhono-source/izakhono-builder

cd "$DOWNLOADS"
if [ -n "$(git status --porcelain)" ]; then
  echo "Downloads owner-host checkout has local changes; refusing to overwrite." >&2
  exit 3
fi
git fetch origin main
git checkout main
git reset --hard origin/main

if [ ! -d "$BUILDER/.git" ]; then
  git clone --filter=blob:none https://github.com/bevanshelton-netizen/izakhono-builder.git "$BUILDER"
else
  if [ -n "$(git -C "$BUILDER" status --porcelain)" ]; then
    echo "IZAKHONO Builder checkout has local changes; refusing to overwrite." >&2
    exit 4
  fi
  git -C "$BUILDER" fetch origin main
  git -C "$BUILDER" checkout main
  git -C "$BUILDER" reset --hard origin/main
fi

echo "[1/6] Ensuring NODE + CONTROL are active..."
bash "$BUILDER/products/izakhono-node/install.sh"

echo "[2/6] Synchronising Builder into IZAKHONO CODE..."
bash "$BUILDER/products/izakhono-node/sync-builder-to-code.sh" "$BUILDER"

echo "[3/6] Starting the owned Command Gateway..."
bash "$BUILDER/internal/node01-command-gateway/install-owned-gateway.sh"

echo "[4/6] Ensuring Downloads source is in IZAKHONO CODE..."
cd "$DOWNLOADS"
bash izakhono-owned-cloud/migrate-source-to-code.sh

echo "[5/6] Registering Command Centre with IZAKHONO RUNTIME..."
export IZAKHONO_COMMANDS_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/deploy-command-centre.sh main

echo "[6/6] Verifying local owned route..."
curl -fsS -H "Host: $escapedHost" http://127.0.0.1:8080/health
echo
"@

$linux | & wsl.exe -d $Distro -u root -- bash -s
if ($LASTEXITCODE -ne 0) {
  throw "IZAKHONO Command Centre owned deployment failed."
}

$publicUrl = "https://$Hostname"
$publicVerified = $false
try {
  $health = Invoke-RestMethod -Uri "$publicUrl/health" -TimeoutSec 12
  if ($health.ok -eq $true -and $health.service -eq "izakhono-command-centre-edge") {
    $publicVerified = $true
  }
} catch {
  Write-Host "Public HTTPS is not verified yet. Activating IZAKHONO-owned DNS/EDGE..." -ForegroundColor Yellow
}

if (-not $publicVerified) {
  $edge = @"
set -euo pipefail
cd /opt/izakhono-source/Downloads
export IZAKHONO_PUBLIC_ZONE='domains.izakhonoafrica.co.za'
export IZAKHONO_PUBLIC_HOSTNAME='$escapedHost'
bash izakhono-owned-cloud/activate-owned-public-edge.sh
"@
  $edge | & wsl.exe -d $Distro -u root -- bash -s
  $edgeCode = $LASTEXITCODE
  if ($edgeCode -eq 20) {
    Write-Host "Owned runtime is ready. One-time parent DNS/router cutover is still required." -ForegroundColor Yellow
    exit 20
  }
  if ($edgeCode -eq 21) {
    Write-Host "Owned DNS is visible; TCP 80/443 or trusted TLS still needs to complete." -ForegroundColor Yellow
    exit 21
  }
  if ($edgeCode -ne 0) { throw "Owned EDGE activation failed with code $edgeCode." }

  $health = Invoke-RestMethod -Uri "$publicUrl/health" -TimeoutSec 12
  if ($health.ok -ne $true -or $health.service -ne "izakhono-command-centre-edge") {
    throw "Public Command Centre health verification failed."
  }
  $publicVerified = $true
}

$ownerToken = (& wsl.exe -d $Distro -u root -- bash -lc "cat /etc/izakhono/commands.owner-token") -join ""
if (-not $ownerToken.Trim()) { throw "Owner Command credential is unavailable." }

$desktop = [Environment]::GetFolderPath("Desktop")
$report = Join-Path $desktop "IZAKHONO-COMMAND-CENTRE-PUBLIC-STATUS.txt"
@(
  "IZAKHONO COMMAND CENTRE"
  "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
  "Hostname: $Hostname"
  "Owned runtime: VERIFIED"
  "CONTROL: 127.0.0.1:9292"
  "NODE: 127.0.0.1:9191"
  "Command Gateway: 127.0.0.1:8091"
  "RUNTIME proxy: 127.0.0.1:8080"
  "Public HTTPS verified: $publicVerified"
  "External resilience: Supabase Edge"
) | Set-Content -Path $report -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host "IZAKHONO COMMAND CENTRE: OWNED PUBLIC ROUTE VERIFIED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host $publicUrl -ForegroundColor Green
Write-Host "Status report: $report" -ForegroundColor Cyan

Start-Process "$publicUrl/commands#owner=$($ownerToken.Trim())"
exit 0
