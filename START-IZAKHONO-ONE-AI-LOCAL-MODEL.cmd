@echo off
setlocal
title IZAKHONO ONE AI - LOCAL MODEL ACTIVATION

echo.
echo IZAKHONO ONE AI
echo LOCAL MODEL ACTIVATION
echo.
echo ISN-01 ^> AI GATEWAY ^> GPU COMPUTE ^> MODEL WORKER ^> LOCAL MODEL
echo No per-request external AI API is required after the model is downloaded.
echo.

set "LOCAL_PS1=%~dp0owner-host\START-IZAKHONO-ONE-AI-LOCAL-MODEL.ps1"
if exist "%LOCAL_PS1%" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCAL_PS1%"
  exit /b %ERRORLEVEL%
)

set "STATE=%ProgramData%\IZAKHONO\OWNER-HOST"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE_PS1=%STATE%\START-IZAKHONO-ONE-AI-LOCAL-MODEL.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-IZAKHONO-ONE-AI-LOCAL-MODEL.ps1' -OutFile '%REMOTE_PS1%'"
if errorlevel 1 (
  echo Could not retrieve the IZAKHONO ONE local-model launcher.
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REMOTE_PS1%"
exit /b %ERRORLEVEL%
