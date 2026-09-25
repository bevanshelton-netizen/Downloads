@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\PROMOTE-REVENUE-DESK-CANONICAL.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Revenue Desk canonical promotion is not complete. Review the gate reported above.
pause
exit /b %EXIT_CODE%
