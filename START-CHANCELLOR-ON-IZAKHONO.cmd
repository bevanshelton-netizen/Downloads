@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\DEPLOY-CHANCELLOR-ISN-01.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-cloud/DEPLOY-CHANCELLOR-ISN-01.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo THE CHANCELLOR IZAKHONO private-pilot launcher could not start.
  exit /b 1
)
echo THE CHANCELLOR private-pilot cutover has been handed to the Administrator PowerShell window.
exit /b 0
