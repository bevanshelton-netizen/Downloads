@echo off
setlocal
title IZAKHONO ONE - OWNED LAUNCH

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  powershell.exe -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)

echo.
echo ============================================================
echo IZAKHONO ONE - OWNED LAUNCH
echo NODE 01 / ISN-01 - OWNED-FIRST ACTIVATION
echo ============================================================
echo.
echo External resilience remains untouched.
echo This launcher activates and verifies the owned route only.
echo.

set "LOCAL_PS1=%~dp0owner-host\START-IZAKHONO-ONE-OWNED-LAUNCH.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)

set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\START-IZAKHONO-ONE-OWNED-LAUNCH.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-OWNED-LAUNCH.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 (
  echo Could not retrieve the IZAKHONO ONE owned-launch controller.
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
