@echo off
setlocal
cd /d "%~dp0"
echo.
echo ============================================================
echo   IZAKHONO COMMAND CENTRE - OWNED INFRASTRUCTURE LAUNCH
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-IZAKHONO-COMMAND-CENTRE-ON-IZAKHONO.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo Launcher stopped with exit code %EXITCODE%.
  echo Keep this window open and read the action printed above.
  pause
)
exit /b %EXITCODE%
