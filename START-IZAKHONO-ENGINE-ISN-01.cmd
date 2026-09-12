@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\PROVE-IZAKHONO-ENGINE-ISN-01.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/izakhono-engine-isn01-proof/izakhono-cloud/PROVE-IZAKHONO-ENGINE-ISN-01.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO Engine proof launcher could not start.
  exit /b 1
)
echo IZAKHONO Engine proof has been handed to the Administrator PowerShell window.
exit /b 0
