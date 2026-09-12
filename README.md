# CIHOF Persistent Hall

Interactive Cleveland International Hall of Fame exhibit built with Vite, React, and TypeScript.

The public visitor app is no longer a set of separate destination pages. It is one persistent Hall surface: the same keyed portrait collection stays mounted while visitors change how the Hall is arranged.

## Public Visitor Model

The core visitor state is:

```ts
type HallLens = 'portraits' | 'traces' | 'legacies';
type HallFocus = { personId: string } | null;
```

- `HallLens` changes the arrangement of the Hall.
- `HallFocus` changes emphasis within the Hall.
- Neither should replace the Hall with a separate public page.

Public global navigation contains only:

- `PORTRAITS`
- `TRACES`
- `LEGACIES`

Curated visit paths are still supported as an internal/deep-link route at `?lens=journeys`, shown in the app chrome as `VISIT PATHS`. That route is for saved visits, operator links, and regression coverage; it is not a fourth public navigation lens.

The public app must not expose `Living Hall` as visitor-facing language. That name may still appear in internal file names from earlier implementation phases.

## Current Visitor Experience

### PORTRAITS

Default Hall arrangement. Inductees appear as persistent portrait frames in a contemporary interpretation of a physical Hall-of-Fame portrait wall.

Touching a portrait focuses that same frame in place and reveals concise adjacent context:

- name
- class year
- documented context line
- `HONORED FOR` summary

### TRACES

Relationship, concept, and documented-place arrangement. This replaces the old public roles of Connections, Follow a Thread, World, Routes, and related screens.

TRACES keeps the focused portrait as the anchor, reorganizes nearby persistent frames around documented or curated relationships, and draws restrained relationship lines between the actual frame objects. Geography remains guarded: no inferred migration, no invented relationships, and no directional movement unless explicitly documented.

### LEGACIES

Chronological arrangement. This replaces the old public Time screen.

Existing frames animate into induction-class order by real `classYear`. The collection itself is the timeline, with one or two horizontal rows, class labels in the field, drag/swipe navigation, and accessible non-drag chronology controls.

## Focused Person Actions

A person is a focused condition of a portrait frame, not a public destination.

Focused actions stay anchored to the Hall:

- `LIFE + WORK` opens an adjacent reading area.
- `WATCH INDUCTION` opens an anchored media area only when approved media exists.
- `TAKE IT WITH YOU` opens an anchored QR continuation layer with auto-close behavior.

Closing any action returns to the same focused portrait and lens.

## Staff And Admin

The staff portal is a separate app at `portal.html`. It owns review, editing, curation, source-data queues, runner controls, and data-management workflows.

The public visitor screen includes only a hidden password-protected admin panel for kiosk operations:

- runtime data import/export
- app settings
- admin password and hotkey settings
- diagnostics

The hidden admin is not a profile curation interface.

## Data Flow

Canonical source data lives under `data/`.

Important authored/source files:

- `data/cihof_kiosk_manifest.csv`
- `data/cihof_curated_metadata.json`
- `data/cihof_relationships.json`
- `data/cihof_curated_entities.json`
- `data/cihof_story_lenses.json`
- `data/cihof_story_sections.json`
- `data/media_manifest.json`
- `data/physical_wall_positions.json`

Runtime data is generated into `public/data/`, including:

- `public/data/cihof-runtime-data.json`
- `public/data/inductees.json`
- `public/data/entities.json`
- `public/data/entity-relationships.json`
- `public/data/story-lenses.json`
- `public/data/story-sections.json`
- `public/data/media-manifest.json`
- `public/data/physical-wall-positions.json`

Generate runtime data with:

```sh
npm run prepare:data
```

Run local diagnostics with:

```sh
npm run audit:data
npm run curate:report
npm run media:validate
npm run validate:entities
```

`public/data/data-audit.local.json` is local ignored audit output.

## Current Data Status

