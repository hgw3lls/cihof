# EV-06 — Give the Links scene something true to show

**Depends on:** EV-05
**Cases:** T11, P01, P04, E-A4
**Threshold:** ≥ 15 approved `inducted_by` records, or the content team's number

## Goal

The constellation shows documented relationships alongside shared-induction
context, with each one's meaning, direction and source legible.

## Why here

First interpretive surface, because EV-05 hands it a bounded queue with a
finish line — 24 internal candidates and 87 external — and because the scene
already exists and currently tells every visitor "0 DOCUMENTED RELATIONSHIPS".
Nothing else in the plan converts review effort into visitor-visible change this
directly.

## File targets

- `src/features/archive-exhibit/LinksScene.tsx`
- `src/features/archive-exhibit/archiveModel.ts`
- `src/data/relationshipPublication.ts`
- `src/features/archive-exhibit/linkLayout.js`

## Work

Render approved relationships as documented edges, visually and textually
distinct from shared-induction-year context. Direction must not invert the
claim: "A was inducted by B" reads correctly from either endpoint.

Handle the external inductor case honestly. 87 of the queue's candidates name
someone who is not in the collection. They are real, sourced relationships to a
person with no record. Decide and record whether they appear at all, and if so
how a node that cannot be selected is presented. Do not manufacture a stub
person to make the graph look fuller.

Respect the CE-02 correction already in place: the constellation is built from
the whole collection, and a discovery query narrows the index beside it, never
the relationships a person actually has.

## Acceptance

T11 passes: direct, shared-context, curatorial-comparison and induction-context
have distinct wording and presentation. Every visible edge shows its source. The
threshold decision and its owner are recorded. Below threshold, this stage does
not ship.

## Completion

`completions/EV-06.md`; update the tracker. Stop for review.
