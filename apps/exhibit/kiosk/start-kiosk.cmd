@echo off
rem Starts the exhibit local server. Keep this window open while the exhibit runs.
rem Then open http://localhost:8080/ in the display browser (see README.txt).
cd /d "%~dp0"
node server.mjs %*
