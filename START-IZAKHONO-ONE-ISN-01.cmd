@echo off
setlocal
title IZAKHONO ONE - ISN-01 SOVEREIGN LAUNCH

echo.
echo ============================================================
echo IZAKHONO ONE - ISN-01 / NODE01-EQUIVALENT SOVEREIGN LAUNCH
echo ============================================================
echo.
echo ISN-01 fulfils the capability-based NODE01 authority role.
echo The canonical owned launch, privacy gates, fallback preservation,
echo EDGE/TLS handling and independent HTTPS verification remain unchanged.
echo.

call "%~dp0START-IZAKHONO-ONE-OWNED-LAUNCH.cmd"
exit /b %ERRORLEVEL%
