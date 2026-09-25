@echo off
setlocal
title IZAKHONO ONE - R0 OWNED LAUNCH

set "STATE=%ProgramData%\IZAKHONO\ONE-R0-OWNED"
set "SCRIPT=%STATE%\START-IZAKHONO-ONE-R0-OWNED-LAUNCH.ps1"
if not exist "%STATE%" mkdir "%STATE%"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-R0-OWNED-LAUNCH.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO ONE R0 owned launch could not start.
  exit /b 1
)

echo IZAKHONO ONE R0 owned launch has been handed to Administrator PowerShell.
echo External resilience remains active until the owned bridge is independently verified.
exit /b 0
