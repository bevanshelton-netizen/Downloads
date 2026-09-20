@echo off
setlocal
set "STATE_DIR=%ProgramData%\IZAKHONO\ISN-01"
set "STUDIO_SCRIPT=%STATE_DIR%\START-KORA-KIDS-STUDIO.ps1"
set "SCRIPT_URL=https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/owner-host/START-KORA-KIDS-STUDIO.ps1"

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%"
echo Downloading latest KORA KIDS Animation Factory launcher...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%SCRIPT_URL%' -OutFile '%STUDIO_SCRIPT%'"
if not "%ERRORLEVEL%"=="0" (
  echo Could not download the studio launcher. Check the internet connection and try again.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%STUDIO_SCRIPT%"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo KORA KIDS ANIMATION FACTORY IS READY ON THE IZAKHONO OWNER HOST.
) else (
  echo Animation Factory returned code %CODE%.
)
pause
exit /b %CODE%
