@echo off
rem Stops the exhibit and its browser, and leaves them stopped.
cd /d "%~dp0"
node launch.mjs --stop
