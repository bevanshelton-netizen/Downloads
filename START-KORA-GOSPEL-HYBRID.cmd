@echo off
setlocal
title KORA GOSPEL TV - HYBRID ACTIVATION
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\VERIFY-KORA-GOSPEL-HYBRID.ps1"
set CODE=%ERRORLEVEL%
echo.
if "%CODE%"=="0" (
  echo KORA GOSPEL TV HYBRID: VERIFIED
) else if "%CODE%"=="20" (
  echo IZAKHONO runtime deployed; parent DNS/router cutover still required. External route remains available.
) else if "%CODE%"=="21" (
  echo IZAKHONO DNS visible; public TCP/TLS still incomplete. External route remains available.
) else (
  echo Hybrid verification returned code %CODE%. See Desktop\KORA-GOSPEL-HYBRID-REPORT.json
)
echo.
pause
exit /b %CODE%
