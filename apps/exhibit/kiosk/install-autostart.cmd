@echo off
rem Starts the exhibit automatically when this Windows account signs in,
rem and keeps the screen and computer from going to sleep.
rem Signing in automatically is a Windows setting; see README.txt.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup') + '\CIHOF Exhibit.lnk');" ^
  "$s.TargetPath = '%~dp0start-kiosk.cmd'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save()"
if errorlevel 1 (
  echo Could not create the startup shortcut.
  pause
  exit /b 1
)
echo The exhibit will start when this account signs in.
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
if errorlevel 1 (
  echo Could not change the sleep settings. Set "Screen" and "Sleep" to Never in Settings, Power.
) else (
  echo Screen and sleep timeouts set to never.
)
pause
