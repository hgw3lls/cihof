# CE-01 — Make content semantics and publication rules explicit

**Depends on:** CE-00  
**Status:** Not started; this is a proposed implementation task.

## Goal

Provide the reviewed data structures that make the intended interactions truthful without losing the existing collection.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/data/types.ts`
- `src/data/relationshipPublication.ts`
- `src/features/archive-exhibit/interpretiveModel.ts`
- `scripts/prepare-data.js`
- `vite.config.ts`
- `src/data/runtimeDataBundle.ts`
- `src/features/review-dashboard/ReviewDashboardView.tsx`

## Work

Read DATA_CONTRACTS.md and inspect the generators plus existing canonical files under `data/`. Reuse current Person/Community/Place/Organization/Event/Theme/Media entities. Add typed evidence, review/target metadata, affiliation-kind attributes, geometry-kind metadata and date precision through additive interfaces and adapters. Reconcile Inductee IDs with existing `person:` entity IDs; no name-based matching.

Preserve all currently eligible base profiles. Produce a migration report for the legacy draft/curated fields and mixed identity/organization vocabulary; do not auto-approve new claims or hide every legacy draft record. A compatibility policy must be explicit and testable. Add new interpreted content in withheld/draft state until an authorized decision is supplied.

Extend the current visitor serializer, retaining its candidate and film exclusions. Centralize pure eligibility helpers so UI, build, export and portal preview agree. Remove nonpublished story beats and staff-only archive metadata from public payloads according to the new contract, while preserving intentionally approved public catalogue metadata. Validate endpoint integrity after filtering.

Add portal fields or review exports for the new decisions; keep operational visitor admin separate. Map the 14 place starters and 3 story starters as review inputs, not published enrichment. Preserve original wording, provenance and references. Do not fill missing coordinates, affiliations, relationships or historical dates by inference.

Create deterministic test fixtures under test-only paths, covering multiple affiliations, uncertain/unknown dates, mixed relationship semantics, withheld claims, legacy base profiles, public/kiosk differences and source-preserving migration. Fixture IDs must not be real people. Add tests proving they never ship.

## Acceptance

Current base profiles remain accessible. New draft/withheld enrichment is absent from public serialization; references resolve; old deep-link IDs stay valid. Vocabulary meanings, evidence, review and rights are separate. Generation is repeatable and canonical edits survive prepare:data. No unauthorized approval occurs.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-01.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-01_content-contracts-and-publication.md.

Implement the additive contracts, compatibility adapters, shared publication rules and tests for CE-01 only. Preserve baseline profiles and existing public-target exclusions. Do not build a competing data model or populate historical gaps with invented content.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
