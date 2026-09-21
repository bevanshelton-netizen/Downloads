param(
  [Parameter(Mandatory=$true)][ValidateSet("voice","music","sfx")][string]$Type,
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$MetadataPath,
  [string]$Workspace = ""
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$Worker=Join-Path $RepoRoot "kora-kids-audio-intake\worker.mjs"
if(!(Test-Path $Worker)){throw "KORA KIDS audio intake worker not found: $Worker"}
if(!(Test-Path $InputPath)){throw "Audio input not found: $InputPath"}
if(!(Test-Path $MetadataPath)){throw "Metadata file not found: $MetadataPath"}
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw "Node.js is required."}
if(!(Get-Command ffprobe -ErrorAction SilentlyContinue)){throw "FFmpeg/FFprobe is required."}
if(!$Workspace){$Workspace=Join-Path $HOME ".izakhono\kora-kids-studio"}
Write-Host "KORA KIDS — PRIVATE AUDIO INTAKE" -ForegroundColor Cyan
Write-Host "Type:      $Type"
Write-Host "Audio:     $InputPath"
Write-Host "Metadata:  $MetadataPath"
Write-Host "Workspace: $Workspace"
Write-Host ""
& node $Worker --type $Type --input $InputPath --metadata $MetadataPath --workspace $Workspace
if($LASTEXITCODE -ne 0){throw "Audio intake failed with exit code $LASTEXITCODE"}
Write-Host ""
Write-Host "Audio imported to the private IZAKHONO workspace." -ForegroundColor Green
Write-Host "Open the KORA KIDS Animation Factory to complete Performance, Technical, Rights and Final review." -ForegroundColor Yellow
