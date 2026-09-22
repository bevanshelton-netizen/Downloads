@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\VERIFY-KORA-GOSPEL-TV-PUBLIC.ps1"
set "URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/VERIFY-KORA-GOSPEL-TV-PUBLIC.ps1"

if not exist "%STATE%" mkdir "%STATE%"

echo Downloading latest YHVH GOSPEL TV public verifier...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%SCRIPT%'"
if not "%ERRORLEVEL%"=="0" (
  echo Could not download the public verifier.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo YHVH GOSPEL TV: PUBLIC HTTPS LIVE AND VERIFIED
) else (
  echo Verification returned code %CODE%.
  echo See KORA-GOSPEL-TV-PUBLIC-VERIFY.txt on the Desktop for the exact blocker.
)
pause
exit /b %CODE%
