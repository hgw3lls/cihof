# Release Handoff Checklist

Updated: September 15, 2026.

Use this checklist when the repo needs to move from active cleanup into a handoffable build. The goal is to keep release work narrow: verify the cleaned code/data path, identify true launch blockers, and avoid adding new visitor-facing scope.

## 1. Freeze Scope

- Treat `PORTRAITS`, `TRACES`, and `LEGACIES` as the public visitor scope.
- Keep profile curation in the staff portal, not the visitor admin panel.
- Do not enable video playback unless the specific media item has approved rights, poster, caption, transcript, runtime paths, and `approvedForKiosk: true`.
- Keep local acquisition media under `public/media/videos/`, but remember production kiosk builds package only files referenced by `data/media_manifest.json`.

## 2. Checkpoint The Repo

Before handing off, review and group changes into logical commits:

- source/data generation and validation changes
- review portal and visitor app refactors
- media tooling and build packaging
- generated runtime data
- handoff and audit documentation

Do not commit generated `dist/`, `dist-portal/`, Playwright output, local runner scratch files, Whisper models, or ignored video acquisition reports.

## 3. Required Validation

Run this clean pass before a handoff checkpoint:

```sh
npm run check:handoff
npm run validate:kiosk
npm run media:video-sync -- --no-download
npm run media:video-captions
npm run media:video-transcribe -- --limit=1 --model=data/media_manifest.json
npm run launch:readiness
git diff --check
```

Expected release-gate failures until curator/install work is done:

```sh
npm run validate:media-clearance
npm run launch:readiness:strict
```

Those should fail only on known human-review queues, not code, schema, build, or offline-packaging errors.

## 4. Optional Acceptance Tests

Run after `npm run check:handoff`, while `dist/` and `dist-portal/` exist:

```sh
npm run test:kiosk
npm run test:portal
```

Use the actual installation hardware, or the closest available touch display, before final acceptance. Confirm startup, offline loading, touch navigation, idle/reset behavior, font rendering, and any approved video playback.

## 5. Current Launch Blockers

These are not code-cleanup blockers; they are content, approval, and installation blockers:

- Approve all curated profile records in `data/cihof_curated_metadata.json`.
- Add at least 30 source-reviewed explicit TRACES relationships to `data/cihof_relationships.json`.
- Fill all 111 measured wall positions in `data/physical_wall_positions.json` for an installation launch.
- Review primary-image rights and kiosk approval states.
- Keep the 93 video items hidden until rights, captions, transcripts, posters, and approval statuses are complete.

## 6. Handoff Packet

The handoff packet should point reviewers to:

- `README.md` for app model, data flow, and common commands.
- `docs/current-architecture.md` for the current system shape.
- `docs/software-audit-2026-09-14.md` for the cleanup/audit record.
- `docs/video-offline-readiness-report.md` for local video/media status.
- `docs/launch-readiness-plan.md` for launch gates and ownership decisions.
- `docs/staff-portal-runner.md` for local portal runner operations.

After validation, remove generated `dist/` and `dist-portal/` unless the handoff explicitly needs local build artifacts.
