@echo off
setlocal

echo AUTO AI - IZAKHONO OWNED CLOUD
echo.
echo This launcher now uses the owned public-host path.
echo It deploys AUTO AI to IZAKHONO RUNTIME NODE,
echo routes it through IZAKHONO EDGE NODE,
echo and verifies the branded HTTPS endpoint before cutover.
echo.

set "PUBLIC_LAUNCHER=%~dp0START-AUTO-AI-OWNED-PUBLIC.cmd"
if exist "%PUBLIC_LAUNCHER%" (
  call "%PUBLIC_LAUNCHER%"
  exit /b %ERRORLEVEL%
)

echo The public launcher was not found locally.
echo Downloading the current launcher...
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
if not exist "%STATE%" mkdir "%STATE%"
set "REMOTE=%STATE%\START-AUTO-AI-OWNED-PUBLIC.cmd"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/START-AUTO-AI-OWNED-PUBLIC.cmd' -OutFile '%REMOTE%'"
if errorlevel 1 (
  echo Could not retrieve the current AUTO AI owned-cloud launcher.
  exit /b 2
)

call "%REMOTE%"
exit /b %ERRORLEVEL%
