param(
  [ValidateSet("proof","production")]
  [string]$Mode = "production",
  [string]$JobPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Worker = Join-Path $RepoRoot "kora-kids-render-worker\worker.mjs"
if (!(Test-Path $Worker)) { throw "KORA KIDS render worker not found: $Worker" }
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required." }
if (!(Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw "FFmpeg is required on the IZAKHONO render node." }

if ([string]::IsNullOrWhiteSpace($JobPath)) {
  $Workspace = if ($env:KORA_KIDS_STUDIO_WORKSPACE) { $env:KORA_KIDS_STUDIO_WORKSPACE } else { Join-Path $HOME ".izakhono\kora-kids-studio" }
  $Jobs = Join-Path $Workspace "jobs"
  if (!(Test-Path $Jobs)) { throw "No KORA KIDS studio jobs folder found: $Jobs" }

  $JobPath = Get-ChildItem $Jobs -Filter "*.json" -File |
    Sort-Object LastWriteTime -Descending |
    Where-Object {
      try {
        $x = Get-Content $_.FullName -Raw | ConvertFrom-Json
        $x.status -eq "approved" -and $x.publishable -eq $true -and $x.series.id -eq "lebo-jabu"
      } catch { $false }
    } |
    Select-Object -First 1 -ExpandProperty FullName

  if (!$JobPath) { throw "No approved, publishable Lebo & Jabu job is available. Approve every studio review gate first." }
}

$Job = Get-Content $JobPath -Raw | ConvertFrom-Json
if ($Job.series.id -ne "lebo-jabu") { throw "This render launcher currently accepts Lebo & Jabu jobs only." }
if ($Job.renderTarget.id -ne "izakhono-local") { throw "Job is not assigned to IZAKHONO Local Render." }

$SafeSlug = ($Job.episode.slug -replace '[^a-zA-Z0-9_-]','-')
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RenderRoot = Join-Path $HOME ".izakhono\kora-kids-renders"
$Output = Join-Path $RenderRoot "$SafeSlug-$Stamp"
New-Item -ItemType Directory -Force -Path $Output | Out-Null

Write-Host "KORA KIDS — IZAKHONO LOCAL RENDER" -ForegroundColor Cyan
Write-Host "Job:    $JobPath"
Write-Host "Mode:   $Mode"
Write-Host "Output: $Output"
Write-Host ""

& node $Worker --input $JobPath --output $Output --mode $Mode
if ($LASTEXITCODE -ne 0) { throw "KORA KIDS render failed with exit code $LASTEXITCODE" }

$Result = Join-Path $Output "render-result.json"
if (!(Test-Path $Result)) { throw "Render result manifest was not created." }
Write-Host ""
Write-Host "Guide animatic render complete." -ForegroundColor Green
Write-Host "This is NOT a final broadcast master. Final voice, music and broadcast QC remain required." -ForegroundColor Yellow
Write-Host "Result: $Result"
