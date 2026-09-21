# CE-00 — Refresh the baseline and adopt the extension deliberately

**Depends on:** None  
**Status:** Not started; this is a proposed implementation task.

## Goal

Establish what HEAD actually contains, reconcile the existing MG work, and define a safe boundary for the new city-experience implementation.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `AGENTS.md`
- `cihof-museum-upgrade/TASK_TRACKER.md`
- `src/app/main.tsx`
- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `package.json`
- `playwright.config.ts`
- `vite.config.ts`
- `.github/workflows/pages.yml`

## Work

Inspect `git status --short`, HEAD, the active entry and applicable instructions. Compare the audited commit with the working repository without resetting or discarding newer work. Reconcile the source readout with a new public build when the pinned environment can run; source reports are not identical to serialized public counts.

Read the current MG tracker and recent completion records. Retain completed MG-00–04 behavior; distinguish MG-05/06 review work from new features. Carry MG-07 and MG-08 into CE-10/11 without marking them started or complete merely because this extension exists.

Capture a state atlas of People, a selected person, full record, filtered People, Links index and selected connection, Years, empty/error cases, and reach/reduced-motion modes where available. Use the existing capture tooling where appropriate. Record blocked rendering instead of inventing screenshots.

Run a justified baseline using the pinned Node 22, lockfile, existing visitor checks and separate portal checks. Record the actual output and environmental blockers. Inspect the current `validate:offline` result; the root guidance's older failure may no longer match the deployed serialization. Do not clear pending media to make a check pass.

Write `cihof-city-experience/BASELINE_CURRENT.md` and `DECISIONS.md`. Adopt one persistent shell with four visitor lenses, retaining old links/years values and adding explicit Places/Activity compatibility rules. Record that this deliberately expands the current scene model while preserving the active entry. Record initial feature-flag strategy and the existing publication-status ambiguity. No product redesign in this stage.

## Acceptance

The current SHA, dirty-tree boundary, actual commands/results, inherited versus new evidence, 111-person baseline or documented source change, active entry and MG crosswalk are explicit. No code path is changed to legacy/rollback code. No content/rights status is promoted.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-00.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-00_baseline-and-adoption.md.

Establish the current baseline and adoption record only. Do not implement the later features. Inspect drift from the audited SHA, capture available evidence, document existing failures, and stop after CE-00 for review.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
