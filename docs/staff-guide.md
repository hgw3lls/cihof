# CIHOF exhibit: staff guide

For the staff of the Western Reserve Historical Society who look after the
Cleveland International Hall of Fame touchscreen. It covers installing the
display, starting and stopping it, running it day to day, updating content,
backups and troubleshooting.

Each task is marked with who can do it:

- **Staff**: from the display itself, with no technical knowledge.
- **Administrator**: someone with Windows administrator rights on the display PC.
- **Developer**: someone who works in the project repository with Node.js.
  Some content tasks still need one. They are listed as such in
  [What still needs a developer](#what-still-needs-a-developer), not hidden.

> **The kiosk build contains films approved for the kiosk only.** Never put
> the installer, the kiosk folder or a copy of the display's files on a
> website, a public share or a shared drive other people can download from.


New to the display or the review app? Start with the illustrated walkthroughs in [`training/`](training/): [gallery staff](training/gallery-staff.md) and [reviewers](training/review-app.md).

---

## 1. What the exhibit is

One Windows PC and a touchscreen, running one application: **CIHOF Exhibit**.
The application fills the screen and has no menus, no address bar and no way
for a visitor to leave it. Everything it shows (profiles, portraits, films,
the timeline, the map and Connections) lives on the PC. It needs no internet
connection.

While nobody is using it, the exhibit shows its **attract screen**: portraits
or names of the inductees, with one lit up at a time, and a call to action.
Touching a face or a name opens that person; touching the call to action
opens the whole collection. There are three attract screens to choose from in
the admin panel (below). When a visitor stops touching the screen, the exhibit
shows a warning after about 90 seconds and returns to the attract screen 30
seconds later. The next visitor always starts fresh.

The attract screen's headline and tagline are visitor text like any other.
Until a curator approves the exact words (7.3), it shows the hall's name
alone.

The exhibit is dark as designed; the admin panel can switch it to light
colours for a bright room (below). Films always play on black. A **Light** /
**Dark** key beside *Start over* lets a visitor switch for their own visit;
the next visitor meets the colours the admin panel chose. The public website
starts in light colours and remembers a visitor's choice on their own phone
or computer.

**How this works.** A visitor who comes in from the attract screen is
offered a guided walk round the controls, once, in the masthead where the
subtitle usually sits: *New here?*, with **How this works** and **No
thanks**. Nothing opens unless they ask. The offer goes by itself after 12
seconds, or at their first touch anywhere else, and the next visitor is
offered it again. The **How this works** key on the bar, beside **Start over**,
opens the same walk at any time, on the display and on the public website; the website
has no attract screen, so it makes no offer and has only the key.

The walk goes in the order a visit does: the ways in, choosing somebody and
what their story offers, each other way in, the keys on the bar, and how a
visit ends. Each step lights the control it describes and dims the rest.
Nothing in it moves on a timer, and every step has **Stop**, **Start again**,
**Back** and **Next** (**Start exploring** on the last); a touch outside the
box closes it too. It is built from what the release carries, so a way in or
films the release does not have get no step, and its figures (how many
people, classes, films and places) are counted from the release itself. Its
words are the exhibit's own instructions rather than content about the
inductees, so they need no curator approval; a change to them comes with a
new release.

The offer's 12 seconds is set when the release is built
(`VITE_CIHOF_INVITATION_MS`); a release will not take less than 6 seconds.

The display is always drawn at 1920 × 1080. The public website fills
whatever screen it is opened on: a landscape screen gets the display's
arrangement, stretched to the screen's shape, and a phone or tablet held
upright gets a phone arrangement, with the wall above, the keys in two rows
along the foot, a chosen person's details rising from below and search
dropping from above. To check one arrangement on the other's build, add
`?fit=fill` or `?fit=fixed` to the address.

After a minute with nobody touching it, the display asks **"Are you still
here?"**, and twenty seconds later it starts over. A film playing counts as
somebody there.

**Tours.** The **Tour** key offers curated tours and the threads visitors
saved. A curated tour appears only once a curator has approved it, on the
*Tours* card of the staff review app (or with a sheet and
`npm run tours:apply`), and a new release is published. The approval names
where it may be shown: the exhibit, or the exhibit and the public website,
decided apart as for connections. It covers the tour's words and the rules
that choose its people; if either changes, the tour comes off the displays
until it is approved again. Its people are chosen when the release is built,
from the published biographies and honours, by the tour's terms and themes; its
`pinnedPersonIds` lead and its `excludedPersonIds` never appear. Curators
change all of that in the review app's tour editor (**Edit this tour** on the
*Tours* card): the words, who it visits and in what order, and the terms and
themes, seeing the tour as visitors would while they work. An edit is saved
like any other decision, refused if somebody else changed the tour first, and
either approves the tour as edited or leaves it a draft for somebody to
approve. **Start a new tour** on the same card makes a new one in the same
editor, decided the same way; it is named from its words and added after
the others. **Delete this tour** removes one from the records altogether, after
asking once more; it is refused if the tour changed after it was chosen for
deleting. The archived sheet in `data/curation-decisions/`, and the project's
history, keep what it was. Taking a tour off the displays instead keeps it,
to be approved again. An editor's preview shows the drafts, marked *Unreviewed*. **Saved threads** are walks
through Connections that a visitor chose to keep. They stay on the display
for the visitors after, named for the people they start and end with (nobody
types a name), newest first, up to 24. Any visitor can reorder, shorten or
delete one from *Edit* on the Tour screen. Staff can clear them all at once
from the recovery panel (section 5).

The application looks after itself:

| If… | It… |
| --- | --- |
| the page crashes | reloads it within a second |
| the page freezes | waits briefly, then restarts the page |
| it has run all day | restarts itself at 04:00 (you can change the time) |
| the PC restarts or the power returns | starts again when Windows signs in |
| the display tries to sleep | keeps it awake |