Latest audit snapshot, September 12, 2026:

- `111` inductees
- `111/111` primary image paths present
- `0` duplicate IDs
- `0` generic image candidates
- `450` generated entities
- `1,889` generated entity relationships
- `0` explicit curated relationship records
- `111/111` curated metadata records structurally present
- `0` public-approved profile summaries/context/HONORED FOR/Life + Work fields
- `64` profiles currently have video links in generated runtime data
- `1,204` remote media references remain in the offline validation report
- kiosk-ready media approval/localization remains the main production content gap

The architecture is ahead of the approved content. The next major work should move source-derived suggestions into curator-approved canonical data.

## Project Structure

```text
src/app/                         app shells, navigation state, kiosk health/settings
src/features/hall-surface/       persistent visitor surface wrapper
src/features/living-hall/        persistent Hall arrangement and focus behavior
src/features/inductee-detail/    anchored Life + Work and Watch components
src/features/admin/              hidden visitor admin panel
src/features/review-dashboard/   separate staff portal app
src/components/                  shared frame, QR, trace, fallback primitives
src/data/                        runtime loaders and relationship/trace models
src/styles/final-exhibit/        active visitor exhibit styling
scripts/                         data, curation, media, runner, and validation scripts
tests/                           Playwright acceptance and regression tests
docs/                            architecture, portal, installation, and planning notes
```

## Run Locally

Use Node 22. This repo includes `.nvmrc` and `.node-version`.

```sh
npm install
npm run dev
```

Open the visitor app:

```text
http://127.0.0.1:5173/
```

Open kiosk mode:

```text
http://127.0.0.1:5173/?kiosk=1
```

Open the staff portal:

```sh
npm run dev:portal
```

```text
http://127.0.0.1:5173/portal.html
```

Start the local staff portal runner in a second terminal:

```sh
npm run portal:server
```

The runner prints a token. Paste it into the portal runner panel.

## Build

Build public visitor output:

```sh
npm run build:public
```

Build separate staff portal output:

```sh
npm run build:portal
```

Outputs:

```text
dist/
dist-portal/
```

These build outputs are ignored by git.

## Validation

Core checks:

```sh
npm run prepare:data
npm run validate:entities
npm run validate:offline
npm run build:public
npm run build:portal
```

Media readiness:

```sh
npm run media:validate -- --strict --profile=wall
npm run validate:media-clearance
```

Browser tests:

```sh
npm run test:kiosk
npm run test:portal
```

Existing Playwright specs cover the persistent Hall acceptance flow, portrait frame system, Cleveland trace language, hidden admin settings, portal readiness, and kiosk smoke behavior.

## Legacy URL Compatibility

Old visitor URLs are intentionally mapped into the persistent Hall model:

- `view=living-hall`, `view=people`, `view=explore`, `view=search` -> `PORTRAITS`
- `view=connections`, `view=journeys`, `view=world`, `view=routes`, `view=places`, `view=region-map` -> `TRACES`
- `view=time`, `view=timeline` -> `LEGACIES`
- `person=...` -> focused persistent portrait frame

Staff/review URLs remain separate.

Internal route note:

- `lens=journeys` is reserved for curated visit paths and saved-visit workflows. It remains supported for operator/deep links, but it is intentionally absent from public global navigation.

## Current Priorities

1. Finish the portal curation workflow for approving profile text fields.
2. Promote documented source-derived relationship candidates into explicit curated relationship records.
3. Localize and approve kiosk-ready primary images and media.
4. Split large active modules after the curation workflow stabilizes, especially `LivingHallView.tsx` and `ReviewDashboardView.tsx`.
5. Keep older plan docs marked as historical when they refer to the pre-Hall page architecture.

See [docs/current-architecture.md](docs/current-architecture.md) and [docs/recent-changes-and-next-plan.md](docs/recent-changes-and-next-plan.md) for the current architecture summary and next plan.
