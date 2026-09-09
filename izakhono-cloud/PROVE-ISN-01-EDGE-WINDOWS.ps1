#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Distro = 'Ubuntu-24.04'
$RepoUrl = 'https://github.com/bevanshelton-netizen/Downloads.git'
$PinnedControlRef = 'c9a4e61903cc476f2aa5ee85240825f7be080b0d'
$StateDir = Join-Path $env:ProgramData 'IZAKHONO\ISN-01'
$StableScript = Join-Path $StateDir 'PROVE-ISN-01-EDGE-WINDOWS.ps1'
$ProofCopy = Join-Path $StateDir 'EDGE-QUICK-PROOF.json'
$Log = Join-Path $StateDir 'edge-proof.log'

function Fail([string]$Message) { throw $Message }

function Test-Administrator {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Administrator {
  New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
  if ($PSCommandPath -and ((Resolve-Path $PSCommandPath).Path -ne $StableScript)) {
    Copy-Item -LiteralPath $PSCommandPath -Destination $StableScript -Force
  }
  if (Test-Administrator) { return }
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy','Bypass',
    '-File',('"{0}"' -f $StableScript)
  )
  exit 0
}

function Invoke-WslRoot([string]$Command) {
  & wsl.exe -d $Distro -u root -- bash -lc $Command
  if ($LASTEXITCODE -ne 0) {
    Fail "WSL command failed with exit code $LASTEXITCODE."
  }
}

Ensure-Administrator

try { Start-Transcript -Path $Log -Append | Out-Null } catch {}

try {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Fail 'WSL is not installed. Complete START-ISN-01 first.'
  }
  $installed = (& wsl.exe --list --quiet 2>$null | Out-String)
  if ($installed -notmatch [regex]::Escape($Distro)) {
    Fail 'Ubuntu-24.04 is not installed. Complete START-ISN-01 first.'
  }

  Write-Host 'Checking persistent KORA runtime...'
  Invoke-WslRoot @"
set -euo pipefail
test -f /var/lib/izakhono-cloud/SOVEREIGN-NODE.json
test -f /var/lib/izakhono-cloud/runtime/kora-network.json
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:18080/api/health >/dev/null
"@

  Write-Host 'Preparing temporary external edge transport...'
  $proof = @"
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git python3 gnupg
if ! command -v cloudflared >/dev/null 2>&1; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -y
  apt-get install -y cloudflared
fi
cloudflared --version
rm -rf /opt/izakhono-edge-proof
git clone --filter=blob:none '$RepoUrl' /opt/izakhono-edge-proof
git -C /opt/izakhono-edge-proof checkout '$PinnedControlRef'
install -d -m 0755 /etc/izakhono-cloud
touch /etc/izakhono-cloud/ALLOW_EDGE_QUICK_PROOF
cleanup(){ rm -f /etc/izakhono-cloud/ALLOW_EDGE_QUICK_PROOF; }
trap cleanup EXIT
python3 /opt/izakhono-edge-proof/izakhono-cloud/edge-quick-proof.py
test ! -f /etc/izakhono-cloud/ALLOW_EDGE_QUICK_PROOF || exit 2
"@
  Invoke-WslRoot $proof

  & wsl.exe -d $Distro -u root -- cat /var/lib/izakhono-cloud/edge/kora-quick-proof.json |
    Set-Content -LiteralPath $ProofCopy -Encoding UTF8
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $ProofCopy)) {
    Fail 'Could not copy the edge proof receipt to Windows.'
  }

  $data = Get-Content -LiteralPath $ProofCopy -Raw | ConvertFrom-Json
  if ($data.node_name -ne 'ISN-01') { Fail 'Edge proof belongs to the wrong node.' }
  if ($data.project -ne 'kora-network') { Fail 'Edge proof belongs to the wrong project.' }
  if (-not $data.public_https_roundtrip_verified) { Fail 'Public HTTPS round trip was not verified.' }
  if ($data.stable_hostname) { Fail 'Quick proof incorrectly claims a stable hostname.' }
  if ($data.production_eligible) { Fail 'Quick proof incorrectly claims production eligibility.' }
  if ($data.public_ready) { Fail 'Quick proof incorrectly claims public readiness.' }
  if ($data.commercial_ready) { Fail 'Quick proof incorrectly claims commercial readiness.' }

  Write-Host ''
  Write-Host '============================================================'
  Write-Host ' ISN-01 -> KORA -> TEMPORARY PUBLIC HTTPS PROOF: PASS'
  Write-Host " Proof receipt: $ProofCopy"
  Write-Host ' Temporary tunnel: CLOSED after proof'
  Write-Host ' Stable hostname: NOT YET'
  Write-Host ' Production/public readiness: FALSE'
  Write-Host '============================================================'
  exit 0
}
catch {
  Write-Error $_
  Write-Host "Edge proof log: $Log"
  exit 2
}
finally {
  try { Stop-Transcript | Out-Null } catch {}
}
