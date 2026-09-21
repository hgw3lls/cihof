# CE-04 — Turn a selected person into a sourced, layered encounter

**Depends on:** CE-01, CE-02, CE-03  
**Status:** Not started; this is a proposed implementation task.

## Goal

Provide What changed?, evidence and approved gallery browsing without rewriting historical sources or depending on pending films.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/interpretiveModel.ts`
- `src/data/useStorySections.ts`
- `src/data/useArchiveLeads.ts`
- `src/data/useMediaManifest.ts`
- `src/features/archive-exhibit/record/PersonStory.tsx (proposed)`
- `src/features/archive-exhibit/record/EvidencePanel.tsx (proposed)`
- `src/features/archive-exhibit/record/PersonGallery.tsx (proposed)`

## Work

Extract RecordView into maintainable components without losing close/focus/scroll/QR behavior. Add a short encounter layer with the existing published contribution, explicitly approved context and a path to the complete biography. Reuse StorySectionRecord/StoryBeat for the deeper “What changed?” sequence.

A step can show an action, place, organization, event or evidenced consequence. Each step carries a source reference and approved interpretation. Omit absent steps instead of inferring a before/after story or continuing legacy. Starter beats that fail publication remain unavailable publicly; provide honest no-story behavior while preserving the base record.

Add an in-app evidence panel with source title, locator, authorized excerpt or caption, and relevant media. Preserve distinction among quotation, source text, authored interpretation and catalogue metadata. Do not make external browser navigation the only evidence path on the kiosk. Public source links and QR can remain optional.

Use the existing gallery manifest and local image assets. Add an approved per-person gallery with captions/credits, next/previous controls, fit/zoom/reset buttons and optional pan/pinch. Do not load all 999 gallery images into memory. Audit rights scope for new public use; do not generate approvals from the absence of an explicit field.

Support reviewed paragraph segmentation in canonical content rather than arbitrary runtime text rewriting. Keep full source text unchanged. Preserve no-film behavior; do not promote or download the pending holdings to fill the interface.

Add realistic empty/loading/missing-file/source-error states. Test opening story → source → gallery → close → original selection and focus. New content fixtures use fictional test IDs only, not fabricated examples under real inductees.

## Acceptance

T06, T10, T14 and P01–P08 have coverage. Every displayed story step is eligible and sourced; gallery controls are tap/keyboard usable; no available base person is hidden for lacking enrichment. Existing record/QR/session behaviors remain intact.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-04.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-04_contribution-stories-and-evidence.md.

Implement CE-04 only: progressive person interpretation, What changed?, evidence panel and approved gallery in the current record flow. Reuse existing loaders/records and preserve all source/rights gates. Do not auto-approve starter content.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
