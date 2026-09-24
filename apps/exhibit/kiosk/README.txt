CLEVELAND INTERNATIONAL HALL OF FAME — INSTALLED EXHIBIT
Release {{RELEASE}} · content {{CONTENT}} · built {{BUILT}} from {{COMMIT}}

THIS IS THE KIOSK BUILD. IT CONTAINS FILMS APPROVED FOR THE KIOSK ONLY.
NEVER PUT THIS FOLDER ON A WEBSITE OR A PUBLIC SHARE.


WHAT IS IN THIS FOLDER

  site/            the exhibit itself
  server.mjs       the exhibit's own small web server (no install needed)
  start-kiosk.cmd  starts the server on Windows
  start-kiosk.sh   starts the server on macOS or Linux
  MANIFEST.json    what this release contains, including any missing films


WHAT THE DISPLAY NEEDS

  Node.js 22 (LTS), from https://nodejs.org. Nothing else is installed.
  A current Chrome or Edge.


STARTING THE EXHIBIT

  1. Double-click start-kiosk.cmd (Windows) or run ./start-kiosk.sh.
     A window opens saying "open http://localhost:8080/". Leave it open.

  2. Open http://localhost:8080/ in the display browser, full screen:

       Chrome:  chrome --kiosk --app=http://localhost:8080/
       Edge:    msedge --kiosk http://localhost:8080/ --edge-kiosk-type=fullscreen

     The first visit stores the whole exhibit on the display, so it keeps
     working if the network goes down. Only the server needs to keep running.

  Locking the display down (automatic start, no way to leave the exhibit,
  restart after a power cut) depends on the operating system chosen for the
  installation and is set up separately.


STOPPING

  Close the browser, then close the server window (or press Ctrl+C in it).


INSTALLING A NEW RELEASE

  Stop the server, replace this whole folder with the new one, start again.
  The display switches to the new release at the next idle reset, never in
  the middle of a visitor's session. The previous release is kept, and can
  be restored from the recovery panel.


RECOVERY PANEL (STAFF)

  Open http://localhost:8080/?recovery=1 to see which release is serving,
  whether anything failed to store, and to go back to the previous release.


FILMS

  {{FILMS}}
  A film whose video file is missing shows its captions and transcript
  instead. MANIFEST.json lists any missing files by name.
