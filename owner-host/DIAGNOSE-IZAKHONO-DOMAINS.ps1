#requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Is-Admin {
  $id=[Security.Principal.WindowsIdentity]::GetCurrent()
  $p=New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
if(-not (Is-Admin)){
  Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
  exit 0
}

$state=Join-Path $env:ProgramData "IZAKHONO\OWNER-HOST"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$desktop=[Environment]::GetFolderPath("Desktop")
if(-not $desktop){$desktop=$state}
$report=Join-Path $desktop "IZAKHONO-DOMAINS-CUTOVER-REPORT.txt"
$lines=New-Object System.Collections.Generic.List[string]
$lines.Add("IZAKHONO DOMAINS CUTOVER REPORT")
$lines.Add("Generated: $(Get-Date -Format o)")
$lines.Add("")

try {
  $publicIp=(Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 "https://api.ipify.org").Content.Trim()
  $lines.Add("Public IPv4: $publicIp")
} catch {$lines.Add("Public IPv4: unavailable")}

try {
  $a=Resolve-DnsName "domains.izakhonoafrica.co.za" -Type A -ErrorAction Stop | Where-Object {$_.IPAddress} | Select-Object -ExpandProperty IPAddress
  $lines.Add("Public A record: " + ($a -join ", "))
} catch {$lines.Add("Public A record: unresolved")}

try {
  $ns=Resolve-DnsName "domains.izakhonoafrica.co.za" -Type NS -ErrorAction Stop | Where-Object {$_.NameHost} | Select-Object -ExpandProperty NameHost
  $lines.Add("Delegated NS: " + ($ns -join ", "))
} catch {$lines.Add("Delegated NS: not visible")}

try {
  $distros=(& wsl.exe --list --quiet 2>$null) -join ", "
  $lines.Add("WSL distributions: $distros")
} catch {$lines.Add("WSL distributions: unavailable")}

foreach($port in 53,80,443){
  try {
    $t=Test-NetConnection -ComputerName "127.0.0.1" -Port $port -WarningAction SilentlyContinue
    $stateText=if($t.TcpTestSucceeded){"OPEN"}else{"CLOSED"}
    $lines.Add("Local TCP ${port}: $stateText")
  } catch {$lines.Add("Local TCP ${port}: test failed")}
}

try {
  $edge=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS http://127.0.0.1:8795/health 2>/dev/null || true") -join ""
  $lines.Add("EDGE health: $edge")
} catch {$lines.Add("EDGE health: unavailable")}

try {
  $dns=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS http://127.0.0.1:8900/health 2>/dev/null || true") -join ""
  $lines.Add("DNS NODE health: $dns")
} catch {$lines.Add("DNS NODE health: unavailable")}

try {
  $runtime=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "curl -fsS -H 'Host: domains.izakhonoafrica.co.za' http://127.0.0.1:8080/health 2>/dev/null || true") -join ""
  $lines.Add("DOMAINS runtime health: $runtime")
} catch {$lines.Add("DOMAINS runtime health: unavailable")}

try {
  $receipt=(& wsl.exe -d Ubuntu-24.04 -u root -- bash -lc "cat /var/lib/izakhono-deploy/owned-public-edge.json 2>/dev/null || true") -join "`n"
  $lines.Add("")
  $lines.Add("OWNED PUBLIC EDGE RECEIPT:")
  $lines.Add($receipt)
} catch {}

$lines.Add("")
$lines.Add("Required inbound network to ISN-01: UDP/TCP 53, TCP 80, TCP 443.")
$lines.Add("If DNS NODE is healthy but public NS/A records are missing, parent DNS delegation is the blocker.")
$lines.Add("If DNS is correct but public HTTPS is unavailable, router/NAT/firewall or ISP/CGNAT is the likely blocker.")
$lines | Set-Content -Path $report -Encoding UTF8
Write-Host ""
Write-Host "CUTOVER REPORT SAVED: $report" -ForegroundColor Green
Start-Process notepad.exe $report
