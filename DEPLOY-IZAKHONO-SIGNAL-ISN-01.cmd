@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-cloud/DEPLOY-SIGNAL-ISN-01.ps1'; $p=Join-Path $env:TEMP 'DEPLOY-SIGNAL-ISN-01.ps1'; Invoke-WebRequest -UseBasicParsing $u -OutFile $p; & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $p; exit $LASTEXITCODE"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" pause
exit /b %EC%
