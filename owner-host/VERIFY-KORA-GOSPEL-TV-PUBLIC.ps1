#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Hostname = "gospel.domains.izakhonoafrica.co.za"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$report = Join-Path ([Environment]::GetFolderPath("Desktop")) "KORA-GOSPEL-TV-PUBLIC-VERIFY.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Add-Line([string]$Text) {
    $lines.Add($Text)
    Write-Host $Text
}

function Fail([int]$Code, [string]$Message) {
    Add-Line ""
    Add-Line ("RESULT: FAIL ({0})" -f $Code)
    Add-Line $Message
    $lines | Set-Content -LiteralPath $report -Encoding UTF8
    Write-Host ""
    Write-Host ("Report: {0}" -f $report) -ForegroundColor Yellow
    exit $Code
}

Add-Line "YHVH GOSPEL TV - PUBLIC VERIFICATION"
Add-Line ("Timestamp: {0}" -f (Get-Date).ToString("s"))
Add-Line ("Hostname: {0}" -f $Hostname)
Add-Line ""

$records = Resolve-DnsName -Name $Hostname -Type A -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress }
if (-not $records) {
    Fail 20 "DNS A record is not publicly resolvable yet."
}
$ips = @($records | Select-Object -ExpandProperty IPAddress -Unique)
Add-Line ("DNS: PASS -> {0}" -f ($ips -join ", "))

$port80 = Test-NetConnection -ComputerName $Hostname -Port 80 -WarningAction SilentlyContinue
if (-not $port80.TcpTestSucceeded) {
    Fail 21 "TCP 80 is not reachable. Check router/firewall forwarding to the owner host."
}
Add-Line "TCP 80: PASS"

$port443 = Test-NetConnection -ComputerName $Hostname -Port 443 -WarningAction SilentlyContinue
if (-not $port443.TcpTestSucceeded) {
    Fail 21 "TCP 443 is not reachable. Check router/firewall forwarding to the owner host."
}
Add-Line "TCP 443: PASS"

try {
    $healthResponse = Invoke-WebRequest -UseBasicParsing -Uri ("https://{0}/health" -f $Hostname) -TimeoutSec 15
} catch {
    Fail 22 ("Trusted HTTPS/TLS failed: {0}" -f $_.Exception.Message)
}
if ($healthResponse.StatusCode -ne 200) {
    Fail 22 ("HTTPS /health returned status {0}." -f $healthResponse.StatusCode)
}
Add-Line "TLS / HTTPS: PASS"

try {
    $health = $healthResponse.Content | ConvertFrom-Json
} catch {
    Fail 23 "The /health response is not valid JSON."
}
if ($health.ok -ne $true -or $health.service -ne "kora-gospel-tv") {
    Fail 23 ("Health payload did not identify a healthy kora-gospel-tv service. Raw: {0}" -f $healthResponse.Content)
}
Add-Line "Gospel TV /health: PASS"

try {
    $page = Invoke-WebRequest -UseBasicParsing -Uri ("https://{0}/" -f $Hostname) -TimeoutSec 15
} catch {
    Fail 24 ("Public Gospel TV page failed: {0}" -f $_.Exception.Message)
}
if ($page.StatusCode -ne 200) {
    Fail 24 ("Public Gospel TV page returned status {0}." -f $page.StatusCode)
}
if ($page.Content -notmatch "(?i)YHVH" -or $page.Content -notmatch "(?i)GOSPEL") {
    Fail 24 "Public page loaded, but expected YHVH Gospel TV branding was not found."
}
Add-Line "Public Gospel TV page: PASS"

Add-Line ""
Add-Line "RESULT: PASS"
Add-Line ("PUBLIC URL: https://{0}" -f $Hostname)
Add-Line "YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED"
$lines | Set-Content -LiteralPath $report -Encoding UTF8

Write-Host ""
Write-Host "YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED" -ForegroundColor Green
Write-Host ("https://{0}" -f $Hostname) -ForegroundColor Green
Write-Host ("Report: {0}" -f $report) -ForegroundColor Cyan
exit 0
