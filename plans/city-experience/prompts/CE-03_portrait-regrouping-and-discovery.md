# CE-03 — Create the signature collection-regrouping interaction

**Depends on:** CE-02  
**Status:** Not started; this is a proposed implementation task.

## Goal

Let the collection visibly reorganize around communities and contributions without losing identity, readability or touch access.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/archive-exhibit.css`
- `src/features/archive-exhibit/interpretiveModel.ts`
- `src/features/archive-exhibit/CollectionStage.tsx (proposed)`
- `src/features/archive-exhibit/PeopleScene.tsx (proposed)`
- `src/features/archive-exhibit/DiscoveryBar.tsx (proposed)`
- `src/features/archive-exhibit/layouts/portraitLayouts.ts (proposed)`

## Work

Extract the People view into the existing shell's CollectionStage. Implement All people, By community and By contribution arrangements using the shared selectors. Keep a semantic list and stable person identifiers. Make the grouping labels explain what is being shown; do not rely on colors or flags to signify ethnicity.

Build deterministic layouts and a bounded transition between them. Start with DOM/CSS/SVG and stable keys; use FLIP or another measured approach only if justified. Do not require WebGL or a continuously running force simulation. An optional decorative transition layer must be hidden from assistive technology and never duplicate active controls.

Preserve the selected person's visual anchor and logical focus. Handle multi-affiliation membership explicitly, without duplicating the unique-person total or forcing a single ethnic identity. Unknown/uncategorized records remain discoverable. Apply existing image fallback and focal-point rules.

Make the screen feel like an image-led exhibit rather than an administrative filter form: strong grouping typography, an understandable spatial change, restrained chrome and a concise invitation. Do not introduce generic dashboard cards, gradients or effects unrelated to the collection. Test the existing aesthetic before replacing its typographic character.

Interaction must settle after input. On first touch, stop any idle choreography. Reduced motion yields the same content without spatial travel. Pointer cancellation does not select accidentally; no visitor must hover or drag. Keep major controls reachable through a stable navigation strip and include a searchable list alternative.

Capture regrouping before/after, selected state, multiple affiliations, empty filters, long names, missing images and reduced motion at the specified viewports. Profile the intended transition rather than claiming smoothness from code alone.

## Acceptance

T01–T05 and A01–A07 are covered. Visitors can explain what the new grouping means; selected identity remains traceable; totals are unique people; logical reading order remains usable. No active target drifts after the transition, and the first frame does not require every gallery image.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-03.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-03_portrait-regrouping-and-discovery.md.

Implement CE-03 only. Make meaningful portrait regrouping the signature interaction inside the existing exhibit, with deterministic layouts, readable group labels, multiple-affiliation handling, stable focus, reduced motion and a full list alternative.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
