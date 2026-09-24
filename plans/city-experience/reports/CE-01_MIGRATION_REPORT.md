# CE-01 content migration report

**Content revision:** `b81f21754dac02d1d10de0a78dcd7419d6975430d463254e88000ad7bafa4fd8`  
**Generated:** 2026-09-10T21:42:07.305Z

## Base-profile compatibility

111 current base profiles remain eligible through the
canonical id-and-name compatibility policy. Existing `approvalStatus` values are
reported without being reinterpreted as enrichment publication decisions.

- draft: 111

## Canonical identity adapter

The adapter is `person:<canonical-inductee-id>`. It checked
111 person IDs. Missing mappings:
- None.

## Review inputs

- 53 legacy vocabulary labels remain `unresolved-legacy`.
- 14 place seeds remain staff-only and need review.
- 3 story starter records remain staff-only and need review.
- 11 archive leads retain their recorded workflow and target states.

Schematic place markers are explicitly reported as
`cihof-legacy-schematic-v1`; they are not geographic coordinates. Original
labels, story wording, provenance, and candidate person IDs are preserved in
the canonical/review records.

## Publication result

The public and kiosk serializers preserve eligible base profiles and remove
unapproved story beats, place seeds, archive workflow records, candidate
entities, provisional relationships, and target-ineligible media. New content
requires an approved review record with a decision reference and content
version plus an independently allowed target.

## Guardrails

- No vocabulary kind is inferred from a label.
- Schematic place markers are not geographic coordinates.
- Story starters and place associations remain staff review inputs until an authorized decision is recorded.
- Curated or documented provenance does not grant publication permission.
