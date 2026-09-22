@echo off
setlocal
title YHVH GOSPEL TV - FINAL HYBRID LAUNCH
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\GET-YHVH-GOSPEL-TV-OVER-THE-LINE.ps1"
set "URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/GET-YHVH-GOSPEL-TV-OVER-THE-LINE.ps1"
if not exist "%STATE%" mkdir "%STATE%"
echo.
echo YHVH GOSPEL TV - FINAL HYBRID LAUNCH
echo Preferred: IZAKHONO direct edge
echo Automatic fallback: outbound tunnel to IZAKHONO-owned origin
echo External resilience stays active.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%SCRIPT%'"
if errorlevel 1 exit /b 10
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo YHVH GOSPEL TV: HYBRID PRODUCTION LIVE VERIFIED
) else if "%CODE%"=="30" (
  echo LAST-MILE BRIDGE READY. ONE PROTECTED CLOUDFLARE CREDENTIAL IS STILL REQUIRED ON THE OWNER HOST.
) else (
  echo FINAL LAUNCH STOPPED WITH CODE %CODE%.
)
echo Report: %USERPROFILE%\Desktop\YHVH-GOSPEL-TV-FINAL-LAUNCH-REPORT.txt
pause
exit /b %CODE%
