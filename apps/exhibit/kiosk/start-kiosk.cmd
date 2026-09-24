@echo off
rem Starts the exhibit: its local server and a full-screen browser.
rem Leave this window open (it can be minimised). stop-kiosk.cmd ends it.
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js 22 is not installed. Install it from https://nodejs.org and start again.
  pause
  exit /b 1
)
:run
node launch.mjs %*
if %errorlevel%==0 goto :eof
echo The exhibit stopped unexpectedly. Starting it again in 5 seconds...
timeout /t 5 /nobreak >nul
goto run
