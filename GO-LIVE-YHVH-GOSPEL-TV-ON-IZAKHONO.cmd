@echo off
setlocal
title YHVH GOSPEL TV - HYBRID PRODUCTION GO-LIVE

set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\GET-YHVH-GOSPEL-TV-OVER-THE-LINE.ps1"
set "URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/GET-YHVH-GOSPEL-TV-OVER-THE-LINE.ps1"

if not exist "%STATE%" mkdir "%STATE%"

echo.
echo YHVH GOSPEL TV - HYBRID PRODUCTION GO-LIVE
echo Path: IZAKHONO DIRECT EDGE first; outbound bridge fallback; external resilience retained
echo.
echo Refreshing the latest verified launcher from GitHub main...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%SCRIPT%'"
if errorlevel 1 (
  echo.
  echo Could not download the current YHVH Gospel TV launcher.
  pause
  exit /b 10
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "CODE=%ERRORLEVEL%"

echo.
if "%CODE%"=="0" (
  echo YHVH GOSPEL TV: HYBRID PRODUCTION LIVE VERIFIED
  echo https://gospel.domains.izakhonoafrica.co.za
) else if "%CODE%"=="30" (
  echo LAST-MILE BRIDGE IS BUILT BUT NEEDS A PROTECTED CLOUDFLARE CREDENTIAL ON THE OWNER HOST.
) else (
  echo YHVH GOSPEL TV go-live stopped with code %CODE%.
)
echo.
echo Report: %USERPROFILE%\Desktop\YHVH-GOSPEL-TV-GO-LIVE-REPORT.txt
pause
exit /b %CODE%
