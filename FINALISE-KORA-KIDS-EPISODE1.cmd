@echo off
setlocal
echo KORA KIDS - FINALISE LEBO ^& JABU EPISODE 1
echo.
echo This command requires:
echo   1. one fully approved Lebo voice asset
echo   2. one fully approved original music master
echo   3. all six fully approved Jabu sound cues
echo   4. an approved mastering approval JSON
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\FINALISE-KORA-KIDS-EPISODE1.ps1" %*
if errorlevel 1 (
  echo.
  echo Episode 1 finalisation did not complete.
  pause
  exit /b 1
)
echo.
echo Episode 1 master candidate completed.
pause