---

## 2. Installing a display (Administrator, once)

For the first installation, work through [`windows-checklist.md`](windows-checklist.md)
as well: it tests each step below on the real machine and records what to correct here.

### 2.1 The PC

1. **A dedicated Windows account** for the exhibit: a standard local account,
   not an administrator, used for nothing else.
2. **Automatic sign-in** for that account, so the PC comes back into the
   exhibit after a restart or a power cut without anyone typing a password.
3. **Power on after power loss**: in the PC's BIOS/UEFI settings, set it to
   power on when power is restored. The name varies by manufacturer
   ("AC Power Recovery", "Restore on AC Power Loss", "After Power Failure").
4. **Windows Update**: set active hours or a maintenance window outside
   opening hours, so an update never restarts the PC in front of visitors.
5. **Notifications**: turn them off for the exhibit account (Settings,
   System, Notifications).
6. **Crash reporting off**: when a program crashes, Windows may hold on to
   it while it writes a report, and may show a "has stopped working" box.
   Either could keep the exhibit from reloading its page, or leave the box
   on the wall. On a test machine a crash reporter did hold the page; on
   Windows this has not been seen yet, so this is a precaution. Open
   **Command Prompt** as an administrator and run these two lines, then
   restart the PC:

   ```
   reg add "HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting" /v Disabled /t REG_DWORD /d 1 /f
   reg add "HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting" /v DontShowUI /t REG_DWORD /d 1 /f
   ```

   This affects every program on the PC, which is right for a PC that runs
   only the exhibit. To undo it, run the same lines with `/d 0`.
7. **Optional, strictest lockdown**: Windows 11 Pro/Enterprise can run one
   app alone on an account ("Assigned Access": Settings, Accounts, Other
   users, Set up a kiosk). The exhibit does not require it.

### 2.2 The application

1. Sign in as the exhibit account.
2. Run the installer (`CIHOF-Exhibit-Setup-<version>.exe`). The developer
   provides it on a USB drive or by direct hand-over, **never by a public
   link** (see the warning at the top). It installs for all users of the
   PC, so Windows asks for an administrator's password.
