#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  $p = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit $p.ExitCode
}

$report = Join-Path ([Environment]::GetFolderPath("Desktop")) "IZAKHONO-PORTFOLIO-GO-LIVE-REPORT.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Log([string]$Text) {
  $lines.Add($Text)
  Write-Host $Text
}
function Save-Report {
  $lines | Set-Content -LiteralPath $report -Encoding UTF8
}
function Stop-With([int]$Code,[string]$Message) {
  Log ""
  Log ("RESULT: BLOCKED ({0})" -f $Code)
  Log $Message
  Log ("Report: {0}" -f $report)
  Save-Report
  exit $Code
}

Log "IZAKHONO OWNED PORTFOLIO GO-LIVE"
Log ("Started: {0}" -f (Get-Date).ToString("s"))
Log "Path: IZAKHONO CODE -> RUNTIME -> EDGE/TLS -> PUBLIC INTERNET"
Log "Platforms: KORA Gospel TV, KORA Kids, IZAKHONO Revenue Desk, Memory Mania, Crowne by Netty"
Log ""

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  Stop-With 11 "WSL is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}
$distros = (& wsl.exe --list --quiet 2>$null) -join "`n"
if ($distros -notmatch "Ubuntu-24.04") {
  Stop-With 12 "Ubuntu-24.04 owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first."
}

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
bash izakhono-owned-cloud/migrate-source-to-code.sh

export KORA_GOSPEL_TV_HOSTNAME='gospel.domains.izakhonoafrica.co.za'
export KORA_KIDS_HOSTNAME='korakids.domains.izakhonoafrica.co.za'
export IZAKHONO_REVENUE_HOSTNAME='revenue.domains.izakhonoafrica.co.za'
export MEMORY_MANIA_HOSTNAME='memorymania.domains.izakhonoafrica.co.za'
export CROWNE_HAIR_HOSTNAME='hair.domains.izakhonoafrica.co.za'

echo "=== DEPLOY KORA GOSPEL TV ==="
bash izakhono-owned-cloud/deploy-kora-gospel-tv.sh main

echo "=== DEPLOY KORA KIDS ==="
bash izakhono-owned-cloud/deploy-kora-kids.sh main

echo "=== DEPLOY IZAKHONO REVENUE DESK ==="
bash izakhono-owned-cloud/deploy-revenue-desk.sh main

echo "=== DEPLOY MEMORY MANIA ==="
bash izakhono-owned-cloud/deploy-memory-mania.sh main

echo "=== DEPLOY CROWNE BY NETTY ==="
bash izakhono-owned-cloud/deploy-crowne-hair.sh main

echo "=== ACTIVATE SHARED IZAKHONO PUBLIC EDGE ==="
export IZAKHONO_PUBLIC_ZONE='domains.izakhonoafrica.co.za'
export IZAKHONO_PUBLIC_HOSTNAME='gospel.domains.izakhonoafrica.co.za'
bash izakhono-owned-cloud/activate-owned-public-edge.sh
"@

Log "Deploying all five platforms to IZAKHONO RUNTIME..."
$linux | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
$code = $LASTEXITCODE

if ($code -eq 20) {
  Stop-With 20 "All runtime deployments completed, but the one-time parent DNS/router cutover is still required. Apply the A/NS and port-forward values printed above, then rerun this launcher."
}
if ($code -eq 21) {
  Stop-With 21 "Owned DNS delegation is visible, but inbound TCP 80/443 or trusted TLS is not complete."
}
if ($code -ne 0) {
  Stop-With $code ("Owned portfolio deployment/edge activation failed with code {0}." -f $code)
}

Log "IZAKHONO RUNTIME + SHARED EDGE: PASS"
Log ""

$targets = @(
  @{ Name="KORA GOSPEL TV"; Host="gospel.domains.izakhonoafrica.co.za"; Service="kora-gospel-tv" },
  @{ Name="KORA KIDS"; Host="korakids.domains.izakhonoafrica.co.za"; Service="kora-kids" },
  @{ Name="IZAKHONO REVENUE DESK"; Host="revenue.domains.izakhonoafrica.co.za"; Service="izakhono-revenue-desk" },
  @{ Name="MEMORY MANIA"; Host="memorymania.domains.izakhonoafrica.co.za"; Service="memory-mania" },
  @{ Name="CROWNE BY NETTY"; Host="hair.domains.izakhonoafrica.co.za"; Service="crowne-hair" }
)

foreach ($t in $targets) {
  Log ("Verifying {0}..." -f $t.Name)
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 ("https://{0}/health" -f $t.Host)
    if ($r.StatusCode -ne 200) {
      Stop-With 30 ("{0} /health returned HTTP {1}." -f $t.Name,$r.StatusCode)
    }
    $h = $r.Content | ConvertFrom-Json
    if ($h.ok -ne $true -or $h.service -ne $t.Service) {
      Stop-With 31 ("{0} health identity mismatch." -f $t.Name)
    }
    Log ("{0}: PUBLIC HTTPS VERIFIED" -f $t.Name)
  } catch {
    Stop-With 32 ("{0} public verification failed: {1}" -f $t.Name,$_.Exception.Message)
  }
}

Log ""
Log "RESULT: LIVE"
Log "IZAKHONO PORTFOLIO: PUBLIC HTTPS LIVE AND VERIFIED"
Log "https://gospel.domains.izakhonoafrica.co.za"
Log "https://korakids.domains.izakhonoafrica.co.za"
Log "https://revenue.domains.izakhonoafrica.co.za"
Log "https://memorymania.domains.izakhonoafrica.co.za"
Log "https://hair.domains.izakhonoafrica.co.za"
Log ("Completed: {0}" -f (Get-Date).ToString("s"))
Log ("Report: {0}" -f $report)
Save-Report

Start-Process "https://gospel.domains.izakhonoafrica.co.za"
exit 0
