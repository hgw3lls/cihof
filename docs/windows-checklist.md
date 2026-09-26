# Windows test checklist

Everything in this project has so far been run on Linux. This is the first
run on the real machines. Tick each line, write down anything unexpected in
the space after it, and send the filled-in sheet back: every "write down" line
corrects the staff guide.

Three machines, which may be two or one:

- **A. The build machine**: a Windows PC with the project and the 93 films'
  video files. The installer is built here.
- **B. The display PC**: the one in the gallery, with the touchscreen.
- **C. The office PC**: where staff will run the review app.

Date: ____________  Tested by: ______________________

---

## A. Build machine (Developer), about an hour

- [ ] Node.js 22 (the version in `.nvmrc`) and Git installed. `node --version` shows v22.
- [ ] Project cloned; `npm ci` finishes without errors.
- [ ] The video folder copied into `public/media/videos/`.
      `npm run media:assert` passes.
- [ ] `npm test` passes.
- [ ] `npm run build:public` ends with "Artifact cleared for publication".
- [ ] `npm run dev:preview` opens the preview (stop it with Ctrl+C).
- [ ] `npm run package:kiosk-app -- --target=win` builds the installer.
      Time taken: ________
- [ ] Its summary says **93 of 93 films** have their video file.
      If not, which are missing (MANIFEST.json): ______________________
- [ ] Its summary line "profiles approved: __ of 111" (write it down).
- [ ] `release/app/` holds `CIHOF-Exhibit-Setup-<version>.exe`, `STAFF-GUIDE.md` and `sign-off.md`.
      Copy all three to a USB drive. **Not** to a shared or online folder: it carries kiosk-only films.
- [ ] `npm run endurance:app -- --minutes=60` (on the app the step above staged) ends with **Every check passed**. Report: `reports/endurance/app-<date>/endurance-app.md`, handed over with the installer.

## B. Display PC (Administrator), about two hours

Setting up (staff guide section 2):

- [ ] A local Windows account for the exhibit, signing in automatically.
- [ ] BIOS/UEFI set to power on when power returns. Setting's name: ____________
- [ ] Windows Update active hours set outside opening hours; notifications off.
- [ ] Installer run from the USB drive. Windows asked for an administrator
      password: yes / no. "Windows protected your PC" appeared: yes / no.
- [ ] The exhibit opened full screen on its own after installing.

The admin panel:

- [ ] Keyboard plugged in: **Ctrl + Shift + A** asks for a new passcode. Set one and record it where building codes are kept.
- [ ] Unplug the keyboard. **Holding the top-left corner for 5 seconds** opens the keypad.
- [ ] Five wrong passcodes lock the keypad for a minute.
- [ ] Where the settings file is. Expected: `%APPDATA%\CIHOF Exhibit\settings.json`.
      Actual: ______________________________________________
- [ ] Each button works: Back to the start, Reload, Recovery panel, Restart app, Exit to desktop.
- [ ] Turn on all three debugging switches, then **Restart app**: all three are off again.
- [ ] Set **Daily restart** to two minutes from now. The exhibit restarts itself at that time. Then set it back to 04:00.

Lockdown (on the touchscreen, as a visitor):

- [ ] Pinch-zoom does nothing. Swiping sideways does not go "back".
- [ ] A long press or two-finger tap shows no menu.
- [ ] With the keyboard: Alt+F4, Ctrl+W, F5, F11, F12 and Ctrl+R do nothing.
- [ ] The **Windows key** and Ctrl+Alt+Delete. The app cannot block these; write down what happens: ______________
      (If it matters, Windows "Assigned Access" can; staff guide 2.1.)
- [ ] The mouse pointer is hidden.

Running:

- [ ] Leave it untouched: the warning appears after about 90 seconds and the first screen returns 30 seconds later.
- [ ] Open a profile, the timeline, search, Connections. All respond to touch without delay.
- [ ] Play three different films: each plays with sound and captions.
- [ ] Unplug the network cable / turn Wi-Fi off. Everything above still works.
- [ ] Restart Windows from the Start menu: it signs in and opens the exhibit with nobody touching it. Time from power button to exhibit: ________
- [ ] **Pull the power** (at the wall) while it is running, wait ten seconds, restore it: it comes back into the exhibit by itself.
- [ ] Touches land where the finger is, in all four corners and the centre.

## C. Office PC (Developer, then a member of staff), about 30 minutes

- [ ] Node.js 22 and Git installed; project cloned; `npm ci` done.
- [ ] Desktop shortcut **Start staff review** to `apps\review\start-review.cmd`.
- [ ] Double-click it: a black window opens, then the review app in the browser.
- [ ] A member of staff, with no help: enters their name, approves one profile,
      decides one connection, then **Check and save**. It says **Saved**.
      Anything that confused them: ______________________________________
- [ ] `git log -3` shows their commits, with their name.
- [ ] Pushing from that PC works, or its commits can be pulled onto the build machine.
- [ ] Closing the black window stops the app; the shortcut starts it again, with any unsaved choices still there.

## Send back

- This sheet, filled in.
- Photos of anything on screen that looked wrong.
- From the display PC: the file named on the settings line above (it holds only the scrambled passcode and the restart time).
