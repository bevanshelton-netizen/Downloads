@echo off
setlocal
net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "STATE_DIR=%ProgramData%\IZAKHONO\ISN-01"
set "DEPLOY_SCRIPT=%STATE_DIR%\START-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"
set "SCRIPT_URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"
if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"
echo Downloading latest KORA GOSPEL TV deployment script...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%SCRIPT_URL%' -OutFile '%DEPLOY_SCRIPT%'"
if not "%ERRORLEVEL%"=="0" (
  echo Could not download the deployment script.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DEPLOY_SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo KORA GOSPEL TV IS LIVE ON IZAKHONO OWNED INFRASTRUCTURE.
) else (
  echo KORA GOSPEL TV deployment returned code %CODE%.
  echo If runtime deployed but hostname is not public yet, run NEXT-IZAKHONO-DOMAINS-CUTOVER.cmd.
)
pause
exit /b %CODE%
