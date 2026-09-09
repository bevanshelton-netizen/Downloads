@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\PROVE-ISN-01-EDGE-WINDOWS.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/821878ac80392c79a8e1951f00182cc15ddd857c/izakhono-cloud/PROVE-ISN-01-EDGE-WINDOWS.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo ISN-01 edge-proof launcher could not start.
  exit /b 1
)
echo ISN-01 temporary HTTPS proof has been handed to the Administrator PowerShell window.
exit /b 0
