@echo off
setlocal
echo KORA KIDS - ASSEMBLE LEBO EPISODE 1 VOICE MASTER
echo.
echo Usage:
echo   ASSEMBLE-KORA-KIDS-LEBO-VOICE.cmd -SessionPath "..." -TakesPath "..."
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\ASSEMBLE-KORA-KIDS-LEBO-VOICE.ps1" %*
if errorlevel 1 (pause & exit /b 1)
pause
