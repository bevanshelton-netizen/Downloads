@echo off
setlocal
set "SCRIPT=%~dp0DEPLOY-KORA-ISN-01-OFFLINE.ps1"
if not exist "%SCRIPT%" (
  echo Missing offline KORA installer.
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%SCRIPT%""'"
if errorlevel 1 exit /b 1
echo KORA private-beta deployment opened in Administrator PowerShell.
exit /b 0
