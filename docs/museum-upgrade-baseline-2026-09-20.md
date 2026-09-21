# CIHOF museum upgrade baseline

**Task:** MG-00  
**Captured:** September 20, 2026  
**Status:** Complete; MG-01 is the next bounded implementation stage.

## Evidence boundary

This is a local source, build, browser-test, and screenshot baseline. It does not claim that the public URL, installed gallery hardware, physical reach, assistive-technology journeys, visitor research, media rights, or curatorial approvals were verified. No canonical content, approval state, production permission, deployment, push, or publication was changed.

The baseline was taken from `main` at `f47d1d7ff9080072a7f3a28508a73e83907f61a5`, which is also `origin/main` and the audit reference commit. The working tree was already modified before MG-00 in:

- `docs/current-architecture.md`
- `src/data/localDataCache.ts`
- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/LinksScene.tsx`
- `src/features/archive-exhibit/YearsScene.tsx`
- `src/features/archive-exhibit/archive-exhibit.css`
- `tests/index-experience.spec.ts`

Those pre-existing edits are included in this runtime baseline and were not reverted. They add People sorting, revised Links labeling, selected-person context in Years, presentation refinements, and an oversized local-cache guard.

## Runtime identity

| Item | Observed value |
|---|---|
| Repository commit | `f47d1d7ff9080072a7f3a28508a73e83907f61a5` |
| Branch | `main`, tracking `origin/main` |
| Pinned runtime | Node 22 in `.nvmrc` |
| Actual runtime | Node `v26.8.1`, npm `11.19.0` |
| Host | macOS/Darwin 25.6.0, x86_64 |
| Browser evidence | Chromium `151.0.7922.34`, DPR 1 |
| Visitor entry | `index.html` -> `src/app/main.tsx` -> `ArchiveExhibit` |
| Portal entry | `portal.html` -> `src/app/portal-main.tsx` |

The Node 22 mismatch is a reproducibility warning. All recorded build and test results below passed or failed under Node 26.8.1.

## Product and publication boundaries

| Artifact | Command/output | Observed boundary |
|---|---|---|
| Public visitor | `npm run build:public` -> `dist/` | Pages target; zero film files copied; pending media still referenced in runtime metadata |
| Restricted kiosk/default | `npm run build:kiosk` or `npm run build` -> `dist/` | May include manifest-listed local films regardless of pending review; never a public artifact |
| Staff portal | `npm run build:portal` -> `dist-portal/` | Separate HTML/JS entry; film payloads excluded |

The public build was 140 MiB and 1,272 files. The portal build was 141 MiB and 1,274 files. Local `public/media/videos/` contains 2,611 files totaling about 40 GiB; none appeared under `dist/media/videos/`. The GitHub Pages workflow runs `npm ci` and `npm run build:public`, then uploads `dist`; it currently does not run browser tests before deployment.

`installationConfig` contains flags for participatory behavior, QR, sound, kiosk guards, caching, and staff review. In the active visitor path, the shared local data cache is consumed, while most other feature-flag consumers are in the inactive `App.tsx` or portal. `ArchiveExhibit` renders QR and idle behavior directly, so changing those flags alone does not necessarily change the active visitor.

## Current collection

| Measure | Observed value |
|---|---:|
| Inductees | 111 |
| Primary image paths | 111 |
| People with video references | 64 |
| Archived film records | 93 |
| Films fully approved for playback | 0 |
| Generated entities | 544 |
| Generated entity relationships | 2,041 |
| Explicit curated relationship records | 0 |
| Curated story-section records | 3 |
| Story lenses | 6 |
| Archive leads | 11, with 0 visitor-ready |
| Physical wall positions | 0 |

## Checks run

| Command | Result |
|---|---|
| `npm ci` | Pass; 67 packages installed. npm reported two unapproved optional `fsevents` install scripts. |
| `npm run typecheck` | Pass. |
| `npm run validate:entities` | Pass; 544 entities and 2,041 relationships, zero errors or warnings. |
| `npm run build:public` | Pass; 101 modules transformed, 1,265 public assets copied, 2,613 skipped. |
| `npm run test:kiosk` | Pass after allowing the local preview port; 14/14 tests. Initial sandbox-only attempt could not bind port 4174. |
| `npm run validate:kiosk` | Pass; 111/111 primary images wall/kiosk-ready and 0/93 videos kiosk-ready. |
| `npm run validate:media-clearance` | Expected policy failure; 93/93 archived films remain not kiosk-ready. |
| `npm run validate:offline` | Fail against `dist/`; 372 missing film references, exactly MP4/poster/caption/transcript for 93 films intentionally excluded from the public artifact. |
| `npm run launch:readiness` | Non-strict report completed: 7 pass, 3 blockers, 1 warning. |
| `npm run build:portal` | Pass; 87 modules transformed. |
| `npm run test:portal` | Pass; 2/2 portal tests. |
| `npm run baseline:capture` | Pass; 52 images, zero console or page errors. |

Launch-readiness blockers are 0/111 curated record approvals, 0/30 explicit trace relationships, and 0/111 physical wall positions. Caption/transcript review remains 0/93. These are external content or installation dependencies, not implementation passes.

## Visual evidence

The local evidence directory is `artifacts/mg00-baseline/`. `manifest.json` records browser, platform, URL, viewport, DPR, and per-page errors. The capture contains 13 states at each of 390x844, 768x1024, 1920x1080, and 3840x2160:

- People neutral, selected, searched, and no-results
- Full record
- Links neutral and selected
- Years neutral and selected
- Pending media
- QR dialog
- Light/dark coverage
- Keyboard focus

The atlas totals 52 JPEGs and 9.4 MiB. Spot checks confirmed nonblank, correctly sized output at all four viewport classes. These screenshots are evidence of rendering only; the Playwright suites provide the action checks.

## Findings classified

### Reproduced behavior

- The active collection is built with `inductees.filter(person => person.primaryImageUrl)`. All 111 current records have a primary path, so nobody disappears today, but image availability is still the eligibility rule.
- Selecting a searched person removes the selected tile. The current test explicitly expects zero remaining tiles for a one-result search, confirming the unstable-context contract that MG-01 must replace.
- Years exposes 93 film cards for 64 people. The remaining eligible people are represented only in class counts unless already selected, confirming that film availability drives individual chronology entries.
- Pending film playback is correctly withheld: the visitor sees an archive notice and no `<video>` or caption track.
- Links now distinguishes documented-link styling from induction-class context, but connected nodes still expose only generic `ARCHIVE REFERENCE` text visually. The relationship helper deduplicates by person and does not preserve direction, multiple relation meanings, review status, or sources.
- The public rights filter excludes all pending film files. The public runtime bundle nevertheless retains their local paths, producing 372 deterministic `validate:offline` failures.

### Source-backed risks not claimed as completed runtime failures

- `reset()` clears selection, history, record, media, and scene, but not People query/sort, Links query, or persisted Years position. The configured warning duration is not presented, and active playback is not coordinated with idle reset.
- The QR wrapper declares a modal and focuses its close button, but does not contain focus, make the background inert, or restore focus explicitly.
- Biography rendering groups sentences heuristically and prefixes the person's name when a generated paragraph starts lowercase.
- The service worker opportunistically caches requests but does not provision the complete core. It has no network timeout or coordinated release identity; HTTP 206 handling remains a source-supported risk.
- The public deploy workflow builds and deploys without running visitor, accessibility, offline, or artifact-policy tests.

### Unverified or externally blocked

- Live public-origin behavior and production performance
- Physical mounting, reach, approach, seated use, OS scaling, and input placement
- Screen-reader/manual assistive-technology journeys
- Film rights, captions, transcripts, explicit relationships, interpretive copy, and wall-position approval
- Offline restart, range playback, interrupted update, rollback, revocation, and endurance on the installed system

## Staged execution from this baseline

| Stage | Next implementation outcome | Baseline-specific gate |
|---|---|---|
| MG-01 | Canonical person eligibility, real image fallback, stable tile/scroll/focus return | Preserve the pre-existing People sort work; add no-image and broken-image fixtures without changing approvals |
| MG-02 | One authoritative reset and mode-aware accessible timing | Cover queries, sort, scene positions, URL, QR, and playback; do not clear staff settings |
| MG-03 | Person-first induction chronology and resilient approved media | Keep all 93 pending films restricted; use a synthetic/licensed playable test fixture |
| MG-04 | Directional, sourced, review-aware relationship explanations and equivalent list | Trace generated versus curated eligibility before publishing any relationship |
| MG-05 | Approved interpretive hierarchy, honest source layers, refined active CSS | Remove runtime prose repair without silently rewriting approved biographies |
| MG-06 | Modal/focus/reflow/keyboard/QR completion plus documented physical checks | Browser success cannot close hardware or assistive-technology blockers |
| MG-07 | Coherent public and local offline packages with staged updates and rollback | Resolve the current public-runtime/offline-validator target mismatch explicitly |
| MG-08 | Exact-artifact CI gates, operator runbook, endurance and sign-off evidence | Deployment must consume the tested artifact and remain explicitly authorized |

## Next bounded task

Execute MG-01 only. Begin by defining publication eligibility independently of `primaryImageUrl`, then preserve the selected tile, query, scroll position, and focus through record open/close. Add isolated fixtures for missing and broken portraits and verify that People, Links, Years, and deep links resolve the same eligible IDs. Do not modify canonical approval states or proceed into reset/timing work.
