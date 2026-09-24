# CE-00 current baseline

**Recorded:** 2026-09-21 (refreshed; supersedes the first CE-00 pass)
**Branch:** `sota`
**Baseline commit:** `d97afd32b967a5b6e62ad6075b133979e8468b0a`
**Audited-package commit:** `d97afd32b967a5b6e62ad6075b133979e8468b0a`
**Runtime bundle:** schema version 2, content revision
`b81f21754dac02d1d10de0a78dcd7419d6975430d463254e88000ad7bafa4fd8`

This record was rewritten because the first CE-00 pass described a working tree
that contained CE-00 changes only. CE-01 has since landed and CE-02 is
partially implemented. Per this stage's own instruction, the audited SHA is a
baseline and not an instruction to reset newer work; nothing was discarded.

## Working-tree boundary

`HEAD` is unchanged at the audited commit. No CE work is committed. The dirty
tree divides cleanly by stage:

| Stage | Paths |
|---|---|
| CE-00 | `.gitignore`, `scripts/capture-mg00-baseline.mjs`, `cihof-city-experience/` (untracked) |
| CE-01 | `src/data/types.ts`, `src/data/publicationPolicy.ts` (untracked), `src/data/relationshipPublication.ts`, `src/data/runtimeDataBundle.ts`, `src/features/archive-exhibit/archiveModel.ts`, `src/features/archive-exhibit/interpretiveModel.ts`, `scripts/prepare-data.js`, `scripts/report-city-content-migration.mjs` (untracked), `vite.config.ts`, `tsconfig.json`, `package.json`, `data/cihof_places.json` (untracked), `public/data/places.json`, `public/data/city-content-review.json` (untracked), `public/data/cihof-runtime-data.json`, `tests/fixtures/city-experience-publication.ts` (untracked), `tests/publication-contract.spec.ts` (untracked) |
| CE-02, in progress and unrecorded | `src/features/archive-exhibit/state/` (untracked), `src/features/archive-exhibit/ArchiveExhibit.tsx`, `src/features/archive-exhibit/LinksScene.tsx`, `src/features/archive-exhibit/archive-exhibit.css`, `tests/exhibit-state.spec.ts` (untracked) |

CE-02 code is present without a completion record. The CE tracker row has been
moved from Not started to In progress to match the actual tree. CE-02 is not
complete and its acceptance has not been demonstrated; see the regressions
below.

A full copy of the uncommitted tree was archived outside the repository before
this stage ran, so no CE work depends on an uncommitted file surviving.

## Active product boundary

- Visitor: `index.html` -> `src/app/main.tsx` ->
  `src/features/archive-exhibit/ArchiveExhibit.tsx`.
- Staff: `portal.html` -> `src/app/portal-main.tsx`.
- `src/app/App.tsx`, `src/features/living-hall/`, and final-exhibit styles remain
  legacy/rollback surfaces and are not City Experience implementation targets.
- Public builds use `CIHOF_BUILD_TARGET=public` and exclude pending film files
  and payloads. Portal output remains separate in `dist-portal/`.

## Current collection readout

Generator output and the public artifact report:

- 111 eligible inductees; 544 entities; 2,041 generated entity relationships.
- 0 explicit relationship records.
- 3 curated story-section records and 6 story-lens records.
- 11 archive leads, 0 visitor-ready.
- 14 place review seeds; 53 unresolved legacy vocabulary labels.
- 111 primary images wall-ready and kiosk-ready.
- 93 video holdings pending; 0 kiosk-ready and 0 public-web-ready.
- 0 physical wall-position records.

The public artifact carries 111 people, 297 eligible entities, 856 eligible
generated relationships, and zero unapproved story, place, or archive records.
The source-to-artifact reduction was verified as rule-preserving: the CE-01
entity and relationship gates retain exactly the rows the previous rules
retained on current data.

## Baseline blockers

### 1. The visitor regression suite does not run

`npm run test:kiosk` exits 1 having collected **zero** tests:

```
ReferenceError: __CIHOF_BUILD_INFO__ is not defined
  at src/app/buildInfo.ts:16
```

`tests/exhibit-state.spec.ts` imports `state/exhibitState.ts`, which imports
`foldSearchText` from `interpretiveModel.ts`, which CE-01 gave a new
`buildInfo` import. `__CIHOF_BUILD_INFO__` is substituted only by the Vite
`define`, so the module throws under Playwright's Node transform and aborts
collection for the whole run. CE-01's record of 72/72 was accurate when
written; `tests/exhibit-state.spec.ts` did not exist yet. This is the
highest-priority item for CE-02.

### 2. The pinned Node 22 runtime cannot start

```
dyld: Library not loaded: /usr/local/opt/simdutf/lib/libsimdutf.34.dylib
  Referenced from: /usr/local/Cellar/node@22/22.22.3/bin/node
```

This is the release-environment blocker already carried on the MG tracker. All
CE-00 checks ran on Node 26.8.1 with npm 11.19.0. This is not a Node 22 pass.
During this stage a `simdutf` 9.2.0 rebuild was in flight in an interactive
shell, which additionally made Node 26 unavailable for part of the session;
Node 22 verification remains open until that runtime is confirmed working.

