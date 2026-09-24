# CE-08 — Complete the walk-up invitation and public continuation

**Depends on:** CE-02, CE-03, CE-04, CE-05, CE-06, CE-07  
**Status:** Not started; this is a proposed implementation task.

## Goal

Make the new system approachable without prior name knowledge and preserve useful discoveries beyond the screen.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/useExhibitSessionTimeout.ts`
- `src/config/exhibitCopy.ts`
- `src/components/QRCodePanel.tsx`
- `src/features/inductee-detail/personDetailModel.ts`
- `src/features/archive-exhibit/AttractScene.tsx (proposed)`
- `src/features/archive-exhibit/CuratedTrail.tsx (proposed)`

## Work

Add a restrained attract/invitation state that demonstrates a real approved grouping or relationship. Use existing media/session control and shared state. First input stops choreography and begins exploration; it must not navigate away from the control the visitor touched. No autoplay audio, random drifting targets or active-session content changes.

Provide a few curator-authored entry questions or short trails from approved content. They are deterministic sequences with citations and explanatory links, not generated answers. Trails should be optional and escapable; baseline search and free browsing remain obvious. Avoid adding a chatbot or collecting visitor demographics.

Integrate all new states into warning, extension and reset. Keep production timing separate from accelerated test fixtures. Media playback progress and intentional reading interaction must follow the agreed activity policy. Closing a trail returns to the prior collection view, not the start screen.

Verify current canonicalContinuationUrl behavior and the inherited external mobile problem. Keep the existing destination where valid. A new same-site public companion must be explicitly adopted for ownership/content scope, use canonical person IDs, work on narrow phones and exclude kiosk-only media. Do not assume a phone can reach a local kiosk URL.

A simple person-record QR is the minimum. Sharing a comparison/trail is optional and must use stable approved IDs, not private notes or sensitive session data. On the physical kiosk, source evidence should remain usable without launching uncontrolled external tabs; links on the public/mobile version can use normal browser behavior.

Document unresolved external website or ownership decisions as blockers for that continuation path, not as reasons to withhold the entire text/portrait experience. Do not mark real-phone QR behavior passed without testing it.

## Acceptance

T16–T18 plus session/reset tests pass where testable. A first-time visitor has a clear entry without knowing a name; active reading stays stable; every trail is approved; QR leads to the correct authorized public record or is honestly unavailable.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-08.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-08_walk-up-trails-and-continuation.md.

Implement CE-08 only: walk-up invitation, optional curated trails, session integration and validated continuation. Keep free browsing primary, do not add live generative narration, and separate external/mobile blockers from completed local behavior.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
