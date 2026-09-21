@echo off
setlocal
echo KORA KIDS MASTERING LANE
echo.
echo Usage:
echo   START-KORA-KIDS-MASTER.cmd -JobPath "..." -AnimaticPath "..." -VoicePath "..." -MusicPath "..." -ApprovalPath "..." [-CaptionsPath "..."]
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0owner-host\START-KORA-KIDS-MASTER.ps1" %*
if errorlevel 1 (
  echo.
  echo Mastering did not complete.
  pause
  exit /b 1
)
echo.
echo Mastering candidate completed.
pause
