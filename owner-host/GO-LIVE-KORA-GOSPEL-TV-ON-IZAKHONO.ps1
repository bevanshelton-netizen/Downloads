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
    $proc = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"')
    exit $proc.ExitCode
}

$state = Join-Path $env:ProgramData "IZAKHONO\ISN-01"
New-Item -ItemType Directory -Force -Path $state | Out-Null
$report = Join-Path ([Environment]::GetFolderPath("Desktop")) "KORA-GOSPEL-TV-GO-LIVE-REPORT.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Log([string]$Text) {
    $lines.Add($Text)
    Write-Host $Text
}

function Save-Report {
    $lines | Set-Content -LiteralPath $report -Encoding UTF8
}

function Stop-With([int]$Code, [string]$Message) {
    Log ""
    Log ("RESULT: BLOCKED ({0})" -f $Code)
    Log $Message
    Log ("Report: {0}" -f $report)
    Save-Report
    exit $Code
}

function Download([string]$Url, [string]$Path) {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Path
}

function Run-Stage([string]$Name, [string]$Path) {
    Log ""
    Log ("=== {0} ===" -f $Name)
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Path
    return $LASTEXITCODE
}

$base = "https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main"
$domains = Join-Path $state "START-IZAKHONO-DOMAINS-OWNER-HOST.ps1"
$gospel = Join-Path $state "START-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"
$verify = Join-Path $state "VERIFY-KORA-GOSPEL-TV-PUBLIC.ps1"

Log "YHVH GOSPEL TV — IZAKHONO OWNED INFRASTRUCTURE GO-LIVE"
Log ("Started: {0}" -f (Get-Date).ToString("s"))
Log "Path: PUBLIC INTERNET -> IZAKHONO DNS -> EDGE/TLS -> NODE 01 / ISN-01 -> YHVH GOSPEL TV"
Log ""

try {
    Log "Refreshing latest IZAKHONO launch scripts from main..."
    Download "$base/owner-host/START-IZAKHONO-DOMAINS-OWNER-HOST.ps1" $domains
    Download "$base/owner-host/START-KORA-GOSPEL-TV-ON-IZAKHONO.ps1" $gospel
    Download "$base/owner-host/VERIFY-KORA-GOSPEL-TV-PUBLIC.ps1" $verify
} catch {
    Stop-With 10 ("Could not download the latest launch scripts: {0}" -f $_.Exception.Message)
}

$code = Run-Stage "1/3 IZAKHONO DNS + PUBLIC EDGE" $domains
if ($code -eq 20) {
    Stop-With 20 "Owner infrastructure is deployed, but the one-time parent DNS delegation/router cutover still needs the exact values printed by the DNS/EDGE stage."
}
if ($code -eq 21) {
    Stop-With 21 "Owned DNS is visible, but inbound TCP 80/443 or trusted TLS is not yet complete."
}
if ($code -ne 0) {
    Stop-With $code ("IZAKHONO DNS/EDGE stage failed with code {0}." -f $code)
}
Log "IZAKHONO DNS + PUBLIC EDGE: PASS"

$code = Run-Stage "2/3 YHVH GOSPEL TV DEPLOYMENT" $gospel
if ($code -eq 20) {
    Stop-With 20 "Gospel TV runtime deployed, but parent DNS/router cutover is still required."
}
if ($code -eq 21) {
    Stop-With 21 "Gospel TV runtime deployed, but public TCP 80/443 or trusted TLS still needs to complete."
}
if ($code -ne 0) {
    Stop-With $code ("KORA Gospel TV deployment failed with code {0}." -f $code)
}
Log "YHVH GOSPEL TV DEPLOYMENT: PASS"

$code = Run-Stage "3/3 INDEPENDENT PUBLIC VERIFICATION" $verify
if ($code -ne 0) {
    Stop-With $code ("Public verification failed with code {0}. Check KORA-GOSPEL-TV-PUBLIC-VERIFY.txt on the Desktop." -f $code)
}
Log "PUBLIC VERIFICATION: PASS"
Log ""
Log "RESULT: LIVE"
Log "YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED"
Log "https://gospel.domains.izakhonoafrica.co.za"
Log ("Completed: {0}" -f (Get-Date).ToString("s"))
Log ("Report: {0}" -f $report)
Save-Report

Start-Process "https://gospel.domains.izakhonoafrica.co.za"
exit 0
