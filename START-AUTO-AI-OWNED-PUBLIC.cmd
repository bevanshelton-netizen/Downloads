@echo off
setlocal
echo AUTO AI - IZAKHONO OWNED CLOUD PUBLIC ACTIVATION
echo.
echo This uses the tunnel token file you saved from Cloudflare.
echo The token is not uploaded to GitHub.
echo.
set /p TOKENFILE=Drag the tunnel token text file here, then press Enter: 
set TOKENFILE=%TOKENFILE:"=%
if not exist "%TOKENFILE%" (
  echo Token file not found.
  exit /b 2
)
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
if not exist "%STATE%" mkdir "%STATE%"
set "SCRIPT=%STATE%\ACTIVATE-AUTO-AI-OWNED-PUBLIC.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-cloud/ACTIVATE-AUTO-AI-OWNED-PUBLIC.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','"%SCRIPT%"','-TokenFile','"%TOKENFILE%"'"
exit /b %ERRORLEVEL%
