# Ingesting the HOF_WORLD v3 layout

Scope for taking `HOF_WORLD_refactored.zip` into this repository. Measured against
the archive as delivered on 2026-09-22, 344 files, 52 MB unpacked.

## Verdict

**Worth doing, for the model and for places — not for relationships.**

v3 is a real refactor rather than a re-pile. `docs/MODEL.md` states the rule it is
built on: *assert a fact once, derive everything else.* Typed ids, one edge table,
a JSON Schema per dataset, derived views kept separate from asserted facts, and an
id map that records what changed.

What it does **not** do is move the Links lens. Of its 53 person-to-person induction
edges, **zero** are facts the crosswalk does not already hold:

```
already produced by resolved crosswalk rows : 29
the crosswalk knows, awaiting resolution    : 24
the crosswalk does not record at all        :  0
```

The 24 are rows among the 70 nobody has resolved yet. Resolving those names produces
the same relationships from data already committed, with better evidence — the
institution's own manifest rather than a scraped profile page.

And **nothing in the archive is approved**. No `decisionReference` or `contentVersion`
appears in any of the 344 files; `verification` carries `layer` and `confidence` and
no `status` at all. Every claim it contributes arrives needing the same review as
anything else.

So this is an infrastructure and content-breadth ingest, not a shortcut to an open
lens.

---

## Three hazards, in the order they will bite

### 1. `app/curated-metadata.json` would revert today's corrections

The archive predates them. Its copy still holds the pre-correction values:

| Person | Archive | Repo, as of `71ed1cd` |
| --- | --- | --- |
| `bill-miller-2017` | `["Slovenian"]` | `["Polish","German"]` |
| `ralph-j-perk-2011` | `["Czech"]` | `["Czech","Slovak"]` |
| `dick-pogue-2015` | `[]` | `["Scotch-Irish"]` |

A file-level copy silently undoes three curatorial decisions made on 2026-09-22 under
the heritage corrections. The parity test would catch it — its reviewed-differences
list would stop matching and `every reviewed difference is still a real difference`
would fail — but only after the damage was committed.

**This is the same class of hazard as the v1 archive's stale crosswalk and media
manifest, and it is live again.** Ingest must be field-level and directional: take
fields the repo does not have, never overwrite a field the repo has changed more
recently.

### 2. `app/legacy-graph/entity-relationships.json` must not reach `cihof_relationships.json`

It holds **2,041** records, and they are mostly context wearing the word
"relationship":

```
legacy_related_candidate  888      has_theme            436
member_of_community       198      inducted_in_class    111
has_media                 297      inducted_by_candidate 111
```

`cihof_relationships.json` is read by `readRelationships()` and fed to
`publishedRelationships`, which counts toward the Links threshold. Putting
`inducted_in_class` or `has_theme` in there is exactly the erosion `connection.ts`
was written to prevent — two people honoured the same year have a context in common,
not a relationship. It is also the scene `docs/CLEAN_APP_PLAN.md` describes the new
model as deliberately refusing.

The file is fine as a **source**. It is not a relationship input.

### 3. The id map must be used, not assumed

v3 normalised the doubled-year person ids. Three people join by a different string:

```
person:carolyn-balogh-2016     ->  carolyn-balogh-2016-2016
person:arnie-de-la-porte-2016  ->  arnie-de-la-porte-2016-2016
person:khalid-samad-2016       ->  khalid-samad-2016-2016
```

82 of 85 person-to-person edges resolve without it; those three drop out silently.
The archive solves this itself — `_meta/id-map.json` maps all 111 with a `changed`
flag, and its note confirms only person ids moved. Any ingest that strips the
`person:` prefix instead of reading the map loses them and says nothing.

---

## What the repo would consume

| v3 | Take? | Notes |
| --- | --- | --- |
| `_meta/id-map.json` | **Yes, first** | 111 people, `changed` flag. Everything else depends on it. |
| `core/places.json` | **Yes** | 82 places, up from 14. No review block on any of them. |
| `edges/edges.json` → person→place | **Yes** | 132 edges over 64 places. **No role on any of them.** |
| `edges/edges.json` → person→person, non-induction | **Yes** | 7 mappable: 2 `collaborator`, 2 `family_spouse`, 1 `family_relationship`, plus new `parent_of` and `spouse_of`. |
| `schemas/*.schema.json` | **Yes** | 28 schemas. Worth wiring into `validate:entities`. |
| `edges/edges.json` → person→person inductions | No | All 53 already in the crosswalk. |
| `app/curated-metadata.json` | **Field-level only** | See hazard 1. |
| `app/legacy-graph/*` | **No** | See hazard 2. Keep as a source, never as input. |
| `views/**` | No | Derived. Recompute rather than import. |
| `interop/**` (CIDOC-CRM, Linked Art) | Not now | Real value for an eventual catalogue exchange; nothing consumes it today. |
| `sources/**`, `scripts/legacy/**` | No | Read-only provenance. 23 `.py` and 1 `.sh` — none should be run. |

