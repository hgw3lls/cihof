# Interpretive content review

MG-05 changes display and discovery, not historical or rights approvals. Existing
`approvedThemeTags`, `approvedCommunityTags`, and `approvedCountryTags` remain the
vocabulary boundary. Overall person review status is separate from these existing
field-level names; this stage does not certify the earlier editorial decisions.
Generated tags do not become contribution/community filters or heritage facts.

## Entry invitation

`src/config/exhibitCopy.ts` holds optional curator-controlled invitation text and
its review status. Until authorized review, the visitor sees a neutral functional
invitation. Replace the blank text and set approved only after that review.

## Text integrity

The active record renders stored `bioText` unchanged, including paragraph breaks.
It does not prepend a name, split sentences into invented paragraphs, truncate the
full biography, or repair grammar. Contributions use the existing honored-for
field, then an explicitly curated/documented summary, then an honest fallback.

The generator preserves reviewed summary, context, biography override, and
life-work strings without collapsing their whitespace. Raw legacy CSV import
still has its pre-existing normalization pipeline; byte-for-byte preservation is
of the stored/runtime text, not the raw harvested HTML/CSV. MG-05 corrects one
duplicate-heading normalization bug that removed the subject from the first
sentence. Canonical source files are unchanged.

Many legacy biographies remain one long paragraph. Paragraph restructuring must
be a reviewed `bioTextOverride` migration with an old/new text diff, not a runtime
heuristic. The full source remains available while that review is pending.

## Optional Cleveland context

Reuse `data/cihof_story_sections.json`, keyed by person ID. The record provenance
must be `curated` or `documented`. A published beat requires `contextScope` equal
to `cleveland`, `reviewStatus` equal to `approved`, a nonempty `sourceReference`,
and non-inferred provenance. `sourceUrl` is optional and only HTTP(S) links render.
Existing curated records are not automatically approved Cleveland interpretation.
Headline, body, place, and organization remain distinct fields. No missing content
is filled with invented objects.

## Linked archival descriptions

Reuse `data/cihof_archive_items.json` and the archive-lead adapter. A displayed
description requires both status and visibility `visitor-ready`, an HTTP(S)
`sourceUrl`, a nonempty `rightsNote`, and explicit `approvedForPublicWeb: true`
or `approvedForKiosk: true` for the corresponding build. Unknown scope is false.
Review title, displayText, repository, collectionTitle, callNumber, creditLine,
and connectionStrength. Describe the actual permission in rightsNote; scope flags
are assertions made by authorized staff, not rights verification by the software.
This view does not embed archival image payloads or IIIF viewers.

The visitor view gates these additions. It does not constitute a complete audit
of staff-only content in all generated artifacts; release-boundary review remains
part of MG-08. No existing archive lead was promoted by MG-05.

## Portraits and evidence

Use the existing curated `image.focalPoint` (center, top, bottom, left, right, or
two 0-100 percentages). Missing/invalid values use geometric center. Do not infer
a focal point from identity or generate a substitute portrait. Review at the
actual wall size as well as phone size.

Run `npm run mg05:capture` against the local public preview. Local screenshots and
the error/overflow manifest are written to `artifacts/mg05-review/`. These are
engineering evidence, not curator, accessibility, rights, or hardware sign-off.
