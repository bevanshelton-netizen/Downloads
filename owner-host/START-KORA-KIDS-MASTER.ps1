param(
  [Parameter(Mandatory=$true)][string]$JobPath,
  [Parameter(Mandatory=$true)][string]$AnimaticPath,
  [Parameter(Mandatory=$true)][string]$VoicePath,
  [Parameter(Mandatory=$true)][string]$MusicPath,
  [Parameter(Mandatory=$true)][string]$ApprovalPath,
  [string]$CaptionsPath = ""
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$Worker=Join-Path $RepoRoot "kora-kids-mastering\worker.mjs"
if(!(Test-Path $Worker)){throw "Mastering worker not found: $Worker"}
foreach($p in @($JobPath,$AnimaticPath,$VoicePath,$MusicPath,$ApprovalPath)){if(!(Test-Path $p)){throw "Missing input: $p"}}
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw "Node.js is required."}
if(!(Get-Command ffmpeg -ErrorAction SilentlyContinue)){throw "FFmpeg is required."}
$Job=Get-Content $JobPath -Raw|ConvertFrom-Json
$slug=($Job.episode.slug -replace '[^a-zA-Z0-9_-]','-')
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$out=Join-Path $HOME ".izakhono\kora-kids-masters\$slug-$stamp"
New-Item -ItemType Directory -Force -Path $out|Out-Null
$args=@($Worker,"--job",$JobPath,"--animatic",$AnimaticPath,"--voice",$VoicePath,"--music",$MusicPath,"--approval",$ApprovalPath,"--output",$out)
if($CaptionsPath){$args+=@("--captions",$CaptionsPath)}
Write-Host "KORA KIDS MASTERING LANE" -ForegroundColor Cyan
Write-Host "Output: $out"
& node @args
if($LASTEXITCODE -ne 0){throw "Mastering failed with exit code $LASTEXITCODE"}
Write-Host ""
Write-Host "Master candidate created." -ForegroundColor Green
Write-Host "This is NOT automatically authorized for public release." -ForegroundColor Yellow
Write-Host "Result: $(Join-Path $out 'mastering-result.json')"
