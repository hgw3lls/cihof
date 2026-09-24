# CE-09 — Review access, installed-display interaction and measured performance

**Depends on:** CE-03, CE-04, CE-05, CE-06, CE-07, CE-08  
**Status:** Not started; this is a proposed implementation task.

## Goal

Make the new capabilities usable through touch, keyboard and independent accessible paths while keeping the exhibit responsive.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/archive-exhibit.css`
- `src/features/archive-exhibit/archive-support.css`
- `src/components/Modal.tsx`
- `src/features/archive-exhibit/LinksScene.tsx`
- `playwright.config.ts`
- `docs/accessibility-installation-review.md`
- `tests/ (existing and new city-experience tests)`

## Work

Run the full access matrix for the new journeys while preserving MG-06 fixes. Evaluate tap-only and keyboard paths separately: a keyboard shortcut is not a substitute for a no-drag touch alternative. Ensure semantic DOM/list access, understandable reading order, visible focus, correct modal layering and focus restoration after regrouping/reset.

Test long names, long text, missing media, multiple affiliations, dense eligible connections, empty filters, text enlargement, reduced motion and color-independent relationship meaning. Make accessibility settings persistent only where appropriate for installation policy, not mixed into public identity state.

Measure target sizes and spacing against the project's larger kiosk spec. Treat body size, navigation placement and software reach mode as design choices to validate at actual OS/browser scaling. Do not equate CSS dimensions with physical accessibility or claim a lower-screen bar is an installation sign-off.

Profile initial load, common input responses, regrouping, gallery decode, network expansion and repeated resets on the selected device. Bound image loading and network layout; do not load the complete gallery or run force simulation continuously. Capture methodology before reporting frame/latency/memory numbers. Proposed budgets are targets to test, not existing results.

Run representative axe scans and manual keyboard checks; resolve serious issues. Independent screen-reader and physical touchscreen/seated/standing testing needs the actual supported setup. Keep those items open if unavailable. Include a non-phone path for independent nonvisual access; do not treat QR as the accessible alternative.

Produce a concise evidence atlas with screenshots and traces linked to SHA/data revision, plus an installation test sheet. Do not mark the existing physical/assistive-technology MG-06 sign-offs closed without the appropriate evidence and reviewer.

## Acceptance

A01–A08 and relevant endurance/performance checks have recorded results. No undefined “museum-grade” score substitutes for evidence. Software passes, hardware results and blocked manual checks are clearly separated; existing MG-06 behavior does not regress.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-09.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-09_access-and-performance.md.

Execute CE-09 only: access, reach-mode and performance review across the new journeys. Fix demonstrated issues, record actual measurements and evidence, and keep unavailable hardware or assistive-technology sign-offs explicitly open.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
