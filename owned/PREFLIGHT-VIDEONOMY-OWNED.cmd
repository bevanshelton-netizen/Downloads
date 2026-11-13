@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo FAIL: owned\.env is missing.
  echo Run prepare-windows-env.ps1 or create .env from .env.example.
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

docker info >nul 2>nul
if errorlevel 1 (
  echo FAIL: Docker Desktop is installed but its engine is not running.
  echo Start Docker Desktop, wait until it is ready, then retry.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo FAIL: Docker Compose v2 is unavailable.
  exit /b 1
)

docker compose config --quiet
if errorlevel 1 (
  echo FAIL: Docker Compose configuration is invalid. Check owned\.env and docker-compose.yml.
  exit /b 1
)

echo VIDEONOMY OWNED NODE01 PREFLIGHT: PASS
echo Docker engine and Compose configuration are ready.
echo Next: run START-VIDEONOMY-OWNED.cmd
exit /b 0
