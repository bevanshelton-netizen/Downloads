#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Is-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Is-Admin)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
    exit 0
}

$State = Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
New-Item -ItemType Directory -Path $State -Force | Out-Null
$Bootstrap = Join-Path $State "bootstrap-linux.sh"
$Raw = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/bootstrap-linux.sh"

Write-Host ""
Write-Host "IZAKHONO ACCESSIBLE OWNER HOST" -ForegroundColor Cyan
Write-Host "Preparing ISN-01 as the owner-controlled platform host..." -ForegroundColor Cyan

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Windows Subsystem for Linux..." -ForegroundColor Yellow
    & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart | Out-Null
    & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart | Out-Null
}

$distros = (& wsl.exe --list --quiet 2>$null) -join "
"
if ($distros -notmatch "Ubuntu-24.04") {
    Write-Host "Installing Ubuntu 24.04 for the IZAKHONO owner host..." -ForegroundColor Yellow
    & wsl.exe --install -d Ubuntu-24.04 --no-launch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Windows may require a restart before Ubuntu can finish installing." -ForegroundColor Yellow
        Write-Host "After restarting, run START-IZAKHONO-OWNER-HOST.cmd again." -ForegroundColor Yellow
        exit 20
    }
}

& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "printf '[boot]\nsystemd=true\n' > /etc/wsl.conf"
if ($LASTEXITCODE -ne 0) { throw "Could not enable systemd in Ubuntu." }

& wsl.exe --shutdown
Start-Sleep -Seconds 3
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "systemctl is-system-running --wait >/dev/null 2>&1 || true"
if ($LASTEXITCODE -ne 0) { throw "Ubuntu did not start correctly." }

Invoke-WebRequest -UseBasicParsing $Raw -OutFile $Bootstrap
$payload = Get-Content $Bootstrap -Raw
$payload | & wsl.exe -d Ubuntu-24.04 -u root -- bash -s
if ($LASTEXITCODE -ne 0) { throw "IZAKHONO owner-host bootstrap failed inside Ubuntu." }

Write-Host ""
Write-Host "Building/repairing sovereign NODE01..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && IZAKHONO_NODE01_INSTALL_STACK=0 bash izakhono-node01/install-linux.sh"
if ($LASTEXITCODE -ne 0) {
    throw "Sovereign NODE01 installation or local acceptance failed."
}
$Node01HealthRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS --max-time 10 http://127.0.0.1:8940/health") -join [Environment]::NewLine
if (-not $Node01HealthRaw.Trim()) { throw "NODE01 local health receipt is missing." }
$Node01Health = $Node01HealthRaw | ConvertFrom-Json
if ($Node01Health.ok -ne $true -or
    $Node01Health.service -ne "izakhono-node01" -or
    $Node01Health.authority -ne "IZAKHONO" -or
    $Node01Health.execution_class -ne "IZAKHONO_SOVEREIGN_NODE" -or
    $Node01Health.external_runtime_dependency -ne $false -or
    $Node01Health.public_live_claim -ne $false) {
    throw "NODE01 local health contract did not pass."
}
Write-Host "NODE01 LOCAL: VERIFIED" -ForegroundColor Green
Write-Host "Node instance: $($Node01Health.node_instance)" -ForegroundColor Green

