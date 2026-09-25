@echo off
setlocal
title IZAKHONO ONE - R0 PUBLIC BRIDGE

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  powershell.exe -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)

echo.
echo ============================================================
echo IZAKHONO ONE - R0 PUBLIC BRIDGE
echo ISN-01 / IZAKHONO SOVEREIGN RUNTIME
echo ============================================================
echo.
echo No domain purchase.
echo No public IPv4 requirement.
echo No inbound port forwarding requirement.
echo External resilience remains active.
echo.

set "LOCAL_PS1=%~dp0owner-host\START-IZAKHONO-ONE-R0-BRIDGE.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)

set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\START-IZAKHONO-ONE-R0-BRIDGE.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-R0-BRIDGE.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 exit /b 2

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
