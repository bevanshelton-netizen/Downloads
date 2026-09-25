@echo off
setlocal
echo KORA KIDS - PREPARE LEBO EPISODE 1 SESSION
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\PREPARE-KORA-KIDS-LEBO-SESSION.ps1" %*
if errorlevel 1 (pause & exit /b 1)
pause
