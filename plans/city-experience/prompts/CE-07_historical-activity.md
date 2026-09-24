# CE-07 — Add historical time without confusing it with induction

**Depends on:** CE-01, CE-02, CE-03, CE-04, CE-05, CE-06  
**Status:** Not started; this is a proposed implementation task.

## Goal

Let visitors explore when documented civic activity occurred while retaining the current complete induction chronology.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/YearsScene.tsx`
- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/data/types.ts`
- `src/features/archive-exhibit/HistoryScene.tsx (proposed)`
- `src/features/archive-exhibit/selectors/history.ts (proposed)`

## Work

Keep YearsScene's class chronology, unknown-class support, media gating, jump controls and scroll return. Present a clear Inductions / Activity choice within Time. Preserve old years URLs as induction views; an Activity link must encode its mode and date range explicitly.

Build Activity from reviewed event dates and association intervals in the new contracts. Render exact years, intervals and approximate dates with visible precision labels. Unknown dates remain in an explicit undated group/list with coverage count. Do not derive historical activity from classYear, a person's lifetime, unreviewed text parsing or an arbitrary modern date.

Intersect activity with selected communities, places and contribution facets through the shared controller. Keep the selected person identified when outside the displayed interval. Selecting an event opens its contribution/evidence; selecting a person can reveal their reviewed activity without losing the prior view.

Use a tap-to-select decade/range control plus previous/next or numeric alternatives; dragging the range is optional. When animation moves the time window, settle it and honor reduced motion. Avoid compressed unreadable labels or an endless horizontal surface requiring precise swipes.

Test interval boundaries, unknown endpoints, imprecise dates, events outside induction years, duplicate event associations and no published activity. Open-ended statements must preserve their source's temporal scope; do not infer someone is currently active or alive.

Add reviewed activity to the prototype only through authorized content decisions. A code-ready empty Activity lens should honestly explain missing published coverage rather than populate fictional dates. Keep it feature-flagged until the real collection supports a worthwhile experience.

## Acceptance

T05, T08 and T13 pass. Induction chronology has no regression; dated and undated activity is distinguishable; filter changes preserve context; every plotted date is supported at its stated precision.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-07.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-07_historical-activity.md.

Implement CE-07 only. Add Activity alongside Inductions using approved events/intervals, unknown-date handling and explicit URL/state semantics. Never relabel the existing class chronology as historical civic time.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
