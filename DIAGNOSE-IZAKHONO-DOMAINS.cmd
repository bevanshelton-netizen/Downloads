@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
set "SCRIPT=%STATE%\DIAGNOSE-IZAKHONO-DOMAINS.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/DIAGNOSE-IZAKHONO-DOMAINS.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%SCRIPT%\"'"
if errorlevel 1 (
  echo IZAKHONO Domains diagnostics could not start.
  exit /b 1
)
echo Diagnostics handed to Administrator PowerShell.
exit /b 0
