param(
  [ValidateSet("proof","production")]
  [string]$Mode = "production",
  [string]$JobPath = ""
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$RenderWorker=Join-Path $RepoRoot "kora-kids-render-worker\worker.mjs"
$FinishWorker=Join-Path $RepoRoot "kora-kids-finishing\worker.mjs"
$FinishConfig=Join-Path $RepoRoot "kora-kids-finishing\episode1-finishing.json"

foreach($p in @($RenderWorker,$FinishWorker,$FinishConfig)){if(!(Test-Path $p)){throw "Missing KORA KIDS component: $p"}}
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw "Node.js is required."}
if(!(Get-Command ffmpeg -ErrorAction SilentlyContinue)){throw "FFmpeg is required."}
if(!(Get-Command ffprobe -ErrorAction SilentlyContinue)){throw "FFprobe is required."}

$Workspace=if($env:KORA_KIDS_STUDIO_WORKSPACE){$env:KORA_KIDS_STUDIO_WORKSPACE}else{Join-Path $HOME ".izakhono\kora-kids-studio"}
$Jobs=Join-Path $Workspace "jobs"
if([string]::IsNullOrWhiteSpace($JobPath)){
  if(!(Test-Path $Jobs)){throw "No KORA KIDS jobs folder found: $Jobs"}
  $JobPath=Get-ChildItem $Jobs -Filter "*.json" -File |
    Sort-Object LastWriteTime -Descending |
    Where-Object {
      try{
        $x=Get-Content $_.FullName -Raw|ConvertFrom-Json
        $x.status -eq "approved" -and $x.publishable -eq $true -and $x.series.id -eq "lebo-jabu" -and $x.episode.slug -eq "jam-day-under-the-baobab"
      }catch{$false}
    } |
    Select-Object -First 1 -ExpandProperty FullName
  if(!$JobPath){throw "No approved Episode 1 Lebo & Jabu job found. Complete every studio review gate first."}
}
if(!(Test-Path $JobPath)){throw "Job not found: $JobPath"}

$Job=Get-Content $JobPath -Raw|ConvertFrom-Json
if($Job.series.id -ne "lebo-jabu" -or $Job.episode.slug -ne "jam-day-under-the-baobab"){throw "This command builds Lebo & Jabu Episode 1 only."}

$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$RenderOut=Join-Path $Workspace "renders\episode1-$stamp"
$FinishOut=Join-Path $Workspace "finished\episode1-$stamp"
New-Item -ItemType Directory -Force -Path $RenderOut,$FinishOut|Out-Null

Write-Host "KORA KIDS — BUILD LEBO & JABU EPISODE 1" -ForegroundColor Cyan
Write-Host "Mode:      $Mode"
Write-Host "Job:       $JobPath"
Write-Host "Render:    $RenderOut"
Write-Host "Finishing: $FinishOut"
Write-Host ""

& node $RenderWorker --input $JobPath --output $RenderOut --mode $Mode
if($LASTEXITCODE -ne 0){throw "Episode render failed with exit code $LASTEXITCODE"}

$Picture=Join-Path $RenderOut "episode-guide.mp4"
if(!(Test-Path $Picture)){throw "Rendered guide picture missing: $Picture"}

& node $FinishWorker --job $JobPath --picture $Picture --config $FinishConfig --output $FinishOut
if($LASTEXITCODE -ne 0){throw "Episode finishing failed with exit code $LASTEXITCODE"}

$Result=Get-Content (Join-Path $FinishOut "finishing-result.json") -Raw|ConvertFrom-Json
if($Result.qc.pass -ne $true){throw "Finishing QC did not pass."}
if($Result.broadcastMaster -ne $false -or $Result.releaseReady -ne $false -or $Result.published -ne $false){throw "Safety boundary failure."}

Write-Host ""
Write-Host "Episode 1 finishing package complete." -ForegroundColor Green
Write-Host "16:9 guide, original theme guide, Jabu guide SFX, 9:16 Short and thumbnail are ready." -ForegroundColor Green
Write-Host "Broadcast master: FALSE · Release ready: FALSE · Published: FALSE" -ForegroundColor Yellow
Write-Host "Next creative inputs: final Lebo performance, final Jabu SFX, final music performance and human visual QC."
