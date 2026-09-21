@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\START-KORA-KIDS-RENDER.ps1" %*
if errorlevel 1 (
  echo.
  echo KORA KIDS render did not complete.
  pause
  exit /b 1
)
echo.
echo KORA KIDS render completed.
pause
