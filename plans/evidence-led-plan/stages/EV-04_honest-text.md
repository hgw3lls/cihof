# EV-04 — Say which words the pipeline wrote

**Depends on:** EV-01
**Cases:** P06, E-A2, E-A3

## Goal

A visitor can tell pipeline-generated text from source biography, and no shipped
line contains a template artifact.

## Why here

Before interpretation, not after. Building contribution stories and evidence
panels on top of unlabelled generated text is how a museum ends up publishing a
claim nobody made. See [AUDIT.md](../AUDIT.md) §1.4.

## The findings this stage answers

- `documentedContextLine` reads `… honoree connected to Serbian.` — a bare
  demonym used as a noun — in **88 of 111** records.
- `honoredForSummary` is a template, 0/111 verbatim from `bioText`, rendered to
  visitors as the person's contribution line.
- `storyHighlights` is verbatim `bioText` for **74/111** and altered for the
  other **37**. A field with inconsistent provenance cannot be cited as source
  text, and those 37 need tracing.

## Before changing anything

Answer open questions Q1 and Q5 with curators. This stage prepares three
outcomes — label, rewrite, withdraw — and applies the one chosen. It does not
choose. Do not rewrite a line into something that reads more confident than its
source.

## File targets

- `scripts/data-utils.js`, `scripts/prepare-data.js` — where these fields are generated
- `src/features/archive-exhibit/interpretiveModel.ts` — `publishedContribution`, `sourceBiographyText`
- `src/features/archive-exhibit/ArchiveExhibit.tsx` — the record and focus panel
- `cihof-city-experience/DATA_CONTRACTS.md` — if a provenance field is added

## Work

Mark generated fields as generated in the canonical data, not only in the UI.
Give the visitor a visible, non-fussy distinction between the institution's
biography and a derived line. Fix the 88 broken lines at the generator, not by
patching strings.

Trace the 37 divergent `storyHighlights` records to a decision or flag them for
review. Do not silently normalize them.

## Acceptance

E-A2 and E-A3 pass across the whole collection, not a sample. P06 holds: source
biography retained, quotations exact, authored text labelled. The curatorial
decision behind the chosen outcome is referenced by identifier.

## Completion

`completions/EV-04.md`; update the tracker. Stop for review.
