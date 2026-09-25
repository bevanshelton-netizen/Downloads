param(
  [Parameter(Mandatory=$true)][string]$SessionPath,
  [Parameter(Mandatory=$true)][string]$TakesPath
)
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$SessionWorker=Join-Path $RepoRoot "kora-kids-casting\recording-session.mjs"
$Assembler=Join-Path $RepoRoot "kora-kids-casting\assemble-voice-master.mjs"
$AudioWorker=Join-Path $RepoRoot "kora-kids-audio-intake\worker.mjs"
foreach($p in @($SessionPath,$TakesPath)){if(!(Test-Path $p)){throw "Missing file: $p"}}
$Workspace=if($env:KORA_KIDS_STUDIO_WORKSPACE){$env:KORA_KIDS_STUDIO_WORKSPACE}else{Join-Path $HOME ".izakhono\kora-kids-studio"}
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$out=Join-Path $Workspace "voice-masters\lebo-episode1-$stamp"
New-Item -ItemType Directory -Force -Path $out|Out-Null

Write-Host "KORA KIDS — ASSEMBLE LEBO EPISODE 1 VOICE MASTER" -ForegroundColor Cyan
Write-Host "Attaching 17 approved takes..."
& node $SessionWorker --mode attach --session $SessionPath --takes $TakesPath --workspace $Workspace
if($LASTEXITCODE -ne 0){throw "Take attachment failed."}

Write-Host "Assembling 420-second aligned voice master..."
& node $Assembler --session $SessionPath --output $out
if($LASTEXITCODE -ne 0){throw "Voice master assembly failed."}

$result=Get-Content (Join-Path $out "voice-master-result.json") -Raw|ConvertFrom-Json
$meta=Join-Path $out "audio-intake.json"
@{
  schema="kora-kids.audio-intake/v1"
  type="voice"
  seriesId="lebo-jabu"
  episodeSlug="jam-day-under-the-baobab"
  language="en-ZA"
  character="Lebo"
  performerDisplayName=$result.performerDisplayName
  originalName="lebo-episode1-voice-master.wav"
  performerConsentConfirmed=$true
  guardianConsentRequired=$false
  guardianConsentConfirmed=$false
  voiceRights=@{
    recording=$true
    distribution=$true
    localisation=$true
    territories=@("worldwide")
    media=@("streaming","broadcast","apps","promotional-clips")
    term="See private performer contract"
  }
}|ConvertTo-Json -Depth 8|Set-Content $meta -Encoding UTF8

Write-Host "Registering assembled voice master in the Audio Desk..."
& node $AudioWorker --type voice --input $result.output.path --metadata $meta --workspace $Workspace
if($LASTEXITCODE -ne 0){throw "Audio Desk registration failed."}

Write-Host ""
Write-Host "Lebo Episode 1 voice master assembled and registered." -ForegroundColor Green
Write-Host "It is NOT final until Performance, Technical, Rights and Final Audio Desk gates are approved." -ForegroundColor Yellow