3. Windows may warn that the publisher is unknown ("Windows protected your
   PC"). The installer is not yet code-signed. Choose **More info**, then
   **Run anyway**.
4. The exhibit opens full screen and adds itself to start at sign-in.

### 2.3 Set the admin passcode (do this straight away)

The admin panel is protected by a passcode that you choose. On a new
install there is none yet, and it can only be set **with a keyboard**:

1. Plug in a keyboard and press **Ctrl + Shift + A**.
2. Choose a passcode of 4 to 12 digits, then enter it again.
3. Write it down and keep it where your team keeps other building codes.

Holding the corner of the screen never offers to set a first passcode. This
stops a visitor from setting one on a new display and locking staff out.

Then give it the films. The developer hands over a copy of the films folder
(about 20 GB) with the installer. Copy it to this PC's own drive, for example
`C:\CIHOF\films`, then in the admin panel choose **Films › Choose the films
folder** and pick it. It should say that all the films are in the folder.
(An installer built with the films inside needs no folder.)

### 2.4 Check it

Restart the PC. Without anyone touching it, it should sign in and come up
straight into the exhibit. Then:

- open a profile, play a film, try the timeline, search and Connections;
- leave it alone for three minutes and confirm it returns to the first
  screen;
- open the admin panel (below) and note the **Release** and **Content** it
  shows in your records.

---

## 3. Daily operation (Staff)

### Starting

Switch on the PC. The exhibit starts by itself.

### Shutting down

Use the admin panel: **Exit to desktop**, then shut Windows down from the
Start menu as usual. Cutting the power also works (the exhibit writes
nothing while it runs), but a normal shutdown is kinder to the PC.

### Every day

Nothing is required. Worth a glance when opening:

- the screen is on and showing the attract screen;
- the touchscreen responds where you touch it;
- the screen is clean.

### The admin panel

Open it by **holding the top-left corner of the screen for 5 seconds**, or
with **Ctrl + Shift + A** on a keyboard. Enter the passcode on the keypad.
Five wrong tries lock the keypad for a minute, and longer after further
wrong tries.

| Section | What it does |
| --- | --- |
| **This display** | Which release and content are installed, how many people it holds. Quote these when you report a problem. |
| **Back to the start** | Returns the exhibit to its first screen. |
| **Reload** | Reloads the exhibit, as if it had just started. |
| **Recovery panel** | Opens the release and recovery panel (section 5). |
| **Films** | Where the films are played from, and how many of them it finds. **Choose the films folder** once, after installing: the copy of the films the developer provides, on this PC's own drive. **Stop using the folder** plays only films inside the app, if it carries any. A film it cannot find shows its captions and transcript instead. |
| **Content** | Which content the display is showing: as delivered, or a content update. **Load a content update…** takes in an update made with the staff portal; **Export current content…** gives the portal what the display shows now. Every version is kept and can be shown again. See *Content updates* below. |
| **Restart app** | Closes and reopens the application. |
| **Exit to desktop** | Closes the exhibit. It stays closed until someone starts it (Start menu, *CIHOF Exhibit*) or the PC restarts. |
| **Debugging** | Developer tools, menus and window, and mouse pointer. For a developer diagnosing a problem. **They turn themselves off at the next restart**, including the nightly one, so a display is never left in debug mode. |
| **Daily restart** | The time of the nightly restart, or Off. 04:00 unless changed. |
| **Start at sign-in** | Whether the exhibit opens when Windows signs in. Leave it On. |
| **Attract screen** | What the display shows while nobody is using it: **Mosaic** (every portrait in greyscale, one in colour), **Name wall** (every name in slow rows, no photographs) or **Stacked** (names above a strip of portraits). **Rotate through all three** shows a different one each time the display goes idle. **Spotlight moves every** 4, 6 or 10 seconds. **Motion** Off stops the drifting rows. **Colours**: **Dark** (as designed) or **Light**, for the whole exhibit. **Preview for 30 s** shows your choice without saving it; **Save** keeps it and shows it straight away. |
| **Change passcode** | Choose a new passcode. |

Close the panel with **Close** at the top right.

### Content updates (Staff)

The words, pictures and films the display shows can be changed without
reinstalling it. Changes are made with the staff portal, which writes a
**content update**: one file (`.cihof`), brought to the display on a USB stick
or from a shared folder.

1. **Start from what the display shows.** In the admin panel, **Content ›
   Export current content…**, and save the file to a USB stick. Open it in the
   staff portal (the CIHOF Staff Review app, **File › Open a display's
   content…**), make the changes, check and save them, and choose **Make a
   display update**. The update is written to **Documents › CIHOF display
   updates**. (An update made from anything else is refused, or warned about,
   so nobody's changes are lost. The walkthrough is
   `docs/training/review-app.md`, section 5.)
2. **Load the update.** Back at the display: **Content › Load a content
   update…** and choose the file the portal made. The panel checks it before
   anything changes and shows who made it, when, and what it changes. An
   update that is damaged, made for another exhibit, or holds anything that
   would break the display is refused, and the display keeps what it shows.
3. **Apply it.** **Apply and show now** shows it straight away (nobody is
   using the display while the panel is open). **Apply at the next reset**
   lets the current visitor finish; the display takes it over when it next
   returns to its attract screen.

If the update was made from an earlier version than the display now shows (for
example, two people made changes from the same export), the panel says so:
applying it would undo the other changes. Export again and make the update from
that, or **apply it anyway** if that is what you want.

**Going back.** **Content › Versions kept** lists every update
loaded (the last ten are kept) and **the content delivered with the app**,
which is never changed. **Show this version** shows any of them again;
**Go back to it** returns to the delivered content. Nothing is deleted by going
back, so a newer version can be shown again afterwards.

Updates carry the films' kiosk-only captions and transcripts, and may carry
films: treat the files like the release itself, never on a public link.

### Forgotten passcode (Administrator)

1. With a keyboard, press **Ctrl + Alt + Delete**, open **Task Manager** and
   end **CIHOF Exhibit**.
2. Open `%APPDATA%\CIHOF Exhibit\settings.json` in Notepad. *(This location
   is where the application is expected to keep its settings on Windows;
   confirm it on the installed PC and correct this guide if it differs.)*
3. Change the `"passcode"` line to `"passcode": null,` and save.
4. Start *CIHOF Exhibit* from the Start menu, then press **Ctrl + Shift + A**
   to choose a new passcode.

---

## 4. Installing a new release (Administrator)

When content changes, the developer builds a new installer (section 7) and
hands it over, again never by a public link.

1. Open the admin panel. Note the current **Release** and **Content**.
2. **Exit to desktop**.
3. Run the new installer. It replaces the old version.
4. Start *CIHOF Exhibit* from the Start menu, or restart the PC.
5. Open the admin panel. **Release** and **Content** should show the new
   values, and **Films** should say that all the films are found. If the
   developer handed over new films, copy them into the films folder first.

The display keeps the previous release it had stored. If the new one
misbehaves, the recovery panel can go back to it (section 5). Keep the
previous installer too (section 8) in case you need to reinstall it.

---

## 5. The recovery panel (Staff)

Open it from the admin panel: **Recovery panel**. It shows:

| Line | Meaning |
| --- | --- |
| **Serving** | The release visitors are seeing now. |
| **Previous** | The release before it, if the display still holds one. |
| **Releases held** | How many releases the display has stored. |
| **Provisioning** | *complete* when every file of the release was stored. Otherwise it counts the unusable files and lists them. |

Buttons:

- **Re-check** refreshes what it shows.
- **Restore previous release** goes back to the previous release. When it
  finishes, the panel says *Restored to … from …*. **Write that down** and
  tell the developer.
- **Clear all saved threads** deletes every thread visitors saved on this
  display, after asking a second time (**Yes, clear all …**). Use it if a
  thread should not be there, or to start the list afresh. They cannot be
  brought back. Curated tours are not affected.
- **Close** returns to the exhibit.

A display switches to a new release only at an idle reset, never in the
middle of a visitor's session.

---

## 6. Troubleshooting

Before calling for help, open the admin panel and note **Release**,
**Content** and what you saw.

| What you see | Try | Then |
| --- | --- | --- |
| A black or blank screen | Is the screen on? Is the PC on? Press the PC's power button once. | Restart the PC. |
| The exhibit is frozen | Wait 30 seconds; it restarts a frozen page by itself. | Admin panel: **Reload**, then **Restart app**. |
| Touches land in the wrong place | Clean the screen. | Windows *Calibrate the screen for pen or touch input* (Administrator). |
| A film does not play | Other films? If only one: its captions and transcript are shown instead when its video file is missing. | Report the person's name and the release. |
| The Windows desktop is showing | Start *CIHOF Exhibit* from the Start menu. | Restart the PC. If it happens after every restart, check **Start at sign-in** is On and automatic sign-in is set (2.1). |
| "Port 8080 is already in use" | Another copy is already running. Restart the PC. | Report it. |
| "The exhibit could not start" | Restart the PC. | Reinstall the current release (section 4). |
| The new release looks wrong | Recovery panel: **Restore previous release**. | Report it with both release numbers. |
| Some content is missing after an update | Recovery panel: is **Provisioning** complete? | Reinstall the release. |
| The keypad says *Too many tries* | Wait the time it shows. | Forgotten passcode (section 3). |
| A Windows update prompt is on screen | Let it finish, outside opening hours. | Set active hours (2.1). |
| A "has stopped working" box is on screen | Close the box; the exhibit reloads its page. If it does not, admin panel: **Restart app**. | Turn crash reporting off (2.1) and report what the box said. |

---

## 7. Updating content

Content comes from the project's source files and from **review sheets**:
spreadsheets (CSV) a curator fills in and signs. A developer applies a signed
sheet, rebuilds and makes a new installer.

Two principles are built into every step and cannot be switched off:

- **Nothing is approved by being shown.** A preview can show proposed ties
  and unreviewed places for an editor, marked in amber. Only a signed
  decision changes what visitors see.
- **Every decision names the occasion it was made on.** The links, places,
  place-ties and proposed-ties sheets have a `decisionReference` column,
  such as `links-review-2026-09-22`, and their apply tools refuse a decision
  without one. The signed sheet is archived in
  `data/curation-decisions/` beside the change it produced. See that
  folder's README for the naming convention.

### 7.1 The staff review app (Staff: curator)

The easiest way to review. It takes you through each review one item at a
time. It runs in either of two ways:

- **Installed, as the CIHOF Staff Review app**, on any staff computer. It
  needs no git, no Node and no copy of the project: it reads the records
  from a data folder the developer keeps (`npm run review:data`, 7.3), copied
  in each time it opens, and a reviewer's checked decisions leave it as one
  file for the developer to bring in (`npm run review:import`, 7.3).
- **From the project folder**, on the office computer that holds a copy of
  the project (`npm run review`), where saving records each kind of review
  as its own commit.

Either way it offers:

- **Profiles**: each inductee's profile exactly as visitors see it: name,
  class, portrait, the lines under the name, tags and biography. Approve it,
  or say what needs changing. Lines marked *written by the computer* were
  composed from the tags, not by a person: check they say nothing untrue.
  An approval covers those exact words and that picture. If anything on the
  profile changes later, it comes back as *changed since approval* to be
  looked at again. Approving does not hide or show anyone; it records that
  the museum stands behind what is on screen. Every release says how many
  profiles are approved.
- **Connections**: links the research found between two inductees. For each,
  say whether it is a real connection (and what kind: worked together,
  founded something, family, friends, mentored and so on, and which way
  round), two people who simply appear together, or wrong. Decide from the
  evidence shown: a photo caption from a ceremony shows two people at the
  same event, not that they worked together. You write the words visitors
  will read: a short phrase of at most 60 characters, shown under a portrait
  on the Connections map ("worked together to promote Juneteenth"). Where
  the same words show next to both people, name neither of them. Where the
  app shows a *Suggested* decision, it was drafted from the evidence by the
  developer's AI assistant: check it, use it, change it or ignore it.
- **Places**: the words visitors read about each place, and what each
  person did there (lived, worked, studied, taught, organized, served,
  founded). Approve a place's words as they are, start from the plainer
  wording the app suggests, or write your own (one paragraph, up to 420
  characters); your own words are approved as you write them. An approval
  covers exactly those words: if they change later, the place is hidden
  until someone approves the new ones. Places approved before approvals
  recorded the words are still shown, and the app asks for them to be
  looked at again. A place with no history can be given one here. The
  suggested wordings were drafted by the developer's AI assistant from each
  place's own words, adding nothing: check them against the records.
- **Biographies**: find a person, correct the text, and see exactly what you
  changed before keeping it.
- **Attract screen words**: the headline and the line beneath it on the
  display while nobody is using it. Approve them as they are, or write your
  own (a headline of up to 60 characters, a line of up to 140); your own words
  are approved as you write them. Until they are approved, the display shows
  the Hall of Fame's name instead. They appear on the display only: the
  website has no attract screen.
- **Film titles**: what each film is called in a person's list of films.
  Without an approved title a film is described by its length (*A 7-minute
  film*). Each film has a title on YouTube, written by whoever posted it; the
  app offers it as a suggestion. Check the names, and anything it says about
  who inducted whom, then **use the YouTube title** or **write a title**.
  Titles are approved for the display only, where the films are shown.
- **Where ceremony films start**: some inductees' film is a whole induction
  ceremony shared with others (the 2024 ceremony, 1 hour 44 minutes, stands
  for six people). For each of them, choose where it opens, so a visitor sees
  their part first. The app suggests a time from the captions (the stretch
  that names them, and the announcement just before it) with what is said
  there and a link to watch from that second. The captions mishear names, so
  watch before choosing. The display adds a **From the beginning** button.
- **Film captions and transcripts**: the captions are YouTube's automatic
  captions and the transcripts were drawn from them, so both carry the same
  mistakes. The app finds music heard as the word *heat* and the
  transcriber's `[BLANK_AUDIO]` mark in each film, shows where, and offers a
  fix (mark it *[music]*, or remove it). Anything else, such as a misheard
  name, is corrected by choosing the film and typing the words as they are
  and as they should be; the app shows where they are found before you add
  the correction. Every fix changes the captions and the transcript
  together, in every copy of the film.
- **New inductees** (staff portal and project only): each year's class, one
  person at a time, from the Hall of Fame's own record: name, class year,
  region, who inducted them, biography, tags, and a portrait with its
  description, added only once its rights are confirmed. Saved with `npm run class:add`, as below.
- **Portraits and films** (staff portal and project only): a new portrait,
  with its description and the rights confirmed; a film added, with a poster
  taken from it, its captions checked against it and a transcript, and the
  rights confirmed; or a film taken off the display. Files chosen are kept in
  `.review/uploads` by their checksum until saved, then removed.
- **Sign-offs**: the logo, the Windows checklist, each section of the
  sign-off sheet and the approval to open, each accepted by the person
  responsible. The app shows what a section of the sheet confirms; **Accept
  as** signs it with the name entered at the start and today's date, with an
  optional note (the website and audio-description decisions ask what was
  decided). Accept only what is yours to sign: someone else signs by entering
  their own name (*Not you?* at the top). The approval to open is offered
  only once sections 1 to 6 are signed. A sign-off accepted by mistake, or
  one that no longer holds (the display moved), can be cleared, with the
  reason.
- **History** (a link at the foot of the home page): every decision saved in
  the app or applied by the developer, newest first, with who made it and
  the sheet it rests on. Filter by person or by kind. Nothing there can be
  changed.

On **Profiles**, the induction classes run along the top, each with how many
are approved: choose one to work through that class alone, and **Next
undecided** skips what you have already decided. **Find a person** goes to
anyone, approved or not, and **Edit this profile** changes the name and how
it is alphabetised, the communities, honours and countries, the two lines
under the name, and the picture's description and framing, shown as the
profile would be. A line a curator rewrites is credited as a curator's
words; the computer's wording for the edited tags stays the computer's. The
class year, who presented them, the biography (corrected on its own screen),
the portrait file, its rights and every approval are not edited here. An
edit is saved by `npm run profiles:edit`, which refuses it if the profile
changed after the editing began and records every visible difference under
the decision; the profile is then approved again as edited. **As on the display** shows
the profile laid out as the display's record shows it, in its dark or light
colours. With no field selected, **A** approves and the arrow keys move
between profiles.

The home page opens with **Ready for opening?**: everything that still
stands between the exhibit and opening day, read from the records (see
*Ready for opening* below). It changes as reviews are saved and sign-offs
recorded; nothing in it is ticked by hand.

To use it:

1. Double-click **Start staff review** on the desktop. A black window opens
   (leave it open) and then the app opens in the browser.
2. Enter your name. It is saved with every decision you make.
3. Choose a review and work through it. You can stop at any point: your
   choices are kept on that computer until you save them.
4. When you are ready, choose **Check and save**. Say who may see the
   connections you kept (the exhibit only, unless it has been agreed they
   may go online), then **Check my decisions**. If something needs fixing, the
   app says what. When everything checks out, **Save**.
5. Tell the developer. Your decisions are saved on that computer, one change
   per kind of review, with your name on each. They reach the exhibit when
   the developer publishes them and makes a release (7.4).

Nothing in the app is approved by being shown, and nothing leaves the
computer: it answers only that computer, and it never publishes anything
itself.

**Setting it up (Developer, once).** On the office computer: install
Node.js 22 and Git, clone the project, run `npm ci`, and put a desktop
shortcut named *Start staff review* to `apps/review/start-review.cmd`
(on macOS or Linux, `apps/review/start-review.sh`). To publish what was
saved there, push from that computer, or pull its commits onto yours and
push. `npm run review` starts the app from a terminal.

### 7.2 The review sheets, by hand (Staff: curator)

| Sheet | Decides |
| --- | --- |
| `data/review-sheets/links-review-sheet.csv` | Who each inducter name refers to, and whether those links may be shown |
| `data/review-sheets/places-review-sheet.csv` | Places on the map, and their approval |
| `data/review-sheets/place-ties-sheet.csv` | What tie a person has to a place |
| `data/review-sheets/proposed-ties-sheet.csv` | Each connection the research proposes: keep it as a *relationship* (with its kind and wording), as *context* (two people who appear together in a record), or *reject* it |
| `data/review-sheets/media-approval-sheet.csv` | For each film: rights, captions, transcript, and kiosk approval |
| **Biographies**: `npm run review:bios` writes `reports/biographies-sheet.csv` | A corrected biography for anyone, or putting a curator's biography back to the institution's text |
| **Profiles**: `npm run review:profiles` writes `reports/profiles-sheet.csv` | For each person: `approve`, or `changes` with a note saying what. The app is easier |
| **A new class**: `npm run class:template` writes a blank sheet | One row per new inductee: name, year, sort name, region, inducter, the institution's biography, tags, portrait file and its rights |

How to work on one:

1. Ask the developer for a **copy** of the sheet (or take one from the
   repository). Work on the copy, not the file in the repository.
2. Open it in Excel or Google Sheets. Fill in only the empty decision
   columns. Do not change the id columns or the evidence.
3. Fill in `decisionReference` on every row you decide, and a `note` where
   the reason is worth keeping. (The media sheet has no reference column:
   record who approved the films, and when, in `media_notes`, and give the
   developer the reference to pass with `--decision-reference`.)
4. Save it as CSV and give it to the developer.

For the biography sheet, `correctedText` is the **whole** corrected
biography, not only the changed words. A corrected biography is shown as a
curator's text; the institution's original is kept untouched in the
roster.

For a new class, put each portrait in the same folder as the sheet and
give its file name in `portraitFile`. Every new person needs a portrait
file. Its rights can be `pending`, and the portrait stays off screen until
they are `approved`. Take the name exactly as the institution records it:
the person's permanent id is made from the name and year and never
changes.

To see proposed content before deciding, ask the developer for a **preview
build** (`npm run dev:preview`). It shows everything the sources hold, marked.
It is for editors only and is never installed on the display or published.

### 7.3 Applying a sheet (Developer)

Every apply tool **previews first and writes nothing** until told to. Commit
or stash any work first; the tools that take `--expect-hash` refuse a working
tree with uncommitted changes, so their result is a clean, reviewable diff.

```sh
# 1. Preview. Prints what would change and the sheet's hash.
npm run links:apply  -- --input=<sheet>
npm run places:apply -- --input=<sheet>
npm run ties:apply   -- --input=<sheet> --targets=kiosk      # or kiosk,public-web
# 2. Apply exactly the sheet that was previewed.
npm run <tool>:apply -- --input=<sheet> [same options] --apply --expect-hash=<hash>

# Biographies, profile approvals and new classes work the same way.
npm run bios:apply   -- --input=reports/biographies-sheet.csv
npm run profiles:apply -- --input=reports/profiles-sheet.csv
npm run text:apply   -- --input=<sheet>                      # the attract screen's words
npm run class:add    -- --input=<folder>/class-2027.csv      # new inductees; the portal writes this sheet too
npm run portraits:replace -- --input=<sheet>                 # a new portrait, from the portal's uploads
npm run films:change -- --input=<sheet>                      # a film added or taken off, likewise

# Curated metadata and media approvals preview the same way; --apply writes.
# A change visitors will see needs the decision it rests on.
npm run curate:apply -- --input=<sheet> --decision-reference=<reference>
npm run curate:apply -- --input=<sheet> --decision-reference=<reference> --apply
npm run media:apply  -- --input=<sheet> --decision-reference=<reference> [--apply]

# A replaced portrait: put the new file where the old one was, then
npm run portraits:record -- --ids=<id> --decision-reference=<reference> [--apply]
```

Every preview lists **what visitors will see differently** from the record
the exhibit first published. On `--apply` each tool records those
differences, with the decision reference, in
`data/cihof_reviewed_differences.json`, so `npm test` keeps passing. It
records only the people its own sheet changed: a difference nobody decided
still fails the tests, which is how a broken build is caught.

`media:apply` checks that every film approved for the kiosk has its video
file, so it must run on the machine that holds the videos
(`public/media/videos/`, section 8).

**A place's words** (name, neighbourhood and history, in
`data/cihof_places.json`) are covered by its approval: the places sheet
carries each place's `contentVersion`, `places:apply` refuses a row whose
words have changed since the sheet was made, and a `newHistory` column
replaces the history with the reviewer's words, approved as written.
`npm run build:kiosk` names any place held back because its words changed.

