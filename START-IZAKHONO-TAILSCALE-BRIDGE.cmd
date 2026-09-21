@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
set "SCRIPT=%STATE%\START-IZAKHONO-TAILSCALE-BRIDGE.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-TAILSCALE-BRIDGE.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO Tailscale bridge launcher could not start.
  exit /b 1
)
echo IZAKHONO Tailscale bridge has been handed to the Administrator PowerShell window.
exit /b 0
