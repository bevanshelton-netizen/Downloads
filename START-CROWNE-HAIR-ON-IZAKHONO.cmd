@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\START-CROWNE-HAIR-ON-IZAKHONO.ps1"
set CODE=%ERRORLEVEL%
echo.
if "%CODE%"=="0" (echo CROWNE HAIR IS LIVE.) else (echo CROWNE HAIR deployment returned code %CODE%.& echo If runtime deployed but the hostname is not public yet, run NEXT-IZAKHONO-DOMAINS-CUTOVER.cmd.)
pause
exit /b %CODE%