**Film caption and transcript fixes** are applied by
`npm run films:captions:apply` from a sheet
`filmId,fix,find,replaceWith,decisionReference,note`, with `fix` one of
`music` (`replaceWith` `[music]`, or empty to remove), `blank` or `phrase`
(`find` and `replaceWith` exactly as written). Each is applied to the
captions and transcript of every copy of the film, recorded in
`data/cihof_caption_fixes.json`, and refused if it would change nothing. In
the captions only the lines a fix touches change.

**Sign-offs** are recorded by `npm run signoffs:apply` from a sheet
`id,action,by,date,reference,scan,note` (`sign` or `clear`); the review app
writes one when someone accepts. A sign-off that `asks` a question needs the
answer in `note`, and the approval to open needs sections 1 to 6 signed
first. A signature given on paper can still be recorded this way, with a
scan filed in `data/curation-decisions/signoffs/`.

**Ceremony film starts** live in `data/cihof_film_starts.json`. The staff
review app does this (7.1). By hand, `npm run films:starts:apply` takes a
sheet `personId,filmId,decision,startSeconds,decisionReference,note`, with
`start` and a time (`1:17:42`) or `beginning`. An approval names the exact
second it covers. `npm run review:film-starts` redrafts the suggestions in
`data/review-sheets/film-start-drafts.json` from the captions.

