#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Zone='edge-test.izakhonoafrica.co.za',
  [Parameter(Mandatory=$true)][string]$Ns1Ip,
  [Parameter(Mandatory=$true)][string]$Ns2Ip
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
foreach($ip in @($Ns1Ip,$Ns2Ip)){
  Write-Host "Testing $ip UDP SOA..." -ForegroundColor Cyan
  $u=Resolve-DnsName -Name $Zone -Type SOA -Server $ip -DnsOnly
  if(-not $u){throw "UDP SOA failed for $ip"}
  Write-Host "Testing $ip TCP SOA..." -ForegroundColor Cyan
  $t=Resolve-DnsName -Name $Zone -Type SOA -Server $ip -DnsOnly -TcpOnly
  if(-not $t){throw "TCP SOA failed for $ip"}
  Write-Host "Testing $ip UDP NS..." -ForegroundColor Cyan
  $n=Resolve-DnsName -Name $Zone -Type NS -Server $ip -DnsOnly
  if(-not $n){throw "UDP NS failed for $ip"}
}
Write-Host "IZAKHONO DNS redundancy proof: PASS for $Zone on both authoritative nodes." -ForegroundColor Green
