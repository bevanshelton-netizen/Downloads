param(
  [Parameter(Mandatory=$true)][string]$MetadataPath
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$Worker=Join-Path $RepoRoot "kora-kids-casting\audition-intake.mjs"
if(!(Test-Path $MetadataPath)){throw "Audition metadata not found: $MetadataPath"}
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw "Node.js is required."}
if(!(Get-Command ffprobe -ErrorAction SilentlyContinue)){throw "FFprobe is required."}
$Workspace=if($env:KORA_KIDS_STUDIO_WORKSPACE){$env:KORA_KIDS_STUDIO_WORKSPACE}else{Join-Path $HOME ".izakhono\kora-kids-studio"}
Write-Host "KORA KIDS — LEBO AUDITION INTAKE" -ForegroundColor Cyan
& node $Worker --metadata $MetadataPath --workspace $Workspace
if($LASTEXITCODE -ne 0){throw "Audition intake failed."}
Write-Host ""
Write-Host "Audition imported privately. Review it in the Casting & Recording Desk." -ForegroundColor Green