**Film titles** live in `data/cihof_film_titles.json`, shown only in the
exact words approved, and on the display only. The staff review app does
this (7.1). By hand, `npm run films:titles:apply` takes a sheet
`filmId,decision,title,decisionReference,note`, with `approve` and the title,
or `clear`. The published record had no film titles, so each title is
recorded in `data/cihof_reviewed_differences.json` for everyone whose film it
is, under the sheet's decision reference. `npm run source:film-titles` collects each film's YouTube title
into `data/external-research/youtube-film-titles.json`, unreviewed: nothing
reads that file into the exhibit, and the review app offers its titles only
as suggestions.

**New portraits and films** come from the staff portal's Portraits and
films (7.1). By hand, `npm run portraits:replace` takes a sheet
`id,contentVersion,upload,portraitAlt,focalPoint,rightsConfirmed,decisionReference,note`
and `npm run films:change` a sheet
`personId,decision,filmId,film,poster,captions,transcript,durationSeconds,title,rightsConfirmed,captionsChecked,transcriptChecked,decisionReference,note`
(`add` or `withdraw`). Each file is an upload in `.review/uploads` named by
its SHA-256 (`--uploads=<folder>` for another). A new portrait is copied
beside the old one in `public/media/images`, approved, and its profile's
approval lapses. A new film is copied with its poster, captions and
transcript into `public/media/videos`, approved for the display only, with
no YouTube id: that is how a film the hall added is told from the 93
delivered ones. The delivered films stay in the display's films folder; a
film the hall added reaches the display in a content update (the portal's,
or `npm run content:update`, which carries such films). Visible differences
are recorded under the sheet's decision reference.

