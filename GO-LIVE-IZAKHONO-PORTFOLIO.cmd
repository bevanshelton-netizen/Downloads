@echo off
setlocal
set "STATE=%ProgramData%\IZAKHONO\ISN-01"
set "SCRIPT=%STATE%\GO-LIVE-IZAKHONO-PORTFOLIO.ps1"
set "URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/GO-LIVE-IZAKHONO-PORTFOLIO.ps1"

if not exist "%STATE%" mkdir "%STATE%"

echo.
echo IZAKHONO OWNED PORTFOLIO GO-LIVE
echo KORA Gospel TV + KORA Kids + Revenue Desk
echo.
echo Downloading latest portfolio launcher...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%SCRIPT%'"
if not "%ERRORLEVEL%"=="0" (
  echo Could not download the portfolio launcher.
  pause
  exit /b 10
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo IZAKHONO PORTFOLIO: PUBLIC HTTPS LIVE AND VERIFIED
) else (
  echo Portfolio go-live stopped with code %CODE%.
  echo See IZAKHONO-PORTFOLIO-GO-LIVE-REPORT.txt on the Desktop.
)
pause
exit /b %CODE%
