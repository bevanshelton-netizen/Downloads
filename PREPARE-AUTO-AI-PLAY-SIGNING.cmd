@echo off
setlocal
echo AUTO AI - GOOGLE PLAY SIGNING SETUP
echo.
echo This creates the permanent AUTO AI upload key on THIS machine.
echo It will not store the key in source control.
echo.
set "STATE=%ProgramData%\IZAKHONO\AUTO-AI-PLAY"
if not exist "%STATE%" mkdir "%STATE%"
set "SCRIPT=%STATE%\PREPARE-AUTO-AI-PLAY-SIGNING.ps1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/main/izakhono-cloud/PREPARE-AUTO-AI-PLAY-SIGNING.ps1' -OutFile '%SCRIPT%'; Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%SCRIPT%\"'"
exit /b %ERRORLEVEL%