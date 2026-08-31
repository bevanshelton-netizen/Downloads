#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$InstallWsl,
  [switch]$RunLocalProof
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PinnedBootstrapRef = '6e1c1cd8feab07d129019eb749784074f837b7a3'
$BootstrapUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/$PinnedBootstrapRef/izakhono-cloud/owner-node-bootstrap.sh"
$Distro = 'Ubuntu-24.04'

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

if ($env:OS -ne 'Windows_NT') { Fail 'This helper is for Windows owner-controlled hardware only.' }

$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"

$ramGb = [math]::Round($computer.TotalPhysicalMemory / 1GB, 1)
$freeGb = [math]::Round($disk.FreeSpace / 1GB, 1)

if ($ramGb -lt 8) { Fail 'At least 8 GB host RAM is required for the Windows/WSL owner-node pilot path.' }
if ($freeGb -lt 40) { Fail 'At least 40 GB free space on C: is required for the Windows/WSL owner-node pilot path.' }

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) {
  if (-not $InstallWsl) {
    Fail 'WSL is not available. Re-run from an Administrator PowerShell with -InstallWsl to prepare Ubuntu 24.04.'
  }
  Write-Host 'Installing WSL and Ubuntu 24.04. Windows may require a restart before continuing.'
  & wsl.exe --install -d $Distro --no-launch
  if ($LASTEXITCODE -ne 0) { Fail "WSL installation returned exit code $LASTEXITCODE." }
  Write-Host 'WSL installation requested. Restart Windows if prompted, then run this script again.'
  exit 0
}

$online = (& wsl.exe --list --online 2>$null | Out-String)
if ($online -notmatch [regex]::Escape($Distro)) {
  Fail "$Distro is not offered by this Windows installation. Ubuntu 24.04 is required by the verified IZAKHONO bootstrap."
}

$installed = (& wsl.exe --list --quiet 2>$null | Out-String)
if ($installed -notmatch [regex]::Escape($Distro)) {
  if (-not $InstallWsl) {
    Fail "$Distro is not installed. Re-run from an Administrator PowerShell with -InstallWsl."
  }
  & wsl.exe --install -d $Distro --no-launch
  if ($LASTEXITCODE -ne 0) { Fail "Ubuntu installation returned exit code $LASTEXITCODE." }
  Write-Host 'Ubuntu 24.04 installation requested. Launch it once to complete its local Linux user setup, then rerun this helper.'
  exit 0
}

Write-Host 'IZAKHONO Windows owner-node preflight: PASS'
Write-Host "windows=$($os.Caption) $($os.Version)"
Write-Host "ram_gb=$ramGb"
Write-Host "free_c_gb=$freeGb"
Write-Host "wsl_distro=$Distro"
Write-Host "bootstrap_ref=$PinnedBootstrapRef"

if (-not $RunLocalProof) {
  Write-Host 'Hardware preparation is complete. No production-readiness claim has been made.'
  Write-Host 'Use -RunLocalProof only for a private pilot proof. Public launch still requires independent internet ingress and HTTPS verification.'
  exit 0
}

$cmd = @"
set -euo pipefail
curl -fsSL '$BootstrapUrl' -o /tmp/izakhono-owner-node-bootstrap.sh
chmod 700 /tmp/izakhono-owner-node-bootstrap.sh
sudo bash /tmp/izakhono-owner-node-bootstrap.sh
if sudo test -f /var/lib/izakhono-cloud/READY; then
  sudo mv /var/lib/izakhono-cloud/READY /var/lib/izakhono-cloud/LOCAL_READY
  printf 'scope=local-wsl\npublic_ready=false\n' | sudo tee -a /var/lib/izakhono-cloud/status >/dev/null
  echo 'IZAKHONO local WSL proof: PASS'
  echo 'LOCAL_READY created. This is not public/commercial readiness.'
else
  echo 'IZAKHONO local WSL proof did not produce READY.' >&2
  exit 1
fi
"@

& wsl.exe -d $Distro -- bash -lc $cmd
if ($LASTEXITCODE -ne 0) { Fail "Local WSL proof failed with exit code $LASTEXITCODE." }

Write-Host 'Local owner-controlled proof complete.'
Write-Host 'The Windows/WSL path deliberately converts READY to LOCAL_READY so it cannot be mistaken for externally verified production readiness.'
