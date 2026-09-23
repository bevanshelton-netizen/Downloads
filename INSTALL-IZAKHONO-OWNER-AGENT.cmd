@echo off
setlocal
title IZAKHONO OWNER AGENT - INSTALL

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  powershell.exe -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)

echo.
echo IZAKHONO OWNER AGENT
echo SAFE ALLOW-LISTED OWNER-HOST AUTOMATION
echo.

set "LOCAL_PS1=%~dp0owner-host\INSTALL-IZAKHONO-OWNER-AGENT.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)

set "STATE=%ProgramData%\IZAKHONO\OWNER-AGENT"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\INSTALL-IZAKHONO-OWNER-AGENT.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/INSTALL-IZAKHONO-OWNER-AGENT.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 (
  echo Could not retrieve the IZAKHONO Owner Agent installer.
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
