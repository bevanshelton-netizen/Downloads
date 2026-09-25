@echo off
setlocal
echo KORA KIDS RELEASE FACTORY
echo.
echo Usage:
echo   PACKAGE-KORA-KIDS-RELEASE.cmd -MasterPath "..." -MasteringResultPath "..." -ApprovalPath "..." [-CaptionsPath "..."] [-LocalisationsPath "..."]
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\PACKAGE-KORA-KIDS-RELEASE.ps1" %*
if errorlevel 1 (
  echo.
  echo Release packaging did not complete.
  pause
  exit /b 1
)
echo.
echo KORA KIDS release package completed.
pause