### On the one intentional value change

`MIGRATION.md` flags it: `app/compat/inductees.json` reports `videoRightsStatus:
approved` for 64 people. I checked this against the repo rather than take it on
trust — `data/media_manifest.json` already has all **93 videos at `rightsStatus:
approved`** and **`approvedForPublicWeb: false` on all 93**. The archive is catching
up to the repo, not granting anything. Across all 344 files `approvedForPublicWeb`
appears 1,119 times and is `false` every time.

So this ingest does not touch film clearance. Worth re-verifying after ingest all the
same, because it is the one place where being wrong is expensive.

---

## What it unlocks, and what it does not

**Links: nothing directly.** 7 new mappable person-to-person relationships, each
needing the same review as the rest — a `decisionReference`, a `contentVersion`, a
publication decision and structured evidence. Against the 31 already published, that
is a rounding error. The 24 unmappable (`documented_mention` 16,
`ceremonial_connection` 4, `public_service_relationship` 2, `electoral_relationship`,
`friend`) are the same triage the links scope already describes.

**Places: the real prize, and still gated.** 14 → 82 places and 132 associations is
the difference between a lens that cannot open and one that is a review pass away.
But as delivered:

- **no place carries a `review` or `publication` block**, so `publishedPlaces()`
  returns 0 of the 8 needed;
- **no person→place edge carries a role**, so `placeAssociationProblems` rejects all
  132 for "no role" — and the catch-all `associated` is explicitly refused too,
  because it "does not say what the person did there".

Both are decisions, not transforms. Someone has to say whether this is a place worth
showing, and what each person did there — `lived`, `worked`, `studied`, `taught`,
`organized`, `served`, `founded`.

---

## Ordered steps

### Phase A — the join, and the guard against hazard 1

| # | Step | Effort | Judgement |
| --- | --- | --- | --- |
| 1 | Read `_meta/id-map.json` into a resolver; test that all 111 map and that the 3 changed ids round-trip | **~0.5d** | none |
| 2 | A field-level merge that **refuses** to overwrite any curated field whose repo value differs from the archive's, reporting each refusal. Dry-run default. | **~1d** | none |
| 3 | Run it over `app/curated-metadata.json`; confirm it refuses exactly the three heritage corrections and takes nothing else it should not | **~2h** | none |

Step 2 is the load-bearing one. Without it every later ingest is a chance to revert
somebody's work.

### Phase B — places, which is why this is worth doing

| # | Step | Effort | Judgement |
| --- | --- | --- | --- |
| 4 | Ingest `core/places.json` as **seeds**, no review block invented | **~0.5d** | none |
| 5 | Ingest the 132 person→place edges as unreviewed associations, role left empty | **~0.5d** | none |
| 6 | A places review sheet, same pattern as `review:links` — refuses to overwrite a filled-in sheet, generates reviewer columns empty | **~1d** | none |
| 7 | **Curator: review ≥8 places and assign a role per association** | **~1–2d of curator time** | **≥8 places + up to 132 roles** |
| 8 | Write `Places.tsx`; the lens has no view, exactly as Links had none | **~2–3d** | design |

### Phase C — the rest

| # | Step | Effort | Judgement |
| --- | --- | --- | --- |
| 9 | Wire the 28 schemas into `validate:entities` | **~0.5d** | none |
| 10 | The 7 non-induction relationships through the existing links worksheet | **~0.5d** + 7 decisions | **7 source judgements** |
| 11 | Decide on `interop/` — keep for a future catalogue exchange, or drop | — | a call, not work |

**Phase A is ~2 engineering days and protects everything after it. Phase B is ~4–5
days plus 1–2 days of curator time and opens the Places lens.** Phase C is optional.

---

## Risks

- **A file-level copy reverts curated work.** The highest-probability failure, and it
  has already nearly happened once. Phase A step 2 exists for this; nothing should be
  ingested before it.
- **The legacy graph reaches the relationship input.** 2,041 records, mostly context,
  sitting in a file whose name says "relationships". It would clear the Links
  threshold instantly and be wrong.
- **Places get bulk-approved to reach 8.** 82 places and a threshold of 8 is an
  invitation. The role field is the guard — `associated` is refused precisely so a
  sweep cannot pass.
- **The id map is skipped** because stripping `person:` appears to work for 82 of 85.
- **Scripts get run.** 23 `.py` and 1 `.sh` ship in the archive. They are provenance,
  not tooling; none has been executed and none should be.
- **`interop/` is mistaken for a deliverable.** CIDOC-CRM and Linked Art exports are
  genuinely good, and nothing in this repository reads them. Taking them on implies
  maintaining them.
