# CIHOF One-Month Launch Readiness Plan

Updated: September 13, 2026.

Target launch-ready date: October 12, 2026.

This plan locks the Week 1 scope for getting the CIHOF persistent Hall ready for installation review. The app is structurally healthy; the remaining work is approval, media readiness, physical mapping, and operational proof.

## Launch Scope

Launch with the existing persistent Hall visitor model:

- Public lenses: `PORTRAITS`, `TRACES`, and `LEGACIES`.
- Focused person actions: `LIFE + WORK`, `WATCH INDUCTION` when approved media exists, and `TAKE IT WITH YOU`.
- Hidden visitor admin for kiosk operations, data import/export, settings, access settings, and diagnostics.
- Separate staff portal for curation review, source-derived draft review, relationship review, media review, and runner-backed maintenance.
- All 111 inductees visible with approved public text and kiosk-approved primary portraits.

## Out Of Scope

Do not add new public visitor feature areas before launch unless a launch blocker requires it.

- No fourth public lens beyond `PORTRAITS`, `TRACES`, and `LEGACIES`.
- No new public destination-page model for profiles, maps, timelines, journeys, or search.
- No unapproved remote video/audio playback in kiosk mode.
- No profile curation inside the public visitor app.
- No new visual-art-direction pass until approval and installation gates are moving.

## Approval Rules

Profile records are launch-ready only when these fields are populated and the overall record status is approved:

- `approvedSummary`
- `documentedContextLine`
- `honoredForSummary`
- `lifeWorkSummary`
- `approvalStatus`

Primary portraits are launch-ready only when the media manifest has a local file, runtime path, approved rights status, and `approvedForKiosk: true`.

Videos are optional for launch. A video may appear behind `WATCH INDUCTION` only when it has approved rights, local file, poster, captions, transcript, runtime paths, and `approvedForKiosk: true`. Videos that do not meet that bar stay hidden.

TRACES may continue to use generated candidate relationships, but launch should include a small explicit source-reviewed relationship set. The current target is at least 30 curated relationship records, enough to make TRACES feel intentional without attempting exhaustive relationship curation.

Physical installation launch requires all 111 inductees mapped to measured wall positions. A web-only demo can waive this, but an installed Hall should not.

## Launch Gates

Run:

```sh
npm run launch:readiness
```

Use the strict version once the month-end gates are expected to pass:

```sh
npm run launch:readiness:strict
```

Current Week 1 gates:

- Public text populated for all 111 inductees.
- Curated records approved for all 111 inductees.
- Curated metadata validates with zero errors.
- Primary images render locally for all 111 inductees.
- Primary images are kiosk-approved for all 111 inductees.
- Approved videos are fully kiosk-ready; non-approved videos are hidden.
- At least 30 explicit TRACES relationships exist.
- Physical wall positions exist for all 111 inductees.
- Remote media references are reviewed for offline operation.

## Week 1 Operating Checklist

Complete these by September 18, 2026:

- Treat the public visitor scope as frozen unless a launch blocker requires a change.
- Use `npm run launch:readiness` as the daily status check.
- Keep `npm run launch:readiness:strict` as the final launch gate, expected to fail until blocker queues are cleared.
- Assign a curator/approver for profile text and primary image rights.
- Assign an installation owner for physical wall measurements.
- Assign a relationship-review owner for the first 30 source-reviewed TRACES relationships.
- Decide whether launch is installation-first or web-demo-first. Installation-first keeps the physical wall gate mandatory; web-demo-first can waive it temporarily.
- Decide whether any videos must launch on day one. The default is no: `WATCH INDUCTION` appears only for fully kiosk-ready videos.

## Current Blocker Queues

The local readiness report writes detailed queues to `artifacts/launch-readiness.local.json`.

As of September 13, 2026:

- Profile approval queue: 111 records in `data/cihof_curated_metadata.json`.
- Primary image approval queue: 111 records in `data/media_manifest.json`.
- Explicit TRACES relationship queue: 30 records needed in `data/cihof_relationships.json`.
- Physical wall queue: 111 positions needed in `data/physical_wall_positions.json`.
- Hidden video backlog: 94 video items stay hidden until rights, local files, posters, captions, and transcripts are complete.

Source-derived relationship candidates already exist:

- `data/original-site-harvest/review-queues/relationship-candidates.csv`: 546 candidate rows.
- `data/original-site-harvest/review-queues/induction-relationship-candidates.csv`: 65 candidate rows.
- `data/original-site-harvest/review-queues/organization-candidates.csv`: 747 candidate rows.
- `data/original-site-harvest/review-queues/place-candidates.csv`: 291 candidate rows.

## Decision Register

Locked:

- Launch uses the persistent Hall model, not destination pages.
- Public navigation remains `PORTRAITS`, `TRACES`, and `LEGACIES`.
- Profile curation stays in the staff portal, not hidden visitor admin.
- Videos are launch-optional and hidden unless fully kiosk-ready.
- Generated relationships may support discovery, but launch needs at least 30 explicit reviewed relationships.

Needs confirmation by September 18, 2026:

- Whether October 12 is an installation-ready date or a web-demo-ready date.
- Who can approve profile text and primary image rights.
- Whether `approved` is the final value for `approvalStatus`, `rightsStatus`, `captionStatus`, and `transcriptStatus`.
- Whether all 111 physical wall positions are available this month.
- Whether any specific videos are must-have launch media.

## Daily Status Routine

Use this routine during Week 1:

```sh
npm run launch:readiness
npm run validate:entities
npm run media:validate -- --strict --profile=wall
```

Run the full suite before a Week 1 handoff or after any app/data-shape change:

```sh
npm run build:public
npm run build:portal
npm run test:kiosk
npm run test:portal
```

## Month Plan

Week 1, September 12-18: lock scope, approval rules, launch gates, and the launch readiness report. Start no new visitor feature work unless it removes a blocker.

Week 2, September 19-25: move profile records from draft to approved, prioritize any fields that still need curator review, and promote the first explicit relationship set into canonical data.

Week 3, September 26-October 2: approve and localize primary portraits, keep non-ready videos hidden, complete any selected video rights/poster/caption/transcript work, and reduce or explicitly accept remote references for offline operation.

Week 4, October 3-12: map physical wall positions, run hardware/touch/offline/burn-in checks, finalize operator docs, and use `npm run launch:readiness:strict` as the final gate.
