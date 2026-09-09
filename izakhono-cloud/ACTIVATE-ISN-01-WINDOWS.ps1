#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Resume,
  [switch]$NoRebootPrompt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$NodeName = 'ISN-01'
$Distro = 'Ubuntu-24.04'
$RepoUrl = 'https://github.com/bevanshelton-netizen/Downloads.git'
$PinnedControlRef = 'dab820b3b8d5bd4168f7f8f6b17325994b6b2f34'
$StateDir = Join-Path $env:ProgramData 'IZAKHONO\ISN-01'
$StableScript = Join-Path $StateDir 'ACTIVATE-ISN-01-WINDOWS.ps1'
$Log = Join-Path $StateDir 'activation.log'
$IdentityCopy = Join-Path $StateDir 'SOVEREIGN-NODE.json'
$ResumeTask = 'IZAKHONO-ISN01-Resume'

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message"
}

function Fail([string]$Message) {
  throw $Message
}

function Test-Administrator {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-StableCopy {
  New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
  if ($PSCommandPath -and ((Resolve-Path $PSCommandPath).Path -ne $StableScript)) {
    Copy-Item -LiteralPath $PSCommandPath -Destination $StableScript -Force
  }
}

function Ensure-Administrator {
  if (Test-Administrator) { return }
  Ensure-StableCopy
  Write-Host 'Administrator permission is required to prepare WSL/Ubuntu for ISN-01.'
  Start-Process powershell.exe -Verb RunAs -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy','Bypass',
    '-File',('"{0}"' -f $StableScript),
    '-Resume'
  )
  exit 0
}

function Register-Resume {
  Ensure-StableCopy
  $action = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $StableScript + '" -Resume'
  & schtasks.exe /Create /TN $ResumeTask /SC ONLOGON /RL HIGHEST /TR $action /F | Out-Null
}

function Remove-Resume {
  & schtasks.exe /Delete /TN $ResumeTask /F 2>$null | Out-Null
}

function Invoke-WslRoot([string]$Command) {
  & wsl.exe -d $Distro -u root -- bash -lc $Command
  if ($LASTEXITCODE -ne 0) {
    Fail "WSL command failed with exit code $LASTEXITCODE."
  }
}

function Get-InstalledDistros {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return '' }
  return (& wsl.exe --list --quiet 2>$null | Out-String)
}

Ensure-StableCopy
Ensure-Administrator
New-Item -ItemType Directory -Path $StateDir -Force | Out-Null

try {
  Start-Transcript -Path $Log -Append | Out-Null
} catch {}

try {
  Write-Step 'Checking Windows hardware'
  $computer = Get-CimInstance Win32_ComputerSystem
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  $ramGb = [math]::Round($computer.TotalPhysicalMemory / 1GB, 1)
  $freeGb = [math]::Round($disk.FreeSpace / 1GB, 1)
  if ($ramGb -lt 8) { Fail "ISN-01 requires at least 8 GB host RAM; detected $ramGb GB." }
  if ($freeGb -lt 40) { Fail "ISN-01 requires at least 40 GB free on C:; detected $freeGb GB." }
  Write-Host "RAM: $ramGb GB"
  Write-Host "Free C: $freeGb GB"

  Write-Step 'Ensuring WSL and Ubuntu 24.04'
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Register-Resume
    & wsl.exe --install -d $Distro --no-launch
    if ($LASTEXITCODE -ne 0) { Fail "WSL installation failed with exit code $LASTEXITCODE." }
    Write-Host 'Windows has staged WSL. Restart Windows once; ISN-01 activation is registered to resume at sign-in.'
    exit 3010
  }

  $installed = Get-InstalledDistros
  if ($installed -notmatch [regex]::Escape($Distro)) {
    Register-Resume
    & wsl.exe --install -d $Distro --no-launch
    if ($LASTEXITCODE -ne 0) { Fail "Ubuntu installation failed with exit code $LASTEXITCODE." }
    Start-Sleep -Seconds 3
    $installed = Get-InstalledDistros
    if ($installed -notmatch [regex]::Escape($Distro)) {
      Write-Host 'Ubuntu 24.04 has been staged. Restart Windows once; activation will resume automatically after sign-in.'
      exit 3010
    }
  }

  Write-Step 'Preparing the Linux owner runtime'
  $bootstrap = @"
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git python3 unzip sudo
if [ ! -f /var/lib/izakhono-cloud/LOCAL_READY ]; then
  curl -fsSL 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/$PinnedControlRef/izakhono-cloud/owner-node-bootstrap.sh' -o /tmp/izakhono-owner-node-bootstrap.sh
  chmod 700 /tmp/izakhono-owner-node-bootstrap.sh
  bash /tmp/izakhono-owner-node-bootstrap.sh
  test -f /var/lib/izakhono-cloud/READY
  mv /var/lib/izakhono-cloud/READY /var/lib/izakhono-cloud/LOCAL_READY
  printf 'scope=local-wsl\nnode=ISN-01\npublic_ready=false\ncommercial_ready=false\n' >> /var/lib/izakhono-cloud/status
