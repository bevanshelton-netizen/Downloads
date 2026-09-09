@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\ACTIVATE-ISN-01-WINDOWS.ps1"
if not exist "%STATE%" mkdir "%STATE%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/33a66837ae4fdce500e3291be2ee9b37bf4dfd56/izakhono-cloud/ACTIVATE-ISN-01-WINDOWS.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 (
  echo ISN-01 launcher could not start.
  exit /b 1
)
echo ISN-01 activation has been handed to the Administrator PowerShell window.
exit /b 0
