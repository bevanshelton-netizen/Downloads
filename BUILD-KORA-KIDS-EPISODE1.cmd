@echo off
setlocal
echo KORA KIDS - BUILD LEBO ^& JABU EPISODE 1
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\BUILD-KORA-KIDS-EPISODE1.ps1" %*
if errorlevel 1 (
  echo.
  echo Episode 1 build did not complete.
  pause
  exit /b 1
)
echo.
echo Episode 1 finishing package completed.
pause
