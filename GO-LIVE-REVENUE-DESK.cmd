@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\GO-LIVE-REVENUE-DESK.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo IZAKHONO Revenue Desk is OWNED LIVE VERIFIED.
) else (
  echo Revenue Desk stopped safely at launch gate %EXIT_CODE%. Review the message above and rerun this same launcher after the gate is corrected.
)
pause
exit /b %EXIT_CODE%
