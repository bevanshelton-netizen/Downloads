@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\NODE01-NOW"
set "SCRIPT=%STATE%\RUN-NODE01-NOW.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/RUN-NODE01-NOW.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO NODE01 could not complete.
  exit /b 1
)
echo IZAKHONO NODE01 start-and-proof completed.
exit /b 0
