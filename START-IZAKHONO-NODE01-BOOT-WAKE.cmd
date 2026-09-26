@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\NODE01-BOOT-WAKE"
set "SCRIPT=%STATE%\INSTALL-IZAKHONO-NODE01-BOOT-WAKE.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/INSTALL-IZAKHONO-NODE01-BOOT-WAKE.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO NODE01 Boot Wake could not start.
  exit /b 1
)
echo IZAKHONO NODE01 Boot Wake handed to Administrator PowerShell.
exit /b 0
