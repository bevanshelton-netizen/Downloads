param(
  [Parameter(Mandatory=$true)][string]$MasteringApprovalPath,
  [string]$CaptionsPath = ""
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$LockWorker=Join-Path $RepoRoot "kora-kids-final-lock\worker.mjs"
$LockConfig=Join-Path $RepoRoot "kora-kids-final-lock\config.json"
$MasterWorker=Join-Path $RepoRoot "kora-kids-mastering\worker.mjs"
if(!(Get-Command node -ErrorAction SilentlyContinue)){throw "Node.js is required."}
if(!(Get-Command ffmpeg -ErrorAction SilentlyContinue)){throw "FFmpeg is required."}
if(!(Test-Path $MasteringApprovalPath)){throw "Mastering approval not found: $MasteringApprovalPath"}

$Workspace=if($env:KORA_KIDS_STUDIO_WORKSPACE){$env:KORA_KIDS_STUDIO_WORKSPACE}else{Join-Path $HOME ".izakhono\kora-kids-studio"}
$Jobs=Join-Path $Workspace "jobs"
$Finished=Join-Path $Workspace "finished"
if(!(Test-Path $Jobs)){throw "No KORA KIDS jobs folder found: $Jobs"}
if(!(Test-Path $Finished)){throw "No KORA KIDS finishing folder found: $Finished"}

$JobPath=Get-ChildItem $Jobs -Filter "*.json" -File |
  Sort-Object LastWriteTime -Descending |
  Where-Object {
    try{
      $x=Get-Content $_.FullName -Raw|ConvertFrom-Json
      $x.status -eq "approved" -and $x.publishable -eq $true -and $x.series.id -eq "lebo-jabu" -and $x.episode.slug -eq "jam-day-under-the-baobab"
    }catch{$false}
  } | Select-Object -First 1 -ExpandProperty FullName
if(!$JobPath){throw "No approved Lebo & Jabu Episode 1 job found."}

$FinishDir=Get-ChildItem $Finished -Directory |
  Sort-Object LastWriteTime -Descending |
  Where-Object {Test-Path (Join-Path $_.FullName "finishing-result.json")} |
  Select-Object -First 1 -ExpandProperty FullName
if(!$FinishDir){throw "No Episode 1 finishing package found. Run BUILD-KORA-KIDS-EPISODE1.cmd first."}

$FinishResult=Join-Path $FinishDir "finishing-result.json"
$Picture=Join-Path $FinishDir "episode-polished-guide.mp4"
if(!(Test-Path $Picture)){throw "Polished Episode 1 guide not found: $Picture"}

$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$LockOut=Join-Path $Workspace "creative-locks\episode1-$stamp"
$MasterOut=Join-Path $Workspace "masters\episode1-$stamp"
New-Item -ItemType Directory -Force -Path $LockOut,$MasterOut|Out-Null

Write-Host "KORA KIDS — FINALISE EPISODE 1" -ForegroundColor Cyan
Write-Host "Step 1/2: Locking approved Lebo voice, final music and six Jabu cues..."
& node $LockWorker --workspace $Workspace --config $LockConfig --finishing-result $FinishResult --output $LockOut
if($LASTEXITCODE -ne 0){throw "Final creative lock failed. Check the Audio Desk approvals and rights."}

$Inputs=Get-Content (Join-Path $LockOut "mastering-inputs.json") -Raw|ConvertFrom-Json
$CreativeLock=Join-Path $LockOut "creative-lock.json"

Write-Host ""
Write-Host "Step 2/2: Building technical master candidate with the locked creative assets..."
$args=@(
  $MasterWorker,
  "--job",$JobPath,
  "--animatic",$Picture,
  "--voice",$Inputs.voicePath,
  "--music",$Inputs.musicPath,
  "--creative-lock",$CreativeLock,
  "--approval",$MasteringApprovalPath,
  "--output",$MasterOut
)
if($CaptionsPath){
  if(!(Test-Path $CaptionsPath)){throw "Captions not found: $CaptionsPath"}
  $args+=@("--captions",$CaptionsPath)
}
& node @args
if($LASTEXITCODE -ne 0){throw "Final master candidate failed."}

$Result=Get-Content (Join-Path $MasterOut "mastering-result.json") -Raw|ConvertFrom-Json
if($Result.masterCandidate -ne $true){throw "Master candidate did not pass technical QC."}
if($Result.creativeLockUsed -ne $true){throw "Master candidate did not use the creative lock."}
if($Result.jabuSfxMixed.Count -lt 5){throw "Expected scripted Jabu SFX were not mixed."}
if($Result.broadcastMaster -ne $false){throw "Safety failure: mastering self-authorized broadcast."}

Write-Host ""
Write-Host "Episode 1 MASTER CANDIDATE created." -ForegroundColor Green
Write-Host "Locked Lebo voice:  $($Inputs.voicePath)"
Write-Host "Locked music:       $($Inputs.musicPath)"
Write-Host "Jabu scripted cues: $($Result.jabuSfxMixed.Count)"
Write-Host "Master candidate:   $(Join-Path $MasterOut 'master-candidate.mp4')"
Write-Host ""
Write-Host "PUBLIC RELEASE IS STILL LOCKED until explicit Release Factory approval." -ForegroundColor Yellow
