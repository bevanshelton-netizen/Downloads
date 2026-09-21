@echo off
setlocal
echo KORA KIDS PRIVATE AUDIO INTAKE
echo.
echo Usage:
echo   IMPORT-KORA-KIDS-AUDIO.cmd -Type voice -InputPath "C:\path\lebo.wav" -MetadataPath "C:\path\voice.json"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\IMPORT-KORA-KIDS-AUDIO.ps1" %*
if errorlevel 1 (
  echo.
  echo Audio intake did not complete.
  pause
  exit /b 1
)
echo.
echo Audio intake completed.
pause
