# CIHOF Software Audit

Generated: 2026-09-14T18:39:06Z
Fix pass applied: 2026-09-14T18:56:25Z
Cleanup addendum applied: 2026-09-15

## 2026-09-15 Handoff Cleanup Addendum

This pass focused on the two active software surfaces: the staff review/portal and the public interactive app. The goal was to remove stale fragments without disturbing the larger launch/media work already in progress.

### Cleanup Applied

- Removed dead Explore-era data code: `src/data/filtering.ts`, `src/data/usePlaces.ts`, and the unused Explore/place type exports from `src/data/types.ts`.
- Rechecked the TypeScript import graph after deletion: `72` TS/TSX files total, `71` reachable from `src/app/main.tsx` or `src/app/portal-main.tsx`, with no unreferenced app modules outside `src/vite-env.d.ts`.
- Pruned orphaned global CSS from `src/styles/styles.css`, cutting it from `9,845` lines to `8,464` lines. Removed obsolete portrait-wall controls, story-lens focus UI, old explore filters/cards, old slide-out detail fragments, old review table rows, and unused grouped selector arms.
- Kept shared shell/detail/portal styles in place where selectors overlap active components. The stylesheet is still large, but the riskiest old fragments are no longer sitting in the active bundle.
- Split the former `src/features/living-hall/LivingHallPanels.tsx` monolith into focused panel modules under `src/features/living-hall/panels/`. The old file is now a 4-line compatibility barrel.
- Split `src/features/admin/AdminDataPanel.tsx` into an admin shell plus `AdminSettingsControls`, `AdminReviewQueue`, and `AdminDiagnosticsControls`. The admin shell dropped from `1,288` lines to `326` lines.
- Preserved runtime data payloads and generated public data. The old `usePlaces` hook was removed because no app entrypoint imports it; the runtime bundle may still carry place-like structured data for reporting/standards use.

### Verification

- `npm run typecheck` passed after the module splits.
- `npm run build:portal` passed after the final CSS and TypeScript refactors.
- `npm run build` passed for the public interactive app after the final CSS and TypeScript refactors.
- Generated `dist` and `dist-portal` folders from validation were removed after the build checks.

### Remaining Refactor Hotspots

- `src/styles/styles.css` is still the main bloat risk at `8,464` lines. Recommended next step is a staged split into shared shell/base CSS, portal CSS, and legacy-public quarantine CSS before deleting deeper grouped selector leftovers.
- `src/features/review-dashboard/ReviewDashboardView.tsx` is still `2,189` lines. It now delegates more model/service/component work, but state orchestration and tab rendering should be split into smaller hooks and panels next.
- `src/features/living-hall/panels/LivingHallFocusPanels.tsx` is the largest extracted public-app panel at `856` lines. The next pass should split focus inspector, trace focus, legacy focus, and person action content.
- `src/features/living-hall/livingHallModes.ts` is `1,391` lines. Move mode-specific builders into separate modules once tests cover the mode payload shape.
- `src/features/admin/AdminReviewQueue.tsx` is now the largest admin-only panel at `413` lines. It can be split into review model helpers if the queue grows further.
- `src/app/App.tsx` is `929` lines. URL state, kiosk idle/reset behavior, transition locking, and shell rendering can be extracted after the CSS split so behavior changes stay reviewable.

### Handoff Notes

- The working tree remains intentionally dirty from the broader launch/media/data pass. Do not treat this cleanup as a clean commit boundary without reviewing the existing generated-data and media-script changes.
- The current cleanup changes are intentionally conservative: no generated JSON/media payloads were deleted, and no user-authored dirty changes were reverted.

## Executive Summary

The CIHOF software is structurally healthy after the latest media work and the follow-up fix pass. Data generation, TypeScript, dependency audit, portal build, portal Playwright, kiosk wall validation, offline package validation, and the full kiosk Playwright suite all pass when the kiosk bundle is built with the test timing environment.

The project is not launch-ready yet because the strict launch gate is blocked by curator approval, explicit relationship records, and physical wall-position data. The largest software/process risk found in this audit, Vite copying the full local video tree into every build, has been fixed: portal builds now exclude local videos, and kiosk builds hardlink local videos instead of duplicating the payload.

## Fix Pass Summary