**The attract screen's words** live in `data/cihof_exhibit_text.json` and
are shown only once a curator approves the exact words. The staff review app
does this (7.1). By hand, `npm run text:apply` takes a one-row sheet:
`block,decision,contentVersion,headline,tagline,decisionReference,note`, with
`approve` and the `contentVersion` that `npm run build:kiosk` prints, or
`reword` with the new words. Changing a word afterwards holds the words back
until they are approved again. `npm run build:preview` shows unapproved words
on the attract screen, marked, so they can be judged in place.

Then run the checks, review the diff and commit:

```sh
npm run typecheck && npm test
npm run crosswalk:check && npm run review:links:check && npm run review:places:check && npm run review:ties:check
npm run media:assert
```

After a new class, also run `npm run media:validate`, check the new people
with `npm run dev`, and commit any portrait the build copies into
`apps/exhibit/public/media/images/`. If the class brought a new inducter
name, it is waiting in the links sheet for review.

If a test reports an unrecorded difference, `npm run parity:report` lists
it. Find the decision behind it and record it with
`npm run parity:record -- --ids=<id> --decision-reference=<reference>`; a
difference no decision made is a fault to fix, not to record.

**Decisions from the CIHOF Staff Review app** arrive as a file,
`cihof-decisions-<reviewer>-<date>-<time>.json`. Bring them in on a clean
checkout:

