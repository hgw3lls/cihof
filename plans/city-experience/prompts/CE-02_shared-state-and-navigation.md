# CE-02 — Unify selection, filters, history and session state

**Depends on:** CE-01  
**Status:** Not started; this is a proposed implementation task.

## Goal

Make every lens answer the same visitor question while preserving context, deep links and reset behavior.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/archiveModel.ts`
- `src/features/archive-exhibit/useExhibitSessionTimeout.ts`
- `src/app/mediaControl.ts`
- `src/features/archive-exhibit/state/exhibitState.ts (proposed)`
- `src/features/archive-exhibit/state/useExhibitController.ts (proposed)`

## Work

Extract a typed reducer/controller from the existing parent state. Preserve tested selection, focus, film, QR and reset behavior rather than rewriting it from memory. Add lens/grouping, global facets, explicit time mode, comparison IDs, place focus, detail state and bounded history snapshots. Keep viewport/focus restoration local rather than serializing DOM references.

Define filter semantics: union within a dimension, intersection across dimensions, clear visible chips and predictable counts. A selected person outside a filter stays identified in focus with a clear explanation; choosing a grouping does not silently clear that person. Show mapped/dated coverage separately from total filtered people.

Implement compatibility for existing aliases. An old `scene=years` opens induction chronology. New historical activity needs an explicit time mode; new Places URLs resolve to Places intentionally. Keep canonical person URLs and invalid-ID recovery. Use a URL schema version for new structured states and validate input.

Back restores the previous meaningful view/detail/filter/selection/scroll state. Closing evidence or a record restores its initiating control. Start over calls one authoritative reset that clears new comparison/time/place state alongside existing queries/media/history, retaining installation settings. Limit history length and prevent stale element references from leaking.

Use the current main entry and temporarily feature-flag newly added lenses. Do not build a second standalone application while the new controller is being tested. Add narrow transition tests before extracting further UI.

## Acceptance

Tests T04–T08 and focus/reset regressions pass in the available environment. Links/Years no longer silently ignore global discovery criteria. Legacy routes still work, unknown IDs recover, media stops on reset, and hidden components cannot retain a second session.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-02.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-02_shared-state-and-navigation.md.

Implement CE-02 only: one state controller, filter semantics, navigation/URL compatibility, focus/viewport return and authoritative reset integration. Preserve current visuals where possible so this stage isolates behavioral changes.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
