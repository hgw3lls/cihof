# CE-06 — Explain relationships and place two lives in dialogue

**Depends on:** CE-01, CE-02, CE-03, CE-04, CE-05  
**Status:** Not started; this is a proposed implementation task.

## Goal

Extend existing connection mechanics into evidence-backed mixed-entity exploration and noncompetitive comparison.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/LinksScene.tsx`
- `src/features/archive-exhibit/archiveModel.ts`
- `src/features/archive-exhibit/linkLayout.js`
- `src/data/relationshipPublication.ts`
- `src/features/archive-exhibit/ComparePanel.tsx (proposed)`
- `src/features/archive-exhibit/selectors/comparison.ts (proposed)`

## Work

Preserve the existing source explanation, forward/reverse handling, connection-list alternative, preview and recenter behavior. Adapt the view to mixed eligible person/place/organization/event targets. Do not treat every target as an Inductee with a portrait; each entity type needs an appropriate label and accessible control.

Distinguish direct relationships, shared documented context, approved curatorial comparison and induction context in selectors, copy and visual legend. Existing same-class fallback remains labeled and optional. A shared organization or overlapping period alone cannot prove collaboration or acquaintance.

Keep initial graph neighborhoods bounded. Use a documented order and disclose further results through the list or expansion. Avoid ranking by prestige, popularity or ethnicity. Measure existing collision/context-position logic before extending it; prefer stable authored/deterministic layouts to an always-moving network.

Add up to two-person comparison to the shared detail system. “Add to comparison,” remove and replace are ordinary buttons; drag is optional. Show shared places/themes/periods or a direct relationship with separate source support for each side. No direct relationship documented is a valid state. Never manufacture a commonality to fill the center.

Handle more than one relationship between a pair, direction changes, filtered-out selections, identical-person attempts and sparse data. A comparison may share a topic without turning that topic into a direct interpersonal edge. Keep all evidence reachable through the existing panel.

Add tests for misleading relationship types, reversed mentorship/induction claims, multiple records per pair, empty explicit relationships and the current pure shared-class case. No inferred candidate edges may reenter the public graph.

## Acceptance

T11–T12 and P03–P04 pass. Every visible connection has accurate semantics and evidence/context explanation. Both graph and list support the same claims; comparison needs neither drag nor invented facts and introduces no score, winner or community ranking.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-06.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-06_connections-and-comparison.md.

Implement CE-06 only: mixed-entity connection semantics and two-person comparison. Preserve current good link behaviors. Do not replace an empty evidence graph with automatic biography similarity or inferred civic ties.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