- Fixed build packaging in `vite.config.ts`: production builds disable Vite's default public copy, exclude `public/media/videos` from portal builds, and hardlink only manifest-listed video files/sidecars for kiosk builds.
- Fixed hidden admin default behavior: production bundles no longer fall back to `cihof-admin`; Playwright test builds inject that passcode explicitly.
- Fixed offline and launch-readiness remote media reporting: runtime-loadable remote refs are counted separately from provenance/source and non-kiosk streaming fallback URLs.
- Fixed generated text-readiness prose so it only lists active issue queues.

## Automated Audit Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm run prepare:data` | Pass | 111 inductees, 544 entities, 2041 generated entity relationships, 111 runtime media manifest records. |
| `npm run audit:data` | Pass | 0 duplicate IDs, 0 missing primary images, 0 generic image candidates. Reports 47 profiles without source videos. |
| `npm run validate:entities` | Pass | 544 entities and 2041 relationships; 0 errors, 0 warnings. |
| `npm run curate:report` | Pass | 111 curated records; 0 validation errors/warnings; 111 approved summaries; 64 caption/transcript reviews needed. |
| `npm run content:text-readiness` | Pass | 111/111 profiles pass as-is for current text triage; core profile copy has 0 minimal or needs-edit flags. |
| `npm run source:external-contributions` | Pass | 23/111 records retained, with 33 contribution candidates. |
| `npm run media:video-sync` | Pass | 633/633 acquisition records present; 0 downloads needed. |
| `npm run media:video-captions` | Pass | 93/93 manifest videos have captions and transcripts; 0 channel/non-video gaps. |
| `npm run media:video-transcribe` | Pass dry run | 0 remaining candidates; 0 missing local videos; 0 channel/non-video records. |
| `npm run media:validate` | Pass | Media schema valid; primary images wall/kiosk ready 111/111; videos kiosk-ready 0/93. |
| `npm run validate:kiosk` | Pass | Strict wall-profile media validation has 0 failures. |
| `npm run validate:media-clearance` | Expected fail | 93 strict failures because videos still need manual rights/caption/transcript approval. |
| `npm run launch:readiness:strict` | Expected fail | 7 passing, 3 blockers, 1 warning. Remote runtime references are now `0/0`; blockers are human review/data queues. Caption/transcript warning is `0/93`. |
| `npx tsc -b --pretty false` | Pass | TypeScript build passes. |
| `npm audit` | Pass | 0 vulnerabilities. |
| `npm run build:portal` | Pass | Built in seconds end-to-end; Vite copied 114.6 MiB and skipped the video tree. Current `dist-portal` is 140M. |
| Kiosk test build | Pass | `npm run build` passed in seconds; Vite hardlinked 372 manifest-listed video-sidecar files, skipped 2241 local acquisition/archive files, and copied 114.3 MiB of non-video public assets. |
| `npm run test:portal` | Pass | 2/2 passed against `dist-portal`. |
| `npm run test:kiosk` | Pass | 36/36 passed against the correctly timed kiosk test build. |
| `npm run validate:offline` | Pass | 111 profiles and 1484 local asset refs checked; 0 runtime remote media refs. 1203 provenance/streaming fallback refs remain for traceability. |
| `git diff --check` | Pass | No whitespace errors. |

## Current Counts

- Profiles: `111`.
- Primary images: `111/111` wall-ready and kiosk-ready.
- Videos in manifest: `93` across `64` profiles.
- Videos with specific YouTube IDs: `93/93`.
- Videos with local file, poster, caption, and transcript: `93/93`.
- Videos approved for kiosk: `0/93`.
- Channel-only video gaps: `0`. The Johnny K. Wu `https://www.youtube.com/mdifilm` channel link is retained only as a curator note/provenance reference, not playable media.
- Local video source payload: `40G`.
- Current build outputs: kiosk `dist` uses hardlinks for the `372` manifest-listed media files and is `10G` on disk in this workspace; portal `dist-portal` is `140M` and does not include `media/videos`.
- Local Whisper model: `465M` under `tools/whisper-models`.

## Findings

### P0: Launch Readiness Is Still Blocked By Review Data

`npm run launch:readiness:strict` is blocked by:

- `curated_records_approved`: `0/111`, target `111/111`.
- `explicit_traces_relationships`: `0`, target `30`.
- `physical_wall_positions`: `0/111`, target `111/111`.

This is not a code-health failure, but it is the actual launch gate.

### P1: Build Packaging Could Exhaust Disk Before Dedupe - Fixed

Before this fix pass, the Vite config used the default public directory copy into both `dist` and `dist-portal`. With `public/media/videos` now local, the portal build copied the same large video payload even though the portal JS/CSS bundle is small. Before dedupe, `dist-portal` reached `212G`; a subsequent kiosk build failed with `ENOSPC` while copying `public/media/videos`.

