@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\GO-LIVE-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"
set "URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/GO-LIVE-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"

if not exist "%STATE%" mkdir "%STATE%"

echo.
echo YHVH GOSPEL TV - IZAKHONO OWNED INFRASTRUCTURE GO-LIVE
echo Downloading latest one-click launcher...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%SCRIPT%'"
if not "%ERRORLEVEL%"=="0" (
  echo Could not download the go-live launcher.
  pause
  exit /b 10
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED
) else (
  echo GO-LIVE stopped with code %CODE%.
  echo See YHVH-GOSPEL-TV-GO-LIVE-REPORT.txt on the Desktop.
)
pause
exit /b %CODE%
