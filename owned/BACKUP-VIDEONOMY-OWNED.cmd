@echo off
setlocal
cd /d "%~dp0"

if not exist "data" (
  echo FAIL: owned\data does not exist.
  exit /b 1
)

for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set D=%%c-%%a-%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set T=%%a%%b
set DEST=backups\%D%_%T%
mkdir "%DEST%" >nul 2>nul

if not exist "%DEST%" (
  echo FAIL: cannot create backup destination.
  exit /b 1
)

robocopy "data" "%DEST%" /E /R:2 /W:2 /COPY:DAT /DCOPY:DAT /NFL /NDL /NJH /NJS >nul
if errorlevel 8 (
  echo FAIL: backup copy failed.
  exit /b 1
)

echo VIDEONOMY OWNED BACKUP: PASS
 echo Backup created at %DEST%
exit /b 0
