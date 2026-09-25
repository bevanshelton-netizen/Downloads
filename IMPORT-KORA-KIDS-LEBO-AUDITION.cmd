@echo off
setlocal
echo KORA KIDS - IMPORT LEBO AUDITION
echo.
echo Usage:
echo   IMPORT-KORA-KIDS-LEBO-AUDITION.cmd -MetadataPath "C:\path\audition.json"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\IMPORT-KORA-KIDS-LEBO-AUDITION.ps1" %*
if errorlevel 1 (pause & exit /b 1)
pause