## Command evidence

| Command | Result |
|---|---|
| `npm ci` | Not run. Deliberately skipped: it removes `node_modules`, and a failure while a Homebrew build held the toolchain would have left no working environment. The installed tree already matches the lockfile and was not modified. |
| `npm run typecheck` | Pass. |
| `npm run validate:entities` | Pass; 544 entities, 2,041 relationships, 0 errors, 0 warnings. |
| `npm run build:public` | Pass. |
| `npm run test:kiosk` | **Fail, exit 1, 0 tests collected.** See blocker 1. |
| Visitor suite excluding `tests/exhibit-state.spec.ts` | **70 passed, 2 failed of 72** in 3.8 min. Diagnostic variant of the canonical command, recorded as such. |
| `npm run validate:kiosk` | Pass; 0 strict failures; primary images 111/111 wall-ready and kiosk-ready; videos 0/93. |
| `npm run build:portal` | Pass. |
| `CIHOF_PORTAL_PLAYWRIGHT_PORT=4191 npm run test:portal` | Pass, 2/2. |
| `npm run validate:offline` | Pass against public `dist/`; 111 profiles, 0 explicit relationships, 1,112 local asset references; 1,110 provenance/streaming remote references remain for source traceability and non-kiosk fallback. |
| `npm run validate:media-clearance` | Expected policy failure; 93 strict failures for pending videos, 0 schema errors. |
| `npm run baseline:capture` | Pass; 64 captures, 0 console or page errors. |

Running `validate:media-clearance` after `validate:kiosk` leaves the tracked
`public/data/media-report.json` holding the `full` strict profile rather than
the committed `wall` profile. Re-running `npm run validate:kiosk` restores it.
This is a property of the existing scripts, not a CE change.

## Failing visitor tests at this baseline

Both failures are introduced by the in-progress CE-02 work, not by CE-01 and
not by the audited commit.

1. `tests/index-experience.spec.ts:159` — *re-centers Links and carries
   selection between scenes.* `LinksScene` now receives the globally filtered
   people list, and its search box writes the shared global query. Searching a
   name in Links therefore empties that person's constellation: no
   `.map-node--class` shared-induction-year nodes are produced. Reproduced 2/2.
2. `tests/years-media.spec.ts:163` — *a network video failure offers retry and a
   usable return to the associated record.* The new state model collapses the
   previously independent `recordOpen`, `showQr` and `activeFilm` values into a
   single mutually-exclusive `detail` union. Opening a record over an active
   film now discards the film instead of layering over it, so closing the
   record cannot restore focus to `#filmRecordButton`. This breaks the MG-03
   film-to-record-and-back journey and the root `data-media` attribute. The
   correction requires a change to the state shape, not a wiring fix.

`tests/links-relationships.spec.ts:221` failed once in a partial run and then
passed 3/3 in isolation and in the 72-test run. It is an order-dependent flake
in existing `LinksScene` focus handling, not a CE regression.

## MG crosswalk

- MG-00 through MG-04 remain Complete and their behavior is retained, except
  that the MG-03 film-to-record return is currently broken by unfinished CE-02
  work and must be restored before CE-02 can close.
- MG-05 and MG-06 remain Ready for review. CE work does not close their
  curatorial, mobile, physical-reach, or assistive-technology sign-offs.
- MG-07 remains Not started. Applicable implementation and evidence belong to
  CE-10.
- MG-08 remains Not started. Applicable release gates and handoff belong to
  CE-11 and still require authorized external sign-off.

## Visual evidence

Local ignored evidence is in `artifacts/ce00-baseline/`: 16 states at 390x844,
768x1024, 1920x1080 and 3840x2160, with a manifest. States are neutral and
selected People, search and no-results, full record, Links neutral and
selected, Years neutral and selected, pending media, QR, dark theme, keyboard
focus, an invalid person link, reach mode, and reduced motion. The pending-media
entry records that pending film controls are absent from the public target as
required.

The capture tool was corrected in this stage to wait for in-flight animations to
settle before each screenshot, bounded by a timeout so indefinite animations
cannot hang it. Without this, capturing with motion enabled produced frames
mid-transition and the atlas was not reproducible.

Screenshots are rendered-state evidence only. They do not certify factual
accuracy, rights, physical reach, viewing distance, real touchscreen behavior,
screen-reader operation, endurance, or installation readiness.

## Open baseline constraints

- The visitor regression suite must be restored before any later stage can
  claim a passing baseline.
- Two CE-02 regressions are open, one of them structural.
- Node 22 must be repaired or provisioned before release certification.
- The 93 pending video holdings remain withheld.
- Identity and vocabulary semantics, and the meaning of the existing
  `approvalStatus: draft` values, require authorized reconciliation.
- Explicit civic relationships, reviewed place associations, and publishable
  story beats remain sparse or absent.
- External continuation reflow, physical installation access, independent
  assistive-technology journeys, and curatorial review remain open.
