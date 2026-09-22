@echo off
setlocal
title YHVH GOSPEL TV - INSTALL RECONCILIATION
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\INSTALL-KORA-GOSPEL-RECONCILIATION.ps1"
set CODE=%ERRORLEVEL%
echo.
if "%CODE%"=="0" (
  echo KORA GOSPEL RECONCILIATION IS ACTIVE.
) else if "%CODE%"=="20" (
  echo Installed safely. Add the dedicated Supabase secret key on the owner host to activate the timer.
) else (
  echo Installation failed with code %CODE%.
)
echo.
pause
exit /b %CODE%