fi
test -f /var/lib/izakhono-cloud/LOCAL_READY
docker version >/dev/null
"@
  Invoke-WslRoot $bootstrap

  Write-Step 'Pulling the reviewed IZAKHONO control plane and current KORA source'
  $checkout = @"
set -euo pipefail
rm -rf /opt/izakhono-isn01
mkdir -p /opt/izakhono-isn01
git clone --filter=blob:none '$RepoUrl' /opt/izakhono-isn01/control
git -C /opt/izakhono-isn01/control checkout '$PinnedControlRef'
git clone --depth 1 --branch main '$RepoUrl' /opt/izakhono-isn01/apps
python3 /opt/izakhono-isn01/control/izakhono-cloud/build-kora-owner-handoff.py \
  --app-root /opt/izakhono-isn01/apps \
  --control-root /opt/izakhono-isn01/control \
  --out /opt/izakhono-isn01/kora-owner-node-handoff.zip
rm -rf /opt/izakhono-isn01/handoff
mkdir -p /opt/izakhono-isn01/handoff
unzip -q /opt/izakhono-isn01/kora-owner-node-handoff.zip -d /opt/izakhono-isn01/handoff
"@
  Invoke-WslRoot $checkout

  Write-Step 'Executing the real local KORA workload proof and activating ISN-01'
  $activate = @"
set -euo pipefail
HANDOFF=/opt/izakhono-isn01/handoff/kora-owner-node-handoff
python3 /opt/izakhono-isn01/control/izakhono-cloud/activate-isn-01.py \
  --local-owner-proof \
  --handoff "\$HANDOFF"
python3 - <<'PY'
import json
p='/var/lib/izakhono-cloud/SOVEREIGN-NODE.json'
d=json.load(open(p))
assert d['node_name']=='ISN-01'
assert d['platform_name']=='IZAKHONO SOVEREIGN NODE'
assert d['machine_proof_context']=='owner_machine_local_candidate'
assert d['activation_marker_kind']=='LOCAL_READY'
assert d['workload_project']=='kora-network'
assert d['workload_proof']=='verified'
assert d['public_ready'] is False
assert d['commercial_ready'] is False
print('ISN-01 REAL LOCAL WORKLOAD PROOF: PASS')
PY
"@
  Invoke-WslRoot $activate

  Write-Step 'Copying the sovereign-node receipt to Windows'
  & wsl.exe -d $Distro -u root -- cat /var/lib/izakhono-cloud/SOVEREIGN-NODE.json | Set-Content -LiteralPath $IdentityCopy -Encoding UTF8
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $IdentityCopy)) { Fail 'Could not copy SOVEREIGN-NODE.json to Windows.' }

  Remove-Resume
  @"
IZAKHONO SOVEREIGN NODE
node=ISN-01
local_owner_workload_proof=verified
identity=$IdentityCopy
public_ready=false
commercial_ready=false
"@ | Set-Content -LiteralPath (Join-Path $StateDir 'ISN-01-ACTIVATED.txt') -Encoding UTF8

  Write-Host ''
  Write-Host '============================================================'
  Write-Host ' ISN-01 LOCAL OWNER-MACHINE ACTIVATION: PASS'
  Write-Host " Receipt: $IdentityCopy"
  Write-Host ' Public readiness: FALSE (separate external HTTPS gate remains)'
  Write-Host ' Commercial readiness: FALSE'
  Write-Host '============================================================'
  exit 0
}
catch {
  Write-Error $_
  Write-Host "Activation log: $Log"
  exit 2
}
finally {
  try { Stop-Transcript | Out-Null } catch {}
}
