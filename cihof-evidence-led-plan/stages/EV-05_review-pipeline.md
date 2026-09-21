# EV-05 — Build the road from legacy fields to reviewed records

**Depends on:** EV-02, EV-04
**Cases:** P02, P04, P06, E-A4, E-A5

## Goal

A reviewer can turn material already in the published record into typed,
sourced, reviewed records — one decision at a time, with the source visible and
the decision recorded.

## Why here

This is the critical path. Everything interpretive after this stage is gated on
its throughput.

CE-01 built the destination contracts and they correctly refuse everything
unreviewed. Nothing built the road, so the exhibit publishes 0 relationships, 0
stories, 0 places and 0 archive leads while `inductedBy` is populated for 111 of
111 people and 444 story-highlight sentences sit in the record. See
[AUDIT.md](../AUDIT.md) §1.3.

## The queues, and their measured sizes

| Queue | Size | Source field |
|---|---|---|
| `inducted_by`, both people in the collection | **24** | `inductedBy` string-matching an inductee name |
| `inducted_by`, inductor outside the collection | **87** | `inductedBy` |
| Story beat candidates | **444 sentences across 111 people** | `storyHighlights` |
| Place associations | **14 seeds** | `data/cihof_places.json`, already staff-only |
| Vocabulary resolution | **53 labels** | `communityTags` / `countryTags`, `unresolved-legacy` |
| Archive leads | **11**, 0 visitor-ready | `cihof_archive_items.json` |

These are queue sizes, **not** pending relationships. Decision E02 and CE D07
govern: a string match produces a queue item requiring an explicit decision, and
never a link. Build a deliberate homonym fixture and prove it.

## File targets

- `src/features/review-dashboard/` — the portal already has a review dashboard; the queues belong there
- `src/features/review-dashboard/models/portalReviewModel.ts`, `portalRelationshipModel.ts`
- `scripts/prepare-data.js` — queue generation
- `data/curation-decisions/` — where decisions land
- `src/data/publicationPolicy.ts` — unchanged; it is the destination

## Work

Generate the queues from canonical sources during `prepare:data`, as review
input only, with the originating field, the person, and the exact source wording
carried through.

Give the portal a per-queue working view: the source text, the proposed typed
record, the evidence the reviewer must supply, and accept / reject / defer. A
promoted record carries its originating field, decision reference and reviewer.
A rejected item stays rejected across regeneration.

Make throughput visible. The tracker needs a real number per queue so EV-06
through EV-08 can be gated on it rather than guessed at.

Do not auto-promote anything. Do not infer an identity, a date, a role or a
relationship. Do not change `approvalStatus` in bulk.

## Acceptance

E-A4 and E-A5 pass, including the homonym fixture. A promoted record is
distinguishable from an authored one. Regenerating the queues does not lose or
resurrect a decision. P04 holds after promotion: every surviving reference
resolves.

## Completion

`completions/EV-05.md`, with the per-queue throughput numbers; update the
tracker. Stop for review.
