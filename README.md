# CIHOF

The Cleveland International Hall of Fame exhibit: an offline touch kiosk built on a reviewed data model. A new staff portal for editing that data comes next (see Roadmap).

Staff looking after the installed display: see [`docs/staff-guide.md`](docs/staff-guide.md). Every kiosk package and installer carries a copy.

## Layout

| Path | What it is |
| --- | --- |
| `data/` | Canonical sources: the actual product. `data/review-sheets/` holds the curator sheets. |
| `public/media/` | Media store (portraits, film captions, posters, transcripts). Video files are local-only and gitignored. |
| `packages/content/` | Domain model and publication rules. No framework, no DOM. |
| `packages/pipeline/` | Reads `data/`, emits the published bundle. |
| `apps/exhibit/` | The kiosk. React and Vite, offline service worker, release manifest, recovery panel. |
| `apps/web/` | Static companion pages for the QR take-home. Kept until the QR decision is made (roadmap). |
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
- in admin: release details; back to the start, reload, recovery panel; restart or exit to the desktop; debug switches for developer tools, menus and window, and the mouse pointer, which turn off again at the next restart; the daily restart time, start at sign-in, and the passcode

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
npm run curate:apply     # previews; add --apply to write
npm run media:apply      # previews; add --apply to write

npm run media:validate && npm run curate:report   # reports go to reports/ (ignored)
npm run media:assert                             # every film asset is tracked

# Collect outside sources for review (network); see data/external-research/README.md
npm run source:external-research
npm run source:external-contributions
```

Change canonical sources, never generated output. Never invent historical claims, relationships, dates or portraits, and never change an approval state without an authorized editorial decision.

## Roadmap

The full plan is in [`plans/docs/CLEAN_APP_PLAN.md`](plans/docs/CLEAN_APP_PLAN.md). Remaining work, in order:

1. **Kiosk admin settings**: passcode-gated idle timeout, warning, motion, touch cue and hotkey. First settle whether runtime settings may only lengthen timings (§5.2).
2. **Review-record write path** in `packages/content`: `decisionReference`, `contentVersion` and evidence per claim (§3).
3. **New staff portal** on that model: a visual, guided review app, so approving content is one clear step at a time rather than a spreadsheet of blank columns. Build on the editor's preview (`CIHOF_PREVIEW=all`), which already shows unreviewed items in place. Port the old `scripts/portal-runner.js` from `c8f749c`, keeping its dry-run, hash-match and clean-tree gates, and include the review queue and diagnostics.
4. **QR take-home decision** (§5.1): host `apps/web` durably, or drop Share.
5. **Standards exports** (Linked Art, CIDOC-CRM, IIIF) were produced by the removed `prepare-data.js`. Confirm nobody external consumes them (§5.3), or rebuild them in the pipeline.

The old visitor app and old portal are in git history at `c8f749c`, the last commit before the clean-up. Keep that reference until the new portal has run through one real editorial cycle.