Evidence:

- `npm run build:portal` passed but took `13m 13s`.
- `dist-portal/media/videos` dry-run dedupe found `1928` duplicate files and `186.8 GiB` shareable bytes.
- `npm run media:video-dedupe -- --root=dist-portal/media/videos --execute` reduced `dist-portal` to `25G`.
- The failed kiosk rebuild hit `ENOSPC` during Vite `prepare-out-dir`.

Fix applied:

- Build-time `publicDir` is disabled for production builds.
- A selective public-copy plugin now copies ordinary public assets, hardlinks only kiosk media files listed in `data/media_manifest.json`, skips unreferenced local acquisition/archive files, and excludes videos from portal output.
- Portal build time dropped to seconds and the output is now `118M`.
- Kiosk Playwright no longer needs a pre-deduped build to stay under the `120_000ms` webServer timeout.

Relevant files:

- `vite.config.ts`
- `package.json`
- `playwright.config.ts`
- `playwright.portal.config.ts`
- `scripts/dedupe-video-hardlinks.js`

### P1: Video Media Is Localized But Not Kiosk-Approved

Video acquisition and local transcription are in good shape, but media clearance is intentionally not done. `validate:media-clearance` reports `93` strict failures because every video still needs rights/status approval before visitor-facing playback.

Resolved gap:

- The Johnny K. Wu channel-only record has been removed from playable media. The CIHOF profile page links `P34omi5XUiY` as the induction ceremony video and separately mentions `https://www.youtube.com/mdifilm` as Johnny K. Wu's YouTube channel. The channel URL remains only in curator notes.

Recommended cleanup:

- Manually review rights, captions, and transcripts.
- Set `rightsStatus`, `captionStatus`, `transcriptStatus`, and `approvedForKiosk` only after review.

### P2: Hidden Admin Passcode Is A Kiosk Convenience, Not Security - Guarded

The hidden admin panel stores changed passcodes in browser local storage. That is acceptable for a local kiosk convenience panel, but it should not be treated as an access-control boundary.

Fix applied:

- Production bundles no longer fall back to `cihof-admin`; a missing `VITE_CIHOF_ADMIN_PASSCODE` leaves the admin panel locked with an explicit configuration message.
- Local dev still supports `cihof-admin`.
- Playwright injects `VITE_CIHOF_ADMIN_PASSCODE=cihof-admin` for the admin regression test.
- Document that localStorage passcodes are recoverable/resettable by anyone with browser/devtools/filesystem access.
- Keep the staff portal runner bound to localhost with token required unless deliberately operating in a trusted maintenance environment.

Relevant file:

- `src/features/admin/AdminDataPanel.tsx`

### P2: Offline Validation Still Reported Remote References - Fixed

`validate:offline` now separates runtime media paths from provenance/source URLs and non-kiosk streaming fallback fields. The freshly built kiosk bundle has `0` runtime remote media refs and `1203` provenance/streaming fallback refs retained for traceability.

Fix applied:

- Offline validation warns only on runtime remote media URLs.
- Launch readiness uses the same classification, so `remote_media_references` now passes at `0/0`.
- Source/provenance URLs remain in data for curator traceability.

### P3: Text Readiness Report Had Stale Generic Recommendation Copy - Fixed

The generated text readiness report correctly says core profile copy is clean. Its prose now derives from current issue counts and no longer lists already-fixed issues such as duplicated scraped names, truncation, contact/address fragments, class-year display artifacts, or generic alt text.

Current generated follow-ups:

- `64` video caption/transcript approval queues.
- `110` missing pronunciation entries.
- `11` staff-only archive leads.
- `1` display-name life-date review.
- `1` story-section wording review.

## What Is Ready

- Visitor app builds and passes 36/36 kiosk Playwright tests with the intended test timing env.
- Staff portal builds and passes 2/2 Playwright tests.
- TypeScript is clean.
- Dependency audit is clean.
- Entity and generated relationship model validation is clean.
- Core profile text is clean under automated triage.
- Primary image wall/kiosk readiness is complete.
- Video files, posters, captions, and transcripts are complete for all playable/specific video records.

## What Remains

1. Approve 111 curated profile records.
2. Create or approve at least 30 explicit TRACES relationship records.
3. Add 111 physical wall positions.
4. Manually approve video rights/captions/transcripts before enabling any video for kiosk playback.
5. Keep the production admin passcode configured with `VITE_CIHOF_ADMIN_PASSCODE` before installation deployment.
