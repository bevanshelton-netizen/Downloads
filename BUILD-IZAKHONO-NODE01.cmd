@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\NODE01-BUILD"
set "SCRIPT=%STATE%\BUILD-IZAKHONO-NODE01.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/BUILD-IZAKHONO-NODE01.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo IZAKHONO NODE01 build could not start.
  exit /b 1
)
echo IZAKHONO NODE01 build handed to Administrator PowerShell.
exit /b 0
