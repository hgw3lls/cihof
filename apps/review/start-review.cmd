@echo off
rem Opens the CIHOF staff review app. Put a shortcut to this file on the desktop.
rem Leave the window it opens running while you review; close it to stop.
cd /d "%~dp0\..\.."
call npm run review
pause
