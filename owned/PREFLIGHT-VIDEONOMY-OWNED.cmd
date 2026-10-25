@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo FAIL: owned\.env is missing.
  echo Copy .env.example to .env and add production secrets locally.
  exit /b 1
)

for %%V in (ADMIN_SECRET ABUSE_SALT PUBLIC_BASE_URL) do (
  findstr /R /B /C:"%%V=" .env >nul 2>nul
  if errorlevel 1 (
    echo FAIL: %%V is not defined in .env
    exit /b 1
  )
)

findstr /R /B /C:"IKHOKHA_APP_ID=" .env >nul 2>nul
if errorlevel 1 echo WARN: IKHOKHA_APP_ID is not configured; creator tips will not be live.
findstr /R /B /C:"IKHOKHA_APP_SECRET=" .env >nul 2>nul
if errorlevel 1 echo WARN: IKHOKHA_APP_SECRET is not configured; creator tips will not be live.

where docker >nul 2>nul || (
  echo FAIL: Docker is not installed or not on PATH.
  exit /b 1
)

echo VIDEONOMY OWNED NODE01 PREFLIGHT: PASS
 echo Next: run START-VIDEONOMY-OWNED.cmd
exit /b 0
