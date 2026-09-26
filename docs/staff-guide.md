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
colours for a bright room (below). Films always play on black. The public
website follows the visitor's phone or computer.

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
6. **Optional, strictest lockdown**: Windows 11 Pro/Enterprise can run one
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
| **Restart app** | Closes and reopens the application. |
| **Exit to desktop** | Closes the exhibit. It stays closed until someone starts it (Start menu, *CIHOF Exhibit*) or the PC restarts. |
| **Debugging** | Developer tools, menus and window, and mouse pointer. For a developer diagnosing a problem. **They turn themselves off at the next restart**, including the nightly one, so a display is never left in debug mode. |
| **Daily restart** | The time of the nightly restart, or Off. 04:00 unless changed. |
| **Start at sign-in** | Whether the exhibit opens when Windows signs in. Leave it On. |
| **Attract screen** | What the display shows while nobody is using it: **Mosaic** (every portrait in greyscale, one in colour), **Name wall** (every name in slow rows, no photographs) or **Stacked** (names above a strip of portraits). **Rotate through all three** shows a different one each time the display goes idle. **Spotlight moves every** 4, 6 or 10 seconds. **Motion** Off stops the drifting rows. **Colours**: **Dark** (as designed) or **Light**, for the whole exhibit. **Preview for 30 s** shows your choice without saving it; **Save** keeps it and shows it straight away. |
| **Change passcode** | Choose a new passcode. |

Close the panel with **Close** at the top right.

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
   values.

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

The easiest way to review. It runs on one office computer that holds a copy
of the project, and it takes you through each review one item at a time:

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
- **Sign-offs**: record a signature someone gave outside the app (the logo,
  the Windows checklist, each section of the sign-off sheet, the approval to
  open): who signed, when, and where the signed record is kept, with a scan
  of the signed sheet if you have one. Recording is not signing: the app
  notes who recorded it. A signature recorded by mistake, or one that no
  longer holds (the display moved), can be cleared, with the reason.
- **History** (a link at the foot of the home page): every decision saved in
  the app or applied by the developer, newest first, with who made it and
  the sheet it rests on. Filter by person or by kind. Nothing there can be
  changed.

On **Profiles**, the induction classes run along the top, each with how many
are approved: choose one to work through that class alone, and **Next
undecided** skips what you have already decided. **As on the display** shows
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
npm run class:add    -- --input=<folder>/class-2027.csv

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
`id,action,by,date,reference,scan,note` (`sign` or `clear`). A scan is filed
in `data/curation-decisions/signoffs/`.

**Ceremony film starts** live in `data/cihof_film_starts.json`. The staff
review app does this (7.1). By hand, `npm run films:starts:apply` takes a
sheet `personId,filmId,decision,startSeconds,decisionReference,note`, with
`start` and a time (`1:17:42`) or `beginning`. An approval names the exact
second it covers. `npm run review:film-starts` redrafts the suggestions in
`data/review-sheets/film-start-drafts.json` from the captions.

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

### 7.4 Making a release (Developer, on the machine with the videos)

```sh
npm ci
npm run package:kiosk-app              # on Windows: the installer, in release/app/
npm run package:kiosk-app -- --target=win-zip   # from any system: a portable Windows folder
```

The installer can only be built on Windows (or with Wine). Before handing it
over:

- read the summary it prints: people, relationships, and how many films have
  their video file. **All of them should.** `MANIFEST.json` in
  `release/cihof-kiosk-<release>/` lists any that do not;
- note the release and content numbers for the handover.

There is also a browser-based package (`npm run package:kiosk`) that runs
with Edge instead of the app, documented in the `README.txt` inside it. The
app is the supported route; the browser package is a fallback.

`release/` is ignored by git on purpose. Nothing in it is ever committed or
published.

---

## 8. Backups (Developer and Administrator)

Three things hold the exhibit. Everything else can be rebuilt from them.

| What | Where | Size | How |
| --- | --- | --- | --- |
| **The project repository**: all content, decisions, signed sheets, the code | GitHub (`hgw3lls/cihof`) | small | GitHub keeps it. Also make a local copy after each release: `git bundle create cihof-<date>.bundle --all` and store it with the video backup. |
| **The film video files**: the 93 films the exhibit shows | `public/media/videos/` on the developer's machine. **Not in the repository.** The folder may also hold other downloads; back up all of it. | tens of GB (the folder was about 41 GB) | Copy the whole folder to two external drives, one kept off site. Refresh after any new film. |
| **The installer of each release** | `release/app/` | varies | Keep the current and the previous installer on the same drives. They contain kiosk-only films: store them like the videos, never on a shared link. |

The display itself holds nothing that cannot be reinstalled. Its
`settings.json` contains only the passcode (stored scrambled), the restart
time and start-at-sign-in. To rebuild a display, reinstall and set the
passcode again.

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

Record who checked each one and when on the printed
[sign-off sheet](sign-off.md), before the exhibit opens and again after any
move of the display.

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
(`by`), when (`date`) and what it rests on (`reference`: the scanned sheet,
kept in `data/curation-decisions/signoffs/`, or where the signed paper is
kept). Record one in the review app's **Sign-offs**, and only from a real
signature; the check shows it done straight away. It cannot see anything the records do not hold, such as a connection
someone thinks deserves a second look: raise those in the review app.
