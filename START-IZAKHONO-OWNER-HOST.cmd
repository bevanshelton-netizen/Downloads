@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
set "SCRIPT=%STATE%\START-IZAKHONO-OWNER-HOST.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-OWNER-HOST.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO Owner Host launcher could not start.
  exit /b 1
)
echo IZAKHONO Owner Host setup has been handed to the Administrator PowerShell window.
exit /b 0
