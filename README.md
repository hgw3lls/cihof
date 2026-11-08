# CIHOF

The Cleveland International Hall of Fame exhibit: an offline touch display built on a reviewed data model, and the CIHOF Staff Portal the museum uses to look after its content.

**Start here at handover:** [`docs/handover-checklist.md`](docs/handover-checklist.md), worked through on the day with the display and the staff computer side by side. Where opening stands: `npm run readiness` (the same list as the portal's *Ready for opening?*), and the order of what is left in [`docs/opening-plan.md`](docs/opening-plan.md).

| Who | Read |
| --- | --- |
| Everyone looking after the display | [`docs/staff-guide.md`](docs/staff-guide.md). Every installer and kiosk package carries a copy. |
| Gallery staff | [`docs/training/gallery-staff.md`](docs/training/gallery-staff.md) |
| Whoever looks after the content | [`docs/training/staff-portal.md`](docs/training/staff-portal.md): the staff portal, its studio, display updates, the yearly class, films, backups |
| Reviewers using the review screens | [`docs/training/review-app.md`](docs/training/review-app.md) |
| Administrator, first install on Windows | [`docs/windows-checklist.md`](docs/windows-checklist.md) |
| The people signing off reach, touch, accessibility, endurance, content and rights | [`docs/sign-off.md`](docs/sign-off.md) |
| Anyone using the logo | [`docs/brand/`](docs/brand/skyline-guidelines.md) |

What still needs a developer is listed in the staff guide, *What still needs a developer*.

## Layout

| Path | What it is |
| --- | --- |
| `data/` | Canonical sources: the actual product. `data/review-sheets/` holds the curator sheets. |
| `public/media/` | Media store (portraits, film captions, posters, transcripts). Video files are local-only and gitignored. |
| `packages/content/` | Domain model and publication rules. No framework, no DOM. |
| `packages/pipeline/` | Reads `data/`, emits the published bundle. |
| `apps/exhibit/` | The exhibit, the only visitor surface. React and Vite, offline service worker, release manifest, recovery panel. Also built with its editor for the staff portal's studio. |
| `apps/kiosk-app/` | The display app (*CIHOF Exhibit*, Electron): admin panel, films folder, content updates, the staff connection. Outside the npm workspaces. |
| `apps/review/` | The staff portal and review screens: studio, reviews, display updates. Answers only 127.0.0.1. |
| `apps/review-app/` | The staff portal as a desktop app (*CIHOF Staff Portal*). Outside the npm workspaces. |
| `apps/web/` | Static companion pages for the QR take-home, for when the public website has a lasting address. |
| `docs/` | Staff guide, training, handover, opening plan, sign-off, brand. |
| `scripts/` | Data maintenance: apply curator decisions, reports, media validation and approval sheet, film-asset check, HOF World ingest, external-research collection. |
| `plans/` | Archive of every plan, audit and report. Start at `plans/README.md`. |

## Run

Use Node 22 (`.nvmrc`).

```sh
npm ci
npm run dev            # kiosk, local dev (kiosk target)
npm run dev:preview    # editor's preview: also shows unreviewed places and proposed ties, marked
npm test               # content, pipeline and exhibit unit tests
npm run test:browser   # exhibit browser suite (Playwright)
npm run test:web       # companion site browser suite
npm run typecheck      # packages, exhibit and companion site
```

## Build targets

```sh
npm run build:kiosk    # apps/exhibit/dist with all 93 films. Never publish.
npm run build:public   # no films; also runs the artifact assertion
npm run build:preview  # kiosk build with unreviewed content, marked. Local viewing only.
npm run package:kiosk  # the kiosk build packaged for a display: release/cihof-kiosk-<release>/
npm run package:kiosk-app  # the exhibit as a locked-down desktop app: release/app/
```

All 93 films are approved for the kiosk and for the public web on none of them. That refusal is deliberate. `apps/exhibit` reads `CIHOF_TARGET`, which is required under CI; an unknown value is always an error. GitHub Pages publishes only the public build, and only after `assert:public` has inspected the built bytes. Set `CIHOF_SITE_URL` only for a durable public address, never for a preview.

## Kiosk package

The browser-based alternative to the kiosk app, and the site the app is built from. `npm run package:kiosk` builds the kiosk target served at the root of a local address and writes `release/cihof-kiosk-<release>/`, ready to copy to a display (Windows, macOS or Linux):

- `site/`: the exhibit
- `launch.mjs`: starts the local server and holds Edge or Chrome full screen on it in its own profile. It relaunches the browser if it closes (backing off if it keeps failing) and restarts it daily at 04:00 (`--restart-at`)
- `server.mjs`: a dependency-free local server (Node 22). It listens on 127.0.0.1, answers the byte-range requests films seek with, closes files when a request is cancelled, and never serves outside `site/`
- `start-kiosk` / `stop-kiosk` (`.cmd` and `.sh`): start, which restarts the launcher if it dies, and a clean stop that stays stopped
- `install-autostart` / `uninstall-autostart`: start at sign-in. Windows uses a Startup shortcut and sets screen and sleep to never; macOS a LaunchAgent; Linux an autostart entry
- `README.txt` for museum staff, and `MANIFEST.json`: release, content revision, source commit, and every film whose video file was missing on the machine that built it

Signing in automatically, powering on after a power cut, and Windows Assigned Access are set on the PC itself; `README.txt` says how. `release/` is ignored by git. The package carries kiosk-only films: never publish it.

## Kiosk app

`npm run package:kiosk-app` builds the exhibit as a desktop app with its own browser engine (Electron), in `release/app/`: a Windows installer when run on Windows (`--target=win`), or `--target=win-zip` (portable, buildable anywhere), `mac`, `linux`. It is the recommended way to run a display:

- one full-screen window on the exhibit, served from the app itself: no menus, no right-click, no browser shortcuts (reload, zoom, developer tools, print), no navigating away, no pinch zoom, pointer hidden
- a crashed or frozen page reloads itself; the app restarts daily (04:00 by default), keeps the screen awake, and starts at sign-in on Windows and macOS
- hidden admin settings: hold the top-left corner for 5 seconds, or press Ctrl+Shift+A, then the passcode. The first passcode can only be set with the keyboard shortcut, so a visitor cannot claim a fresh display. Five wrong tries lock the keypad
- no films inside by default, so the installer is about 150 MB: the display plays them from a films folder chosen in admin (`--with-films` carries all of them, about 20 GB more)
- in admin: release details; where the films come from and how many are found; back to the start, reload, recovery panel; restart or exit to the desktop; debug switches for developer tools, menus and window, and the mouse pointer, which turn off again at the next restart; the daily restart time, start at sign-in, and the passcode

The app lives in `apps/kiosk-app`, outside the npm workspaces, so its Electron download happens only when packaging. `node --test apps/kiosk-app/tests/*.test.mjs` (part of `npm test`) covers its input, navigation and passcode rules; `npm run test:app` in `apps/kiosk-app` drives the real app (needs a display, or `xvfb-run` on Linux). Build it on the machine that holds the films, and never publish it.

## Editor's preview

`npm run dev:preview` shows everything the sources hold: every seeded place and every tie the HOF World corpus proposes, alongside what is already approved. Each unreviewed item is marked in amber, and Connections can switch the proposed ties off to show the map as a visitor sees it. The proposed ties are listed one per row in `data/review-sheets/proposed-ties-sheet.csv` (`npm run review:ties`), with the corpus's evidence and empty columns for the decision: `relationship` (with a kind and wording), `context` (two people who appear together in a record, drawn as its own quieter layer), or `reject`. `npm run ties:apply` records them in `data/cihof_tie_decisions.json`; a decided tie is no longer proposed. Nothing is approved by being shown. Decide in the review sheets under `data/review-sheets/` and apply them, and a normal build then shows what was kept.

A preview is refused under CI and for the public target, and `assert:public` fails on any artifact that carries one.

## Keeping data current

```sh
npm run crosswalk:check && npm run review:links:check && npm run review:places:check && npm run review:ties:check

# Apply signed-off curator decisions from data/review-sheets/
npm run links:apply
npm run places:apply
npm run ties:apply       # the proposed-ties sheet; needs --targets=kiosk (or kiosk,public-web)
npm run curate:apply     # previews; --decision-reference=… --apply to write
npm run media:apply      # previews; --decision-reference=… --apply to write
npm run review:bios && npm run bios:apply      # correct a biography (sheet in reports/)
npm run review:profiles && npm run profiles:apply   # approve profiles as they stand; --report for the counts
npm run class:template && npm run class:add    # add a new induction class
npm run portraits:record                       # checksum and size of a new or replaced portrait

# What visitors see differently from the published record, and the decision
# behind each: data/cihof_reviewed_differences.json. The tools above record
# it; npm test fails on anything unrecorded.
npm run parity:report
npm run parity:record -- --ids=… --decision-reference=…

npm run media:validate && npm run curate:report   # reports go to reports/ (ignored)
npm run media:assert                             # every film asset is tracked

# Collect outside sources for review (network); see data/external-research/README.md
npm run source:external-research
npm run source:external-contributions
```

Change canonical sources, never generated output. Never invent historical claims, relationships, dates or portraits, and never change an approval state without an authorized editorial decision.

## Open at handover

1. **Opening.** `npm run readiness` lists what is still open: the last researched place and what six people did at their places, the audio description decision for the films, the Windows checklist, sign-offs 1 to 6 and the approval to open. All of them are for people, not for code.
2. **The public website's address.** It is decided that the website goes live; a lasting address is not yet chosen. Until `CIHOF_SITE_URL` is set to it, the display offers no take-home codes and `apps/web` stays unhosted ([`plans/docs/CLEAN_APP_PLAN.md`](plans/docs/CLEAN_APP_PLAN.md) §5.1).
3. **Standards exports** (Linked Art, CIDOC-CRM, IIIF) were produced by the old `prepare-data.js` and are not produced now. Confirm nobody outside the museum used them (§5.3), or rebuild them in the pipeline.
4. **A redesign of the staff portal and the display's admin panel** is planned, after handover.

The old visitor app and old portal are in git history at `c8f749c`, for reference only.

## The staff portal

`apps/review` runs three ways. It always answers only 127.0.0.1, applies decisions with the same tools as the sheets above, never pushes, and never decides anything the reviewer did not choose.

- **In the project:** `npm run review` opens it on this computer. Each kind of review is committed locally under the reviewer's name. Staff guide 7.1.
- **Installed, on a data folder:** `npm run package:review-app` builds *CIHOF Staff Portal* in `release/review-app/` (`--target=win-zip` for a portable Windows folder from any system). It needs no git, Node or copy of the project. It reads a data folder kept with `npm run review:data -- --out=<folder>`, and a reviewer's checked decisions leave it as one file, which `npm run review:import -- --input=<file> --apply` saves in the project, one commit per kind of review under the reviewer's name.
- **Installed, on a display's content:** the way the museum works day to day. The portal opens a display's content export (by USB stick, or over the staff connection the display's admin panel opens for a set time), changes it in the studio (the exhibit itself with its editor, built by `npm run review:shell`), and after approval makes a display update the display applies at its next reset. No git is involved. [`docs/training/staff-portal.md`](docs/training/staff-portal.md) walks through it.

The studio's editor build is never the display's or the website's build; those compile a stub and are refused if they carry it.
