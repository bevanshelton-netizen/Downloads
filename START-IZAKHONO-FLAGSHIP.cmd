@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "SCRIPT=%STATE%\START-IZAKHONO-FLAGSHIP.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-FLAGSHIP.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%SCRIPT%\"'"
exit /b %ERRORLEVEL%