Write-Host ""
Write-Host "Ensuring NODE01 GitHub runner control path..." -ForegroundColor Cyan
$runnerBootstrap = Join-Path $State "INSTALL-IZAKHONO-NODE01-GITHUB-RUNNER.ps1"
$runnerUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/INSTALL-IZAKHONO-NODE01-GITHUB-RUNNER.ps1"
try {
    Invoke-WebRequest -UseBasicParsing $runnerUrl -OutFile $runnerBootstrap
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runnerBootstrap
    if ($LASTEXITCODE -ne 0) {
        Write-Host "NODE01 runner bootstrap needs owner attention; owner-host core remains installed." -ForegroundColor Yellow
    }
} catch {
    Write-Host "NODE01 runner bootstrap could not complete: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Owner-host core remains intact; rerun the NODE01 runner launcher after GitHub sign-in is available." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installing NODE01 Autopilot..." -ForegroundColor Cyan
$autopilotBootstrap = Join-Path $State "INSTALL-IZAKHONO-NODE01-AUTOPILOT.ps1"
$autopilotUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/INSTALL-IZAKHONO-NODE01-AUTOPILOT.ps1"
try {
    Invoke-WebRequest -UseBasicParsing $autopilotUrl -OutFile $autopilotBootstrap
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $autopilotBootstrap
    if ($LASTEXITCODE -ne 0) {
        Write-Host "NODE01 Autopilot installer returned a non-zero result; core services remain intact." -ForegroundColor Yellow
    }
} catch {
    Write-Host "NODE01 Autopilot could not complete: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Owner-host core remains intact; Autopilot can be rerun independently." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "OWNER HOST CORE: INSTALLED" -ForegroundColor Green
Write-Host "Checking host status..." -ForegroundColor Cyan
& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cd /opt/izakhono-source/Downloads && bash owner-host/status.sh"

Write-Host ""
Write-Host "Evaluating go-live state..." -ForegroundColor Cyan

$Node01JsonRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS --max-time 10 http://127.0.0.1:8940/v1/status 2>/dev/null || true") -join "`n"
$OwnerJsonRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/owner-host.json 2>/dev/null || true") -join "`n"
$EdgeJsonRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/owned-public-edge.json 2>/dev/null || true") -join "`n"
$GrowthJsonRaw = (& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/growth-os-v2.json 2>/dev/null || true") -join "`n"

$Node01 = $null
$Owner = $null
$Edge = $null
$Growth = $null
if ($Node01JsonRaw.Trim()) { $Node01 = $Node01JsonRaw | ConvertFrom-Json }
if ($OwnerJsonRaw.Trim()) { $Owner = $OwnerJsonRaw | ConvertFrom-Json }
if ($EdgeJsonRaw.Trim()) { $Edge = $EdgeJsonRaw | ConvertFrom-Json }
if ($GrowthJsonRaw.Trim()) { $Growth = $GrowthJsonRaw | ConvertFrom-Json }

$PublicUrl = "https://growth.domains.izakhonoafrica.co.za"
$Result = "OWNER HOST READY"
$Action = "No public-edge receipt was produced yet."

if ($Owner -and $Owner.owned_public_edge_state -eq "ACTIVE_HYBRID") {
    $Result = "IZAKHONO OWNED PUBLIC EDGE: LIVE"
    $Action = "Growth OS is on the owned public-edge path. Verifying the public health endpoint."
} elseif ($Owner -and $Owner.owned_public_edge_state -eq "PARENT_DNS_OR_ROUTER_REQUIRED") {
    $Result = "IZAKHONO CORE: READY - PUBLIC DNS/ROUTER ACTION REQUIRED"
    $Action = "Complete the parent delegation for domains.izakhonoafrica.co.za and forward 53/UDP, 53/TCP, 80/TCP and 443/TCP to ISN-01. Then run this launcher again."
} elseif ($Owner -and $Owner.owned_public_edge_state -eq "TLS_OR_PORTS_REQUIRED") {
    $Result = "IZAKHONO CORE: READY - TLS/PORTS ACTION REQUIRED"
    $Action = "Owned DNS is visible. Ensure public TCP 80 and 443 reach ISN-01, then run this launcher again so ACME TLS can complete."
} elseif ($Owner -and $Owner.tunnel_state -eq "ACTIVE") {
    $Result = "IZAKHONO CORE: READY - TUNNEL FALLBACK ACTIVE"
    $Action = "Owned public-edge cutover is not complete yet; the existing tunnel path remains available."
}

$PublicVerified = $false
try {
    $Health = Invoke-RestMethod -Uri "$PublicUrl/api/health" -TimeoutSec 12
    if ($Health.ok -eq $true -and $Health.service -eq "growth-os-v2") {
        $PublicVerified = $true
        $Result = "GROWTH OS v2: PUBLICLY LIVE ON IZAKHONO"
        $Action = "No further Growth OS hosting action is required."
    }
} catch {
    # External reachability is reported by the receipts below; do not fail the private stack.
}

$ReportLines = @(
    "IZAKHONO OWNER HOST - FINAL STATUS"
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
    "Node: ISN-01 / NODE01"
    "NODE01 local verified: $($Node01 -and $Node01.ok -eq $true)"
    "NODE01 instance: $(if($Node01){$Node01.node_instance}else{'UNAVAILABLE'})"
    "NODE01 authority: $(if($Node01){$Node01.authority}else{'UNAVAILABLE'})"
    "NODE01 execution class: $(if($Node01){$Node01.execution_class}else{'UNAVAILABLE'})"
    "NODE01 required components healthy: $(if($Node01){$Node01.components.required_healthy}else{'UNAVAILABLE'})/$(if($Node01){$Node01.components.required_total}else{'UNAVAILABLE'})"
    "Growth OS: $PublicUrl"
    "Result: $Result"
    "Public health verified: $PublicVerified"
    "Action: $Action"
)
if ($Owner) {
    $ReportLines += "Owned edge state: $($Owner.owned_public_edge_state)"
    $ReportLines += "Tunnel state: $($Owner.tunnel_state)"
    $ReportLines += "Growth OS runtime state: $($Owner.growth_os_v2)"
}
if ($Edge) {
    $ReportLines += "DNS delegation observed: $($Edge.parent_delegation_observed)"
    $ReportLines += "Owner IP record ready: $($Edge.hostname_resolves_to_owner_ip)"
    $ReportLines += "Growth OS DNS ready: $($Edge.extra_hostnames_resolve_to_owner_ip)"
    $ReportLines += "TLS ready: $($Edge.tls_ready)"
    $ReportLines += "Hybrid/direct edge ready: $($Edge.edge_hybrid)"
}
if ($Growth) {
    $ReportLines += "Growth OS runtime health: $($Growth.runtime)"
    $ReportLines += "Growth OS public HTTPS receipt: $($Growth.public_https)"
}

$Desktop = [Environment]::GetFolderPath("Desktop")
$ReportPath = Join-Path $Desktop "IZAKHONO-OWNER-HOST-STATUS.txt"
$ReportLines | Set-Content -Path $ReportPath -Encoding UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host $Result -ForegroundColor $(if($PublicVerified){"Green"}else{"Yellow"})
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host $Action
Write-Host "Status report: $ReportPath" -ForegroundColor Cyan

if ($PublicVerified) {
    Start-Process $PublicUrl
}

Write-Host ""
Write-Host "Sovereign NODE01 controller: LOCAL VERIFIED on 127.0.0.1:8940." -ForegroundColor Green
Write-Host "The private IZAKHONO stack, Growth OS runtime, FORTRESS, NODE01 runner and Autopilot do not depend on Vercel." -ForegroundColor Green
Write-Host "Owned public promotion still requires independent HTTPS verification." -ForegroundColor Yellow
