CLEVELAND INTERNATIONAL HALL OF FAME — INSTALLED EXHIBIT
Release {{RELEASE}} · content {{CONTENT}} · built {{BUILT}} from {{COMMIT}}

THIS IS THE KIOSK BUILD. IT CONTAINS FILMS APPROVED FOR THE KIOSK ONLY.
NEVER PUT THIS FOLDER ON A WEBSITE OR A PUBLIC SHARE.


WHAT THE DISPLAY NEEDS

  Node.js 22 (LTS), from https://nodejs.org. Nothing else is installed.
  Microsoft Edge (on every Windows PC) or Google Chrome.

  The same folder works on Windows, macOS and Linux. On Windows use the
  .cmd files; on macOS and Linux the .sh files.


EVERYDAY USE

  Start:  start-kiosk.cmd
          Starts the exhibit's server and opens Edge (or Chrome) full screen
          on it. Leave the small window it opens running; it can be minimised.

  Stop:   stop-kiosk.cmd
          Closes the exhibit and the browser, and leaves them closed, so the
          desktop is available. Run start-kiosk.cmd to bring it back.

  If the browser is closed or crashes, it opens again by itself. If it keeps
  failing, it waits a little longer each time before trying again. The browser
  also restarts itself once a day at 04:00, which keeps a display that runs
  for months from slowing down.


SETTING UP A DISPLAY (ONCE)

  1. Copy this folder to the display, for example to C:\CIHOF-Exhibit.
     Avoid a path with an apostrophe in it.

  2. Run install-autostart.cmd. From then on the exhibit starts whenever the
     display's Windows account signs in, and the screen and computer are set
     never to sleep. (uninstall-autostart.cmd undoes the automatic start.)

  3. Make the display sign in by itself after a restart or a power cut.
     This is a Windows setting, made by whoever administers the PC:

       Windows 11 Pro / Enterprise: a dedicated local account for the
       exhibit, set to sign in automatically. For the strictest lockdown,
       Windows "Assigned Access" (Settings, Accounts, Other users, Set up a
       kiosk) can run Edge alone on that account.

       In the BIOS / UEFI, set the PC to power on when power is restored.

  4. Restart the PC. It should come up straight into the exhibit.

  The first time the exhibit opens it stores itself on the display, so it
  keeps working if the network goes down. Only its own server, on this PC,
  needs to keep running.


INSTALLING A NEW RELEASE

  Run stop-kiosk.cmd, replace this whole folder with the new one (keep the
  browser-profile folder if you want the display to switch over without
  downloading everything again), then run start-kiosk.cmd. The display
  switches to a new release at the next idle reset, never in the middle of a
  visitor's session. The previous release is kept and can be restored from the
  recovery panel.


RECOVERY PANEL (STAFF)

  With a keyboard, open http://localhost:8080/?recovery=1 to see which release
  is serving, whether anything failed to store, and to go back to the
  previous release.


OPTIONS

  start-kiosk.cmd --restart-at=03:30     a different daily restart time
  start-kiosk.cmd --restart-at=off       no daily restart
  start-kiosk.cmd --browser="C:\...\chrome.exe"   a particular browser
  start-kiosk.cmd --port=9000            if port 8080 is taken


FILMS

  {{FILMS}}
  A film whose video file is missing shows its captions and transcript
  instead. MANIFEST.json lists any missing files by name.
