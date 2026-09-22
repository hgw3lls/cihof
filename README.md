# CIHOF Archive Exhibit

Touch-first visitor exhibit for the Cleveland International Hall of Fame, built with Vite, React, and TypeScript. The public experience is a single screen with three ways into the same collection:

- **People:** searchable, consistently cropped portraits. No inductee is selected on entry. Choosing one pins their identity without repeating the portrait in the grid; the full biography, record notes, and take-home QR are available from there.
- **Links:** a neutral relationship index until someone is selected, then a portrait map centered on that person. Choosing a connected inductee re-centers the map. Archive references and shared induction classes are distinguished.
- **Years:** a horizontal film timeline navigable by touch swipe, mouse drag, wheel, year rail, arrows, and keyboard. Choosing a film carries that inductee into People and Links. Approved films have captions and a transcript; pending films have no public playback.

The selected person persists between scenes, and light mode is the default with a persistent dark-mode switch. The design study remains under `docs/design-concepts/2026-09-17/`; the visitor app is the implementation in `src/features/archive-exhibit/`.

## Run

Use Node 22 (`.nvmrc`).

```sh
npm install
npm run dev
```

Open the visitor URL printed by Vite. The staff review portal is separate at `portal.html` (`npm run dev:portal`). The local portal runner is started with `npm run portal:server` in another terminal.

The visitor entry is `src/app/main.tsx`. The old `src/app/App.tsx`, Living Hall components, and their CSS remain in source for rollback but are not imported into the public visitor bundle. The portal still uses its own entry and review components.

## Media Clearance

The collection currently has 111 inductees and 93 local film records. **All 93 have been reviewed: rights, captions and transcripts are approved, and every film is approved for the kiosk. None is approved for the public web.** That refusal is a deliberate decision, not an outstanding task.

This calls for more care than a pending queue would, not less. A kiosk artifact reaching a public URL does not leak unreviewed material — everything in it has been reviewed — it overrides a decision somebody made on purpose. And because every film also carries a YouTube id, a kiosk build can serve 93 embedded players without a megabyte of video leaving the repository, so an artifact containing no video file has not thereby withheld the films.

The GitHub Pages workflow publishes a preview of `apps/exhibit` built for the public target, which carries no films, and refuses to deploy an artifact that turns out otherwise. See [DEPLOYMENT.md](DEPLOYMENT.md).

An editable 93-row sheet is at [docs/media-approval-sheet.csv](docs/media-approval-sheet.csv). Review and apply it using [docs/media-approval-workflow.md](docs/media-approval-workflow.md). No approval is inferred from a file's presence. `npm run validate:media-clearance` is expected to report pending items until all are reviewed.

`npm run build:kiosk` and the default `npm run build` produce a restricted offline package containing the manifest-listed local film files. Those films are cleared for the kiosk and refused for the public web, so do not publish those outputs publicly. `npm run build:portal` excludes film payloads.

## Build And Test

```sh
npm run build:public
npm run build:portal
npm run validate:entities
npm run test:kiosk
npm run test:portal
```

The public output is `dist/`; the portal output is `dist-portal/`. Playwright tests cover People, Links, Years, pending and approved media states, touch swiping, responsive layouts, hidden admin access, and portal workflows. If the default preview port is occupied, use `CIHOF_PLAYWRIGHT_PORT=4176 npm run test:kiosk` or `CIHOF_PORTAL_PLAYWRIGHT_PORT=4177 npm run test:portal`.

## Data And Operations

Canonical data is under `data/`; `npm run prepare:data` generates `public/data/cihof-runtime-data.json` and standards exports. The runtime bundle currently contains 544 entities and 2,041 entity relationships. Links uses direct person-person archive references plus induction-class context, and does not claim inferred personal relationships as documented facts.

The hidden visitor admin (`?admin=1`, then password) supports local bundle import/export, idle reset, admin access settings, review metrics, and diagnostics. Profile curation belongs in the separate portal. Earlier architecture and launch-planning documents under `docs/` describe prior exhibit iterations; this README and the current code are authoritative for the visitor UI.
