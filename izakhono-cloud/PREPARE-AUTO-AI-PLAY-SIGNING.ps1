#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Repo = "bevanshelton-netizen/Downloads"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$State = Join-Path $env:ProgramData "IZAKHONO\AUTO-AI-PLAY"
$KeyStore = Join-Path $State "auto-ai-upload.jks"
$Secrets = Join-Path $State "signing.env"
$B64File = Join-Path $State "AUTO_AI_KEYSTORE_B64.txt"
$Alias = "auto_ai_upload"

function Fail([string]$Message) {
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 2
}

function New-StrongSecret([int]$Bytes = 32) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return [Convert]::ToBase64String($buffer).Replace("+","A").Replace("/","B").Replace("=","")
}

if ($env:OS -ne "Windows_NT") { Fail "Run this on the Windows owner machine." }
if (-not (Test-Path $State)) { New-Item -ItemType Directory -Force -Path $State | Out-Null }

$keytool = Get-Command keytool.exe -ErrorAction SilentlyContinue
if (-not $keytool) {
    $candidates = @(
        "$env:JAVA_HOME\bin\keytool.exe",
        "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe",
        "$env:ProgramFiles\Java\jdk-21\bin\keytool.exe",
        "$env:ProgramFiles\Java\jdk-17\bin\keytool.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            $keytool = [pscustomobject]@{ Source = $candidate }
            break
        }
    }
}
if (-not $keytool) { Fail "Java keytool was not found. Install a JDK or Android Studio, then run this launcher again." }

if ((Test-Path $KeyStore) -or (Test-Path $Secrets)) {
    Fail "A signing key already exists at $State. This script will not overwrite a permanent upload key."
}

$StorePass = New-StrongSecret 28
$KeyPass = New-StrongSecret 28
$dname = "CN=AUTO AI Upload, OU=Mobile, O=Izakhono Africa (Pty) Ltd, L=Johannesburg, ST=Gauteng, C=ZA"

& $keytool.Source -genkeypair -v -keystore $KeyStore -storetype JKS -alias $Alias -keyalg RSA -keysize 4096 -validity 10000 -storepass $StorePass -keypass $KeyPass -dname $dname
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $KeyStore)) { Fail "Upload key generation failed." }

$bytes = [System.IO.File]::ReadAllBytes($KeyStore)
$b64 = [Convert]::ToBase64String($bytes)
Set-Content -Path $B64File -Value $b64 -Encoding ASCII

@"
AUTO_AI_KEYSTORE_PASSWORD=$StorePass
AUTO_AI_KEY_ALIAS=$Alias
AUTO_AI_KEY_PASSWORD=$KeyPass
"@ | Set-Content -Path $Secrets -Encoding UTF8

icacls $State /inheritance:r | Out-Null
icacls $State /grant:r "${env:USERNAME}:(OI)(CI)F" "SYSTEM:(OI)(CI)F" | Out-Null

$fingerprint = & $keytool.Source -list -v -keystore $KeyStore -alias $Alias -storepass $StorePass | Select-String "SHA256:" | Select-Object -First 1

Write-Host ""
Write-Host "AUTO AI PLAY UPLOAD KEY: CREATED" -ForegroundColor Green
Write-Host "Keystore: $KeyStore"
Write-Host "Secrets file: $Secrets"
if ($fingerprint) { Write-Host $fingerprint.Line.Trim() }
Write-Host ""

$gh = Get-Command gh.exe -ErrorAction SilentlyContinue
if ($gh) {
    & gh auth status 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "GitHub CLI is authenticated. Loading signing values into encrypted repository secrets..." -ForegroundColor Cyan
        Get-Content $B64File -Raw | & gh secret set AUTO_AI_KEYSTORE_B64 --repo $Repo
        $StorePass | & gh secret set AUTO_AI_KEYSTORE_PASSWORD --repo $Repo
        $Alias | & gh secret set AUTO_AI_KEY_ALIAS --repo $Repo
        $KeyPass | & gh secret set AUTO_AI_KEY_PASSWORD --repo $Repo
        if ($LASTEXITCODE -eq 0) {
            Write-Host "GitHub signing secrets: CONFIGURED" -ForegroundColor Green
        } else {
            Write-Host "GitHub secret upload did not complete. The local key remains safe at $State." -ForegroundColor Yellow
        }
    } else {
        Write-Host "GitHub CLI is present but not signed in. Local signing key is ready." -ForegroundColor Yellow
    }
} else {
    Write-Host "GitHub CLI is not installed. Local signing key is ready; CI secrets can be added later." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "IMPORTANT: Keep the AUTO-AI-PLAY folder backed up securely. Do not email or paste the keystore/passwords into chat." -ForegroundColor Yellow