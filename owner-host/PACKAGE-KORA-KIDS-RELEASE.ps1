param(
  [Parameter(Mandatory=$true)][string]$MasterPath,
  [Parameter(Mandatory=$true)][string]$MasteringResultPath,
  [Parameter(Mandatory=$true)][string]$ApprovalPath,
  [string]$CaptionsPath = "",
  [string]$LocalisationsPath = ""
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$Worker=Join-Path $RepoRoot "kora-kids-release\worker.mjs"
if(!(Test-Path $Worker)){throw "KORA KIDS release worker not found: $Worker"}
foreach($p in @($MasterPath,$MasteringResultPath,$ApprovalPath)){if(!(Test-Path $p)){throw "Missing input: $p"}}
if($CaptionsPath -and !(Test-Path $CaptionsPath)){throw "Captions not found: $CaptionsPath"}
if($LocalisationsPath -and !(Test-Path $LocalisationsPath)){throw "Localisations folder not found: $LocalisationsPath"}
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw "Node.js is required."}
$approval=Get-Content $ApprovalPath -Raw|ConvertFrom-Json
$slug=($approval.episodeSlug -replace '[^a-zA-Z0-9_-]','-')
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$workspace=if($env:KORA_KIDS_STUDIO_WORKSPACE){$env:KORA_KIDS_STUDIO_WORKSPACE}else{Join-Path $HOME ".izakhono\kora-kids-studio"}
$out=Join-Path $workspace "releases\$slug-$stamp"
New-Item -ItemType Directory -Force -Path $out|Out-Null

$args=@($Worker,"--master",$MasterPath,"--mastering-result",$MasteringResultPath,"--approval",$ApprovalPath,"--output",$out)
if($CaptionsPath){$args+=@("--captions",$CaptionsPath)}
if($LocalisationsPath){$args+=@("--localisations",$LocalisationsPath)}

Write-Host "KORA KIDS — RELEASE FACTORY" -ForegroundColor Cyan
Write-Host "Master:    $MasterPath"
Write-Host "Approval:  $ApprovalPath"
Write-Host "Output:    $out"
Write-Host ""
& node @args
if($LASTEXITCODE -ne 0){throw "Release packaging failed with exit code $LASTEXITCODE"}

$result=Get-Content (Join-Path $out "release-package.json") -Raw|ConvertFrom-Json
if($result.published -ne $false){throw "Safety failure: package unexpectedly reports published."}

Write-Host ""
Write-Host "Distribution package created." -ForegroundColor Green
Write-Host "Published: FALSE" -ForegroundColor Yellow
Write-Host "KORA/YouTube metadata is ready for a separate authorized upload action."
