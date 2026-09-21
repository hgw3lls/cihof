# Relationship publication workflow

## Publication boundary

The visitor relationship feed is `data/cihof_relationships.json`. The staff portal writes to this file only when a review draft is explicitly marked approved. `scripts/prepare-data.js` validates and copies those records to `public/data/relationships.json` and the runtime bundle.

Generated `public/data/entity-relationships.json` is not a visitor approval source. It contains migration candidates such as `inducted_by_candidate`, inferred `relatedIds`, entity associations, and media links. These remain available in canonical generated data and the restricted portal build for staff review, but Links does not publish them as person-to-person claims.

Public and kiosk builds also remove candidate-only person entities, legacy `relatedIds`, and provisional `inducted_by_candidate`, `legacy_related_candidate`, and `related_to` assertions from their runtime bundle, entity graph, Linked Art export, and CIDOC CRM export. The approved `relationships` feed is the only visitor payload authorized to carry reviewed person-to-person claims.

Source-curation relationship leads and portal drafts also remain non-public until an authorized reviewer approves and saves them. Hidden, needs-research, unreviewed, and inferred rows are not written to the approved feed.

## Approved record requirements

Every record in `data/cihof_relationships.json` must have:

- a stable `id`
- a current `sourcePersonId`
- a valid `targetEntityId` and `targetEntityType`
- a typed `type`
- a visitor-readable forward `displayLabel`
- an optional `reverseDisplayLabel` when reverse wording needs to differ
- `documented` or `curated` provenance
- a non-empty `referenceNote` identifying the reviewed evidence or curatorial source

`inferred` records fail validation. `same_class` records also fail validation because Links derives shared-year context directly from the two induction records and labels it “Honored in the same year.” A shared induction year is context, not evidence of friendship or collaboration.

## Visitor Interaction

The map uses two deliberate activations, with no double-click timer. The first
activation of a connected portrait opens an on-map explanation with expandable
sources and a translucent preview of that person's network. Preview portraits
and lines have no controls, accept no pointer input, and are hidden from assistive
technology. The second activation recenters the live network. Selecting another
portrait changes the preview; blank-map activation, the dismiss control, or Escape
closes it. Explicit Center and Read record actions remain available.

The complete connection list is an optional view, opened from the map header;
it is no longer a permanent sidebar. Opening it focuses its heading and Escape
returns focus to its toggle. Publication and evidence rules are unchanged.

## Direction and identity

`sourcePersonId` to `targetEntityId` is the canonical direction. Links keeps the stable record ID and every approved record, including multiple relationship types between the same pair. When viewed from the target endpoint, `reverseDisplayLabel` is used if present; otherwise the interface identifies the claim as coming from the source person's approved record. The `inducted_by` type has explicit forward and reverse visitor wording.

## Example

```json
{
  "id": "relationship:person-a:person-b:induction-2025",
  "sourcePersonId": "person-a",
  "targetEntityId": "person-b",
  "targetEntityType": "person",
  "type": "inducted_by",
  "displayLabel": "Inducted by Person B",
  "reverseDisplayLabel": "Inducted Person A",
  "referenceNote": "Reviewed 2025 induction program, page 4.",
  "provenance": "documented"
}
```

No current relationship candidate was approved as part of MG-04. The approved feed remains empty until staff completes review.
