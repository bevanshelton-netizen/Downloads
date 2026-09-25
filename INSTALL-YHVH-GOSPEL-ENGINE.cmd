@echo off
setlocal
title YHVH GOSPEL ENGINE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\INSTALL-YHVH-GOSPEL-ENGINE.ps1"
set CODE=%ERRORLEVEL%
echo.
if "%CODE%"=="0" (
  echo YHVH GOSPEL ENGINE IS ACTIVE.
) else if "%CODE%"=="20" (
  echo Engine installed safely. Configure its owner token on NODE01 to activate it.
) else (
  echo Engine installation failed with code %CODE%.
)
echo.
pause
exit /b %CODE%
