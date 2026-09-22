# CIHOF repository guidance

## Active product surfaces

- The visitor entry is `index.html` -> `src/app/main.tsx` -> `src/features/archive-exhibit/ArchiveExhibit.tsx`.
- The visitor scenes are People, Links, and Years. Preserve canonical person IDs, compatible deep links, and selected-person continuity across all three.
- The staff portal is a separate entry: `portal.html` -> `src/app/portal-main.tsx`. Run and test it separately from the visitor artifact.
- `src/app/App.tsx`, `src/features/living-hall/`, and the final-exhibit styles are retained legacy/rollback code. Do not implement visitor upgrades there unless the active entry changes deliberately.

## Content and data

- Canonical and reviewed sources live under `data/`. `npm run prepare:data` generates runtime files under `public/data/`.
- Change canonical sources or generator logic instead of editing generated JSON alone.
- Never invent historical claims, relationships, dates, identity fields, portraits, or quotations. Do not change rights, caption, transcript, relationship, or publication approval states without an authorized editorial decision.
- Preserve the distinction between generated entity relationships, explicit curated relationships, and shared induction-class context.

## Build boundaries

- Use Node 22 as pinned by `.nvmrc`.
- `npm run build:public` writes a public-target artifact of the root app to `dist/` and must exclude film payloads not cleared for the public web. It is no longer what GitHub Pages publishes.
- `npm run build:kiosk` and the default `npm run build` create restricted local artifacts containing film payloads. Never publish them as a public site.
- `npm run build:portal` writes the separate staff artifact to `dist-portal/` and excludes film payloads.

### The rewrite's targets (`apps/exhibit`)

`apps/exhibit` has its own target switch and does not read `CIHOF_BUILD_TARGET`. Setting the wrong variable does nothing and raises no error, so check which one you mean.

- `CIHOF_TARGET=public npm run build --workspace @cihof/exhibit` carries no films and is the artifact GitHub Pages publishes as a preview.
- `CIHOF_TARGET=kiosk npm run build --workspace @cihof/exhibit` carries all 93 films. Never publish it.
- `CIHOF_TARGET` is required under CI. An unrecognised value is always an error; an absent value defaults to `kiosk` only outside CI, and says so.
- `npm run assert:public --workspace @cihof/exhibit` inspects the built artifact — not the sources — and fails if it carries films, a video file, an embedded player host, or a target other than `public`. It runs between build and deploy. A failure means do not publish; it does not mean loosen the check.
- `CIHOF_SITE_URL` points the share panel's QR codes at a public site. Leave it unset for previews and local builds: a code printed into a visitor's browser history cannot be corrected afterwards, so it may only ever name a durable public address.
- Do not push, publish, deploy, change permissions, or mark content approved without an explicit instruction for that operation.

## Verified workflow

Run visitor checks before portal checks and report existing failures separately from introduced failures:

```sh
npm ci
npm run typecheck
npm run validate:entities
npm run build:public
npm run test:kiosk
npm run validate:kiosk
npm run build:portal
npm run test:portal
```

`npm run validate:media-clearance` is expected to fail while archived films remain pending. At the MG-00 baseline, `npm run validate:offline` also fails against the public artifact because the public runtime bundle retains references to film files that the public build correctly excludes. Do not report either condition as a regression without checking the current policy and target artifact.

For visual evidence, start the built public preview and run the state-atlas capture:

```sh
npm run preview -- --host 127.0.0.1 --port 4176
npm run baseline:capture
```

Generated captures are local evidence under `artifacts/mg00-baseline/` and are ignored by Git.

## Upgrade execution

- Use `cihof-museum-upgrade/CIHOF_Codex_Upgrade_Plan.md` as the staged requirements source.
- Complete one MG task at a time, update `cihof-museum-upgrade/TASK_TRACKER.md`, and add a completion record before proceeding.
- Preserve unrelated working-tree changes. MG-00 began with pre-existing edits in the active exhibit, data cache, architecture notes, and visitor tests.
- Browser checks do not certify the physical installation. Keep reach, mounting, assistive-technology, endurance, curatorial, and rights checks explicit until authorized people perform them.
