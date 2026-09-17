@echo off
setlocal
set "DISTRO=Ubuntu-24.04"
echo IZAKHONO DOMAINS - OWNER HOST DEPLOYMENT
wsl.exe -d %DISTRO% -u root -- bash -lc "set -euo pipefail; cd /opt/izakhono-source/Downloads; if [ -n \"$(git status --porcelain)\" ]; then echo 'Owner-host source checkout has local changes; refusing to overwrite.' >&2; exit 3; fi; git fetch origin main; git checkout main; git reset --hard origin/main; bash izakhono-owned-cloud/deploy-izakhono-domains.sh"
if errorlevel 1 (
  echo.
  echo IZAKHONO DOMAINS deployment did not complete. Review the message above.
  exit /b 1
)
echo.
echo IZAKHONO DOMAINS has passed the owner-host deployment gates.
echo Public hostname target: domains.izakhonoafrica.co.za
endlocal
