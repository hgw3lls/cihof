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
- `npm run build:public` writes the GitHub Pages artifact to `dist/` and must exclude uncleared film payloads.
- `npm run build:kiosk` and the default `npm run build` create restricted local artifacts that may contain pending media. Never publish them as the public site.
- `npm run build:portal` writes the separate staff artifact to `dist-portal/` and excludes film payloads.
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
