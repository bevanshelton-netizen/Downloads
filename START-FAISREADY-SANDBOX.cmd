@echo off
setlocal
cd /d "%~dp0"
echo.
echo Starting FAISReady first-revenue sandbox...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FAISReady\start-faisready-sandbox.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo FAISReady stopped with error code %RC%.
) else (
  echo FAISReady sandbox closed cleanly.
)
echo.
pause
exit /b %RC%
