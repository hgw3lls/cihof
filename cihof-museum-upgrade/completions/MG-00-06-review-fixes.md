# MG-00 through MG-06 review fixes

Date: 2026-09-20. Scope: the three reproduced review findings only.
Existing mixed worktree and canonical content are preserved; no deployment or
content/rights approvals. MG-07 and MG-08 remain not started.

## Fixes

- Years playback recognizes progressing timestamps after replay/backward seek,
  instead of waiting to exceed the previous furthest timestamp. Repeated stalled
  timestamps still allow the kiosk to time out.
- Years stores the selected-person ID with its horizontal position. Record return
  restores that position; changing the selected person still follows their year.
- Links keeps the explored connection in the owning session component so record
  unmount/remount does not erase it. Selection changes and Start over clear it;
  unavailable connections are still discarded.

## Verification

`CIHOF_PLAYWRIGHT_PORT=4176 npm run test:kiosk`: 61/61 passed against a rebuilt
public artifact, including TypeScript compilation. Four added regression tests
cover replay, backward seek, repeated Years return, and repeated Links return.
They also cover stalled playback, trigger focus, and fresh-state reset.
The existing real fixture decoding, accessibility, content preservation, media
publication, and cross-scene navigation checks passed.

Final `npm run build:public` passed without test-only settings, refreshing the
existing local preview artifact. `git diff --check` passed.

Checks used Node 26.8.1; the previously documented Node 22 issue remains open.
No portal-specific code was changed and the portal suite was not rerun for these
fixes. Physical installation, external QR reflow, curatorial and assistive-
technology sign-offs remain open in the tracker.
