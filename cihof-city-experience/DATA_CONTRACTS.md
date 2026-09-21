# Proposed data and publication contracts

This is an additive design specification. It is not a drop-in replacement for `src/data/types.ts`, an approved taxonomy, or authorization to publish new historical content.

## 1. Keep one identity model

`Inductee.id` remains the canonical visitor identifier. The existing entity graph uses person IDs such as `person:<inductee-id>`; use the existing `legacyInducteeId` mapping or a validated adapter, not name matching or unreviewed string guesses. Store references, not copied biographies or second person tables.

Existing `EntityRecord` types already support Person, Community, Place, Organization, Event, Theme and Media. Add typed attribute variants, entity validators and shared selectors; preserve compatibility with existing runtime schema during migration. Existing explicit person relationships remain readable through an adapter into the new relation presentation.

## 2. Evidence, review and publication are different

Introduce a reusable evidence reference with stable ID, source title, URL or local citation, locator (page/paragraph/timecode/catalogue reference where applicable), evidence kind, and optional excerpt. Offline presentation needs enough local citation/context to make sense without a live URL. Do not assume a link grants image reproduction rights.

Introduce explicit review metadata for new interpreted items: status `draft | needs-review | approved | withheld`, authorized decision reference, optional review date, and the version of content to which approval applies. Sources marked `curated` or `documented` describe provenance; they are not blanket approval for every use.

Represent target permission independently: public web and kiosk display decisions, plus any staff-only status. A changed approved claim should return to review or carry a new explicit decision, rather than silently inheriting approval for altered text.

Existing records require a documented migration policy. Preserve the baseline 111-person collection while mapping old field meanings. Do not turn all `approvalStatus: draft` people invisible and do not relabel them all approved. Compatibility may retain their existing base profile while withholding new enrichments.

## 3. Identity/affiliation vocabulary

Extend Community attributes with an explicit vocabulary kind: heritage/ethnic-cultural community, nationality, language community, religious community where explicitly documented, organizational affiliation, or unresolved legacy label. Organization records should hold actual organizations; preserve legacy aliases for search.

An affiliation assertion links a person to the vocabulary/entity with original source wording, evidence references, applicable date/qualifier when known, provenance, and review/publication status. A person may have several assertions of different kinds. Do not substitute nationality, birthplace, language, religion or a present-day country for ethnicity.

Crosswalk rules must be reviewed. For example, moving a named institution from a broad Community dropdown to Organization is a taxonomy operation; it must not remove the original source wording from the record. Labels whose meaning is ambiguous should remain unresolved for staff review rather than be guessed from their spelling.

Visitor vocabulary can use approachable labels such as Communities and Heritage, with a short explanation of what is being shown. Never attach a fixed color, flag, numerical worth, or compulsory single group to a person.

## 4. Places and geographic geometry

Extend Place attributes with place kind, current/historical display names, optional neighborhood ID, optional address, explicit geometry type, geometry provenance, and date validity. Geographic points require longitude/latitude with validated ranges. Schematic points require a declared coordinate system and cannot be passed into geographic calculations.

Person–place connections belong in the existing entity relationship structure, with role (`lived`, `worked`, `studied`, `organized`, `served`, `associated` or a reviewed vocabulary), evidence and dates. Source spelling of a neighborhood must not silently imply membership in today's polygon.

The 14 starter places can be migrated as draft/research seeds. Existing listed people and organizations are candidates until their associations meet the new publication policy. Review a subset for a real prototype; keep the remainder in the staff queue. The absence of a mapped place is missing coverage, not evidence of no Cleveland connection.

## 5. Contributions and events

Use Event entities with an explicit kind distinguishing `induction` from historical activity, institutional milestones, and other reviewed contribution events. Link persons and relevant organizations/places/themes through typed relationships.

An optional contribution narrative connects existing entities/events through authored StoryBeats. Each beat has its own claim text, evidence, review state, optional local media reference and references to relevant entities. An outcome or legacy needs its own evidence; it cannot be inferred merely from an event sequence.

Extend `EntityDateRange` with precision/uncertainty semantics. Support exact dates, years, bounded intervals, approximate intervals and unknown dates. Unknown is not zero, the current year, or the induction year. Do not infer living/deceased status or current activity from an open-ended historic statement. Record the source's temporal scope.

## 6. Relationship semantics

Every displayed connection has an explicit presentation kind:

- **Direct relationship:** evidence supports the described connection between people/entities.
- **Shared documented context:** both records establish an association with the same place, organization, event, theme or period; no interpersonal acquaintance is implied.
- **Curatorial comparison:** authored interpretive connection, clearly labeled and approved.
- **Induction context:** computed common induction year, labeled as such.

The relationship record retains direction and a reverse-safe explanation. “A mentored B” must not become “B mentored A” when recentered. Multiple records can support one visible neighbor; do not discard their citations. Do not flatten every approved shared-theme record into a direct relationship label.

Use computed tag intersections only for low-claim context with explicit labels. Do not auto-promote the old provisional `inducted_by_candidate`, `legacy_related_candidate`, or similar source associations. The deployed artifact already excludes those; preserve that behavior.

## 7. Media

Reference the existing media manifest. Keep source URL, runtime path, dimensions, alt text, credit, rights scope and permitted target as separate concerns. Do not infer consent from file existence. Existing primary/gallery images have recorded rights and kiosk approvals; an authorized reviewer must interpret public reuse scope where its field is absent.

Use local derivatives for the approved display size, lazy-load nonessential galleries, and retain originals according to the institution's archive policy. Captions must describe what is actually known. An image is not automatically evidence of every claim in the associated biography.

Video/audio remains optional. Preserve current requirements for approval, runtime files, poster, captions and transcript. If a published record's media is withdrawn, its controls, public payload and generated file manifest must all update consistently.

## 8. Visitor runtime serialization

Extract or reuse pure serializer functions from the current Vite logic. UI, serializer, exports and validation must agree on eligibility. Validate referential integrity after filtering: no relationship endpoint, media reference, story step or trail points to a removed item.

Public target: eligible base records plus approved enrichment and allowed assets. Exclude test fixtures, staff-only research notes, unpublished story beats, withheld material, and nonapproved inferred candidates. Intentional public catalogue metadata can have a separate publication decision without implying permission to reproduce an object.

Kiosk target: only material permitted for installed display. A restricted build must never be uploaded as the public site. Portal target: authorized staff workflow metadata; preserve its independent entry and distribution rules.

Publish a content schema version, content revision/hash, build SHA, and target in the release manifest. Ensure split-file compatibility and bundled data produce equivalent visitor results. Treat old source report counts as source counts, not post-filtered artifact counts.

## 9. State contract

Proposed state shape, adapted to the final implementation:

```ts
type ExhibitState = {
  lens: 'people' | 'places' | 'links' | 'years';
  grouping: 'all' | 'community' | 'contribution';
  selectedPersonId: string | null;
  comparePersonIds: [] | [string] | [string, string];
  query: string;
  facets: { communityIds: string[]; contributionIds: string[]; placeIds: string[] };
  time: { mode: 'induction' | 'activity'; from: number | null; to: number | null };
  detail: { kind: 'none' | 'record' | 'story' | 'evidence' | 'gallery' | 'comparison'; id?: string };
  // Serializable stable IDs in URL; element references and scroll restoration stay local.
};
```

Do not copy this blindly where existing state already supplies a field. Use one canonical reducer and selectors, not synchronized competing stores. Session settings, content review and local operational overrides are not visitor selection state. Reset clears only the appropriate visitor state and stops media through the existing media-control owner.
