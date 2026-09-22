@echo off
setlocal
title YHVH GOSPEL TV - IZAKHONO OWNED GO-LIVE

set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\GO-LIVE-YHVH-GOSPEL-TV-ON-IZAKHONO.ps1"
set "URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/GO-LIVE-KORA-GOSPEL-TV-ON-IZAKHONO.ps1"

if not exist "%STATE%" mkdir "%STATE%"

echo.
echo YHVH GOSPEL TV - IZAKHONO OWNED INFRASTRUCTURE GO-LIVE
echo Path: PUBLIC INTERNET ^> IZAKHONO DNS ^> EDGE/TLS ^> NODE01 / ISN-01 ^> YHVH GOSPEL TV
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
  echo YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED
  echo https://gospel.domains.izakhonoafrica.co.za
) else if "%CODE%"=="20" (
  echo YHVH GOSPEL TV runtime is ready.
  echo Parent DNS delegation/router cutover is still required.
  echo Use the exact values printed above, then run this same launcher again.
) else if "%CODE%"=="21" (
  echo YHVH GOSPEL TV runtime and DNS are ready.
  echo Public TCP 80/443 or trusted TLS still needs to complete.
) else (
  echo YHVH GOSPEL TV go-live stopped with code %CODE%.
)
echo.
echo Report: %USERPROFILE%\Desktop\YHVH-GOSPEL-TV-GO-LIVE-REPORT.txt
pause
exit /b %CODE%