```sh
npm run review:import -- --input=<file>            # checks every decision, writes nothing
npm run review:import -- --input=<file> --apply    # one commit per kind of review, under the reviewer's name
```

It saves them exactly as the app does in the project, with the day the
reviewer decided. An approval of something that has changed since the
reviewer saw it is refused, and that kind of review is not saved: ask them
to look again. Then look the commits over and push.

**The app's data folder** is kept up to date with

```sh
npm run review:data -- --out=<folder>    # e.g. a folder on the shared drive
```

which copies every file git tracks under `data/` and `public/media/` (the
records, portraits, and the films' posters, captions and transcripts; never
the films) and removes what the project no longer has. Run it after pulling
or applying decisions; reviewers see the change the next time they open the
app. **The app itself** is built with `npm run package:review-app`
(`-- --target=win-zip` for a portable Windows folder from any system) into
`release/review-app/`. It carries the review's code and no records. Build a
new one when the review app itself changes.

### 7.4 Making a release (Developer, on the machine with the videos)

```sh
npm ci
npm run package:kiosk-app              # on Windows: the installer, in release/app/
npm run package:kiosk-app -- --target=win-zip   # from any system: a portable Windows folder
npm run package:kiosk-app -- --with-films       # carry the films inside, about 20 GB more
```

**The films are not in the installer** unless `--with-films` is given, so it
stays small (about 150 MB instead of 21 GB). The display plays them from a
**films folder**: a copy of `public/media/videos` from the machine with the
videos, on the display's own drive, chosen once in the admin panel (**Films**,
section 2). The setting stays across releases; copy the folder again only
when films are added or changed. `MANIFEST.json` in the release lists, under
`films.expectedInFolder`, every file the folder must hold.

The installer can only be built on Windows (or with Wine). Before handing it
over:

- read the summary it prints: people, relationships, and the films. A release
  that carries its films should say **all of them** have their video file;
  `MANIFEST.json` beside the installer in `release/app/` lists any that do
  not (the kiosk package the app is built from is removed once the app is
  built; `--keep-package` keeps it);
- play every film in the app the step above staged (from this project's
  `public/media/videos`, as a films folder, unless the app carries them;
  `--videos=<folder>` checks another folder, such as the copy for the display):

  ```sh
  npm run films:check
  ```

  It opens each person's record and film as a visitor would, in the kiosk
  app (which plays MP4 as the display will), and checks that the video plays
  with a picture and sound, is as long as the exhibit expects, opens at the
  person's part if it is a ceremony film, and has its captions shown and a
  transcript. It ends with **All 93 films play**, or names each film with a
  problem and what it is. The report is in `reports/films/<date>/`; hand it
  over with the installer. `--only=<person or film id>` checks one again.
  Whether the captions say what is said is still for people;
- note the release and content numbers for the handover.

There is also a browser-based package (`npm run package:kiosk`) that runs
with Edge instead of the app, documented in the `README.txt` inside it. The
app is the supported route; the browser package is a fallback.

`release/` is ignored by git on purpose. Nothing in it is ever committed or
published.

### 7.5 A content update instead of a release (Developer)

When only the content has changed (words, approvals, tours, portraits),
the display does not need a new installer: it takes a content update (see
*Content updates*, section 3). The staff portal makes these from staff edits;
the same can be made from this project:

```sh
npm run content:update -- --from=<the display's export> --by="Your name" --summary="What changed"
```

`--from` is the file the display exported (admin panel, **Content › Export
current content…**). The update is this project as it stands (the kiosk build
of the exhibit's data and media, and the source git tracks under `data/`
and `public/media/`, films aside), made from that export, so it carries only what the display lacks
and the display refuses it if it has moved on since. It is written to
`release/content/`. Like a release, it carries kiosk-only content: never
publish it. A change to the exhibit's code (`apps/exhibit/src`) still needs a
new installer; an update changes content only, and the display refuses one
whose data is a newer version than the app shows.

---

## 8. Backups (Developer and Administrator)

Three things hold the exhibit. Everything else can be rebuilt from them.

| What | Where | Size | How |
| --- | --- | --- | --- |
| **The project repository**: all content, decisions, signed sheets, the code | GitHub (`hgw3lls/cihof`) | small | GitHub keeps it. Also make a local copy after each release: `git bundle create cihof-<date>.bundle --all` and store it with the video backup. |
| **The film video files**: the 93 films the exhibit shows | `public/media/videos/` on the developer's machine. **Not in the repository.** The folder may also hold other downloads; back up all of it. | tens of GB (the folder was about 41 GB) | Copy the whole folder to two external drives, one kept off site. Refresh after any new film. |
| **The installer of each release** | `release/app/` | about 150 MB, or 21 GB with the films | Keep the current and the previous installer on the same drives. They carry kiosk-only content (and, built `--with-films`, the films): store them like the videos, never on a shared link. |
| **The display's films folder** | on the display PC | about 20 GB | A copy of the film video files. If the display's drive fails, copy them to the new one from the video backup and choose the folder again in the admin panel. |

