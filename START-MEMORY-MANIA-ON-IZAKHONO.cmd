@echo off
setlocal
title MEMORY MANIA - IZAKHONO OWNED INFRASTRUCTURE
echo.
echo MEMORY MANIA
echo OWNED INFRASTRUCTURE DEPLOYMENT
echo.
echo ISN-01 ^> IZAKHONO CODE ^> RUNTIME ^> EDGE/FORTRESS
echo Vercel is not required.
echo.
set "LOCAL_PS1=%~dp0owner-host\START-MEMORY-MANIA-ON-IZAKHONO.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)
set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\START-MEMORY-MANIA-ON-IZAKHONO.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-MEMORY-MANIA-ON-IZAKHONO.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 (
  echo Could not retrieve the Memory Mania owned-infrastructure launcher.
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
