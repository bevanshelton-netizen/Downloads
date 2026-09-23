@echo off
setlocal
title IZAKHONO ONE - DEPLOYMENT READINESS

echo.
echo IZAKHONO ONE
echo DEPLOYMENT READINESS CHECK
echo.

set "LOCAL_PS1=%~dp0owner-host\START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)

set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-DEPLOYMENT-READINESS.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 (
  echo Could not retrieve deployment-readiness launcher.
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