The display holds two things of its own. Its `settings.json` contains only
the passcode (stored scrambled), the restart time, start-at-sign-in, the
attract screen and the films folder. Its **content updates** are kept in the
app's own data folder, with every version since delivery. To keep a copy, use
the admin panel's **Content › Export current content…** after each update and
store the file with the backups: it holds everything the display shows apart
from the films folder (films an update brought are included). To rebuild a
display, reinstall, set the passcode again, choose the films folder, and load
that export as an update (**apply it anyway** when the panel says it was made
from another version).

Check the backup at least once: restore the bundle into a fresh folder
(`git clone cihof-<date>.bundle`), copy the videos into place, and confirm
`npm run media:assert` and `npm run package:kiosk` succeed, and that the
package reports all 93 films with their video file.

---

## What still needs a developer

Every content task has a sheet and a tool. What still needs someone who
works in the repository:

1. **Publishing and releasing.** The staff review app (7.1) saves
   connections, places and biographies on its computer; pushing those
   changes, and making a release, are a developer's commands. Links, film
   approvals and new classes are still reviewed in sheets (7.2) and applied
   by a developer (7.3).
2. **A new film.** Its captions, poster and transcript must be added to git
   explicitly (`git add -f`); `npm run media:assert` fails until they are.
3. **A person's id.** It is permanent and is never changed. A name spelled
   wrongly when the person was added is corrected in `displayName`
   (`curate:apply`), not by changing the id.

## What the machines check: accessibility and endurance (Developer)

`npm run test:browser` includes an accessibility scan of every screen a
visitor reaches (the three attract screens, People, Years, Connections,
Places, a record, a film, *Take it with you* and the warning before a visit
ends), in the dark theme and the light one, against WCAG 2.1 A and AA. It
fails on any violation, so CI stops a release that brings one in.

An endurance run leaves a display build running for hours with simulated
visitors: starting from the call to action, a face or a name, looking
through a lens or two, opening a record, watching part of a film or taking
the record away, then touching *Start over* or walking off and letting the
display end the visit. After each visit it measures what the page holds.

```sh
npm run package:kiosk                        # the display build, in release/
npm run endurance -- --minutes=480           # a working day, on that build
npm run endurance -- --channel=msedge        # in Edge, as on a display (Windows)
npm run endurance -- --url=http://localhost:8080/   # a display already running
```

It prints each visit as it goes and writes `endurance.md` and
`endurance.json` to `reports/endurance/<date>/` (ignored by git). The report
lists anything to look at: a visit that did not return to the attract
screen, something a visitor could not do, an error, or memory, elements or
listeners that climb rather than level off. It exits with 1 if there is
anything. Ctrl+C stops early and still writes the report. The first run of
it found every closed film kept in memory for as long as the page ran; that
is fixed, and a browser test now guards it.

The display runs the kiosk app, not a browser, so the app has an endurance
run of its own. It starts the app with settings of its own (its own port, a
temporary folder), so the display's settings and passcode are never touched,
and checks in order that the app:

1. starts on its attract screen, served from this computer;
2. comes back by itself after its daily restart (set a couple of minutes
   ahead for the run);
3. holds up under simulated visits, measured as above;
4. comes back by itself when the exhibit page crashes;
5. comes back by itself when the exhibit page freezes, with nobody touching it;
6. starts again as it was after being killed outright, as a power cut would;
7. never asked for anything beyond this computer, which is what unplugging
   the network must not change.

```sh
npm run endurance:app -- --minutes=480       # on the app staged in apps/kiosk-app/stage
npm run endurance:app -- --executable="C:\Program Files\CIHOF Exhibit\CIHOF Exhibit.exe"
```

On the display PC, close the exhibit app first: two cannot run at once. It
writes `endurance-app.md` and `endurance-app.json` to
`reports/endurance/app-<date>/`, and exits with 1 if a check failed. Its
first run found that a frozen page was only restarted once someone touched
it, so a wall that froze overnight stayed frozen until the morning's first
visitor. The app now also restarts a page that stops checking in for 30
seconds.

CI runs the app too, on every change: its end-to-end test, then a short
endurance run without films (CI has no video files; `npm run films:check`
covers them on the build machine).

Killing the app is not switching the PC off. Whether Windows starts the app
again after a real power cut is still checked on the display.

Neither replaces the checks below. Give the endurance reports to the
administrator with the release; they are evidence for section 4 of the
sign-off sheet, which is still five days on the display itself.

## Checks that people must do

The automated tests check the software in a browser. They do not certify
the installation. These stay with the people responsible for them:

- reach and mounting height of the screen, for standing and seated visitors;
- touch accuracy across the whole screen;
- assistive technology and accessibility review;
- endurance: the display running unattended for several days;
- curatorial review of the content shown;
- rights for every portrait and film.

The [sign-off sheet](sign-off.md) lists what each of them checks. The person
responsible accepts their section in the review app's **Sign-offs**, before
the exhibit opens and again after any move of the display.

## Ready for opening

The [opening plan](opening-plan.md) puts what is left in order: who does
what, and what each step waits on.

```sh
npm run readiness              # what is still open
npm run readiness -- --strict  # and fail if anything is
```

It lists what the staff review app still has open (profiles, places, the
attract words, where ceremony films start) and every sign-off in
`data/cihof_opening_signoffs.json`: the logo, the caption choices, whether
the public website goes live (and so whether the display shows take-home
codes), audio description for the films, the Windows checklist, the six
sections of the sign-off sheet and the approval to open. The same list heads the review app's home page.

It only reads the records. A sign-off counts once its entry names who signed
(`by`), when (`date`) and what it rests on (`reference`: the review app's
decision reference, or a signed record kept in
`data/curation-decisions/signoffs/`). The person responsible accepts it in
the review app's **Sign-offs**, under their own name; the check shows it
done once it is saved. It cannot see anything the records do not hold, such as a connection
someone thinks deserves a second look: raise those in the review app.
