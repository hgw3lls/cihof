@echo off
rem Stops the exhibit starting automatically. Sleep settings are left as they are.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CIHOF Exhibit.lnk" 2>nul
echo The exhibit will no longer start automatically.
pause
