@echo off
setlocal

rem This file is intentionally standalone: Netty can download just this launcher.
net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "STATE_DIR=%ProgramData%\IZAKHONO\ISN-01"
set "DEPLOY_SCRIPT=%STATE_DIR%\START-CROWNE-HAIR-ON-IZAKHONO.ps1"
set "SCRIPT_URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-CROWNE-HAIR-ON-IZAKHONO.ps1"

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"

echo Downloading the latest signed-off Crowne by Netty deployment script...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%SCRIPT_URL%' -OutFile '%DEPLOY_SCRIPT%'"
if not "%ERRORLEVEL%"=="0" (
  echo Could not download the deployment script. Check the internet connection and try again.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DEPLOY_SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (echo CROWNE BY NETTY IS LIVE.) else (echo Crowne by Netty deployment returned code %CODE%.& echo If runtime deployed but the hostname is not public yet, run NEXT-IZAKHONO-DOMAINS-CUTOVER.cmd.)
pause
exit /b %CODE%
