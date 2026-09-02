@echo off
setlocal
cd /d "%~dp0"
echo.
echo  FAISReady - IZAKHONO OWNER-HOST LAUNCH
echo  ---------------------------------------
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FAISReady\start-faisready-live.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo Launch stopped safely with error code %RC%.
)
exit /b %RC%
