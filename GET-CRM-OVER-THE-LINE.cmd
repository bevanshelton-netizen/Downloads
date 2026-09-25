@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\CRM-V020"
set "SCRIPT=%STATE%\GET-CRM-OVER-THE-LINE.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/GET-CRM-OVER-THE-LINE.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO CRM activation could not start.
  exit /b 1
)
echo IZAKHONO CRM activation has been handed to Administrator PowerShell.
exit /b 0
