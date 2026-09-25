param([string]$CandidateId="")
$ErrorActionPreference="Stop"
$RepoRoot=Split-Path -Parent $PSScriptRoot
$Worker=Join-Path $RepoRoot "kora-kids-casting\recording-session.mjs"
$Workspace=if($env:KORA_KIDS_STUDIO_WORKSPACE){$env:KORA_KIDS_STUDIO_WORKSPACE}else{Join-Path $HOME ".izakhono\kora-kids-studio"}
if(!$CandidateId){
  $Casting=Join-Path $Workspace "casting\lebo"
  if(!(Test-Path $Casting)){throw "No casting workspace found."}
  $CandidateId=Get-ChildItem $Casting -Directory |
    Sort-Object LastWriteTime -Descending |
    Where-Object {
      $p=Join-Path $_.FullName "manifest.json"
      if(!(Test-Path $p)){return $false}
      try{(Get-Content $p -Raw|ConvertFrom-Json).selected -eq $true}catch{$false}
    } | Select-Object -First 1 -ExpandProperty Name
}
if(!$CandidateId){throw "No selected Lebo performer found. Complete casting review and select Lebo in the studio first."}
Write-Host "KORA KIDS — PREPARE LEBO EPISODE 1 RECORDING SESSION" -ForegroundColor Cyan
& node $Worker --mode prepare --candidate $CandidateId --workspace $Workspace
if($LASTEXITCODE -ne 0){throw "Recording session preparation failed."}
Write-Host ""
Write-Host "17-line Episode 1 session prepared in the private workspace." -ForegroundColor Green
