@echo off
setlocal
title IZAKHONO CREATIVE SUITE - OWNED INFRASTRUCTURE

echo.
echo IZAKHONO CREATIVE SUITE
echo OWNED INFRASTRUCTURE DEPLOYMENT
echo.
echo ISN-01 ^> IZAKHONO CODE ^> RUNTIME ^> EDGE/FORTRESS
echo External fallback remains separate and reversible.
echo Registration and checkout stay gated.
echo.

set "LOCAL_PS1=%~dp0owner-host\START-CREATIVE-SUITE-ON-IZAKHONO.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)

set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\START-CREATIVE-SUITE-ON-IZAKHONO.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-CREATIVE-SUITE-ON-IZAKHONO.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 (
  echo Could not retrieve the Creative Suite owned-infrastructure launcher.
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
