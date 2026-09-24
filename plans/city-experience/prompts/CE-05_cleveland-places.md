# CE-05 — Make Cleveland places a real entry into the collection

**Depends on:** CE-01, CE-02, CE-03, CE-04  
**Status:** Not started; this is a proposed implementation task.

## Goal

Connect city/neighborhood/place exploration to people and their specific documented activities.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/archiveModel.ts`
- `src/data/types.ts`
- `scripts/prepare-data.js`
- `src/features/archive-exhibit/PlacesScene.tsx (proposed)`
- `src/features/archive-exhibit/selectors/places.ts (proposed)`

## Work

Implement the Places lens in the same shell/controller. Reuse the canonical place starter set through the additive entity adapter, preserving IDs and original provenance. Add only reviewed geometry and associations to visitor output. A list-first view must work even when no geographic geometry has been cleared.

Define city/neighborhood/place levels. At each level show only a legible amount of detail and offer a complete list. Selecting a place reveals associated people and the role of the association; selecting “Their Cleveland” from a person highlights their eligible places. Changes respect global filters and selected-person continuity.

Do not treat current schematic marker x/y as longitude/latitude. An illustrative/schematic map must identify that status; a geographic map requires validated geometry and licensed/source-attributed data. Historic place names, dates and neighborhood boundaries must not silently become current assertions. Greater Cleveland places may sit outside city limits when supported.

Separate residence, work, study, organizing, service and general association. Each link opens its evidence. A person with no reviewed place remains accessible in unmapped results, not removed from the collection. Count mapped people separately from all matches.

Use local map assets, no live tile/API dependency for essential browsing. Provide place search/list, zoom and directional controls, reset view and no-drag alternatives. Touch target clustering/disclosure should avoid tiny pins. Photograph/portrait reveals must come from eligible assets.

Demonstrate a complete journey through reviewed prototype content or explicitly test-only fixtures. Keep missing real content in the editorial queue; do not fabricate a finished city map to make the screenshot impressive.

## Acceptance

T05, T06, T09 and P01–P04 pass. Place → person and person → places are reversible and evidence-backed. Geometry type is honest, list equivalence holds, unmapped people remain discoverable, and essential map use does not require network tiles.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-05.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-05_cleveland-places.md.

Implement CE-05 only: a semantic, local-data Places lens with city/place disclosure and sourced association roles. Reuse the 14 starters as reviewed inputs, not automatic truth. Preserve one shell, shared filters and complete baseline inclusion.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
