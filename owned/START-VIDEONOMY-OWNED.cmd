@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo ERROR: owned\.env is missing.
  echo Copy .env.example to .env and insert the real secrets locally. Never commit .env.
  exit /b 1
)
where docker >nul 2>nul || (
  echo ERROR: Docker is not available.
  exit /b 1
)
docker compose up -d --build
if errorlevel 1 exit /b 1
echo.
echo Waiting for VIDEONOMY health...
for /l %%i in (1,1,20) do (
  powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18081/api/health -TimeoutSec 3; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
  if not errorlevel 1 (
    echo VIDEONOMY OWNED ENGINE: PASS
    echo Local route: http://127.0.0.1:18081
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)
echo VIDEONOMY OWNED ENGINE: FAIL
docker compose logs --tail 120 videonomy
exit /b 1
