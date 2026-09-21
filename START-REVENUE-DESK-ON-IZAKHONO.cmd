@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\START-REVENUE-DESK-ON-IZAKHONO.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Revenue Desk deployment did not complete. Review the error above.
pause
exit /b %EXIT_CODE%
