#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Desktop=[Environment]::GetFolderPath('Desktop')
$Out=Join-Path $Desktop 'V16-SECONDARY-SEED.env.enc'
$OutWsl=(& wsl.exe -d Ubuntu-24.04 -u root -- wslpath -a $Out).Trim()
$Script='/opt/izakhono-v16-owner-proof/izakhono-cloud-v1.6-ha-edge/EXPORT-V16-SECONDARY-SEED.sh'
Write-Host 'You will be asked for an encryption passphrase. It is not stored in the file.' -ForegroundColor Yellow
& wsl.exe -d Ubuntu-24.04 -u root -- bash $Script $OutWsl
if($LASTEXITCODE -ne 0){ throw 'Secondary seed export failed.' }
Write-Host "Encrypted secondary seed: $Out" -ForegroundColor Green
Write-Host 'Transfer this encrypted file to the independent secondary DNS node. Send the passphrase separately.' -ForegroundColor Yellow
