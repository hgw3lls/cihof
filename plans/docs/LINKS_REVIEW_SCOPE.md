# Opening the Links lens: a review scope

## Answer first

**Yes. The Links lens can open from data already in this repository, with no new
material and no ingest from the uploaded archive.**

The repository's own induction crosswalk already carries 29 candidate resolutions it
generated from its own corpus. Accepting only the 25 that are unambiguous — one
candidate, no choice to make — and adding a publication decision yields:

```
inductionRelationships():        31
  failing connectionProblems:     0
  publishedConnections(kiosk):   31
  lens: { id: 'links', available: true, count: 31, minimum: 15 }
```

**31 documented relationships against a threshold of 15**, all passing the real gate,
from code and data already committed. The archive's proposed resolutions raise that
to 47, but they are not needed to clear the bar.

What stands between 0 and 31 is **not data**. It is two human decisions: confirming
25 name resolutions, and signing one publication decision. Section *"Why it reports
0 today"* has the exact mechanism.

And on the second question — **no, the other archive files contain no new documented
connections.** Every person-to-person pair in them that is a *relationship* claim is
already in the verified 93. The ~426 additional pairs are copresence (two names on
one page, two people in one archival box), which this model classifies as context,
and context never counts toward the threshold. Section *"The other datasets"* has the
per-file breakdown.

---

## The goal, plainly

`packages/content/src/lenses.ts` offers the Links lens at **15 reviewed, documented
person-to-person relationships**. The collection has 0. This document scopes the work
that turns that number into something above 15, and says which parts are mechanical
and which are somebody sitting down and deciding.

"Reviewed" is not a mood. For a relationship to count, `publishedConnections(values,
target)` has to accept it, which means all of this, per claim:

```ts
{
  claim: 'documented',
  id, from, to, kind,                    // kind ∈ RelationshipKind
  label,                                 // reads from → to
  inverseLabel,                          // required when the kind is directional
  review: {
    status: 'approved',
    decisionReference: '…',              // required — traces to a person
    contentVersion: '…',                 // required — names the wording approved
  },
  publication: { publicWeb: false, kiosk: true },
  evidence: [{ id, title, kind }],       // at least one usable entry
}
```

`isApproved()` rejects a bare `status: 'approved'`: without `decisionReference` the
approval traces to nobody, and without `contentVersion` it cannot be told which
wording it covered. `isSubstantiated()` is deliberately stricter still — evidence is
required for approval, not decorative beside it. This is the collection's most
load-bearing claim type: that two real people's lives actually touched.

**Approving for the kiosk is not approving for the public web.** `allowsTarget()`
reads `publication.publicWeb` and `publication.kiosk` separately, and
`packages/pipeline/tests/induction-links.test.ts` already asserts that a kiosk
approval leaves Connections off on the public target. The recommendation below is
kiosk-only. The public web is a second decision, made later, on its own evidence.

---

## The finding that changes the shape of this work

**The route already exists, and it is not a worksheet.**

`packages/content/src/crosswalk.ts` holds a designed, tested path from the roster's
own `inducted_by` column to fully-formed `DocumentedRelationship` records.
`inductionRelationships()` emits them with `label`, `inverseLabel`, `review`,
`publication` and `evidence` already attached. It is wired into
`packages/pipeline/src/build/emit.ts:154` and covered by nine tests in
`packages/pipeline/tests/induction-links.test.ts`.

It yields nothing today because `data/cihof_induction_crosswalk.json` has **95
entries, all `unresolved`, and no `publicationDecision`**.

I measured what it would yield if those two gaps were closed, by adopting the
archive's proposed resolutions and adding a publication decision:

```
merged progress: { total: 95, unresolved: 2, inductee: 33, notAnInductee: 60,
                   rowsResolved: 109, rowsTotal: 111, relationshipsAvailable: 47 }

inductionRelationships() yields: 47
  failing connectionProblems:     0
  publishedConnections(kiosk):   47
  publishedConnections(public):   0     ← kiosk-only decision, working as designed
```

**47 relationships, zero problems, from machinery that is already written and
tested.** The threshold is 15. So the Links lens does not need a new worksheet to
open. It needs the crosswalk resolved and one publication decision made.

That reframes everything below. The worksheet is still worth building, but for a
much smaller and more honest purpose than "open the lens".

### And the archive is not required for it

The 47 above uses the archive's proposed resolutions. The repository can get most of
the way there on its own, because `buildInductionCrosswalk` **already generates
candidates from the repo's own corpus**:

```
95 entries:  25 with exactly one candidate
              2 with more than one (ambiguous — a real choice)
             68 with none
29 candidates in total, every one basis: 'corpus-induction-record'
```

Those come from `data/hof_world_person_relationships.json`, which is already
committed. Accepting the 25 unambiguous ones and adding a publication decision:

```
progress: { total: 95, unresolved: 70, inductee: 25, rowsResolved: 31,
            relationshipsAvailable: 31 }
inductionRelationships(): 31   problems: 0   publishedConnections(kiosk): 31
lensAvailability → { id: 'links', available: true, count: 31, minimum: 15 }
```

So the honest ranking of what the archive buys:

| Path | Relationships | Needs the archive? |
| --- | --- | --- |
| Confirm the 25 unambiguous candidates the repo already offers | **31** | **No** |
| Also resolve the 8 further names the archive proposes as inductees | 47 | Yes |
| Plus the worksheet's 9 genuinely-new relationships | 56 | Yes |

**The lens clears its threshold twice over at step one.** Everything past 31 is
enrichment, not qualification.

### Why it reports 0 today

Worth stating precisely, because "the data is there but the count is zero" invites
someone to go looking for a bug. There is no bug. The chain is:

1. `lensAvailability()` counts `links` from `relationships.length` in
   `packages/pipeline/src/build/emit.ts:164`.
2. That array is `dedupeById(publishedRelationships([...curated, ...fromCrosswalk], target))`.
3. `curated` is `readRelationships()` → `data/cihof_relationships.json` → **`[]`**.
4. `fromCrosswalk` is `inductionRelationships(crosswalk, nameOf)`, whose **first
   statement** is:

   ```ts
   const decision = crosswalk.publicationDecision;
   if (!decision) return [];
   ```

`data/cihof_induction_crosswalk.json` has no `publicationDecision`, so the function
returns an empty array before looking at a single entry. Even with all 95 names
resolved it would still return nothing —
`packages/pipeline/tests/induction-links.test.ts` asserts exactly that: *"resolving
every name does not publish a single relationship."*

So the gap between 0 and 31 is two curatorial acts, and they are separate on purpose:

- **25 resolutions** — who each recorded name refers to. Knowing this is not
  permission to show it.
- **1 `publicationDecision`** — whether the resulting relationships may be shown, and
  to whom. This is where `decisionReference` and `contentVersion` enter, and it is
  the single field that turns 0 into 31.

The crosswalk's own header says it: *"Resolving all 90 names grants no permission at
all. Without a publication decision this file yields no relationships."* The zero is
the design holding, not a defect.

---

## Where the input data comes from

### Already in the repo

| Source | State |
| --- | --- |
| `data/cihof_induction_crosswalk.json` | 95 names, **all unresolved**, no `publicationDecision`. Regenerated by `npm run crosswalk`, gated in CI by `crosswalk:check`. |
| `data/cihof_relationships.json` | `[]`. Read by `readRelationships()` in `packages/pipeline/src/sources/places.ts`. Curated records here **win over** crosswalk-derived ones for the same pair (`emit.ts:163`), so this is where hand-reviewed relationships belong. |
| `data/cihof_places.json` | 14 place seeds, **none carrying a review record**, so `publishedPlaces()` returns 0 against a threshold of 8. |

### In the uploaded archive, outside the repo

`HOF_WORLD_fixed.zip` → `HOF_WORLD/`. Two files matter:

**`cihof_induction_crosswalk.resolved.json`** (51 KB, 93 entries) — this is the
valuable one. It proposes a resolution for 93 of the 95 crosswalk names: 33
`resolved-inductee`, 60 `resolved-non-inductee`. All 93 match repo rows on
`recordedName`, which is the crosswalk's merge key, so ingest is a clean join.

Every entry is stamped:

```json
"reviewedBy": "Claude (automated, curator sign-off pending)"
```

Take that at face value. These are **candidates**, not resolutions. The crosswalk
type already models exactly this distinction — `CrosswalkCandidate` carries a
`basis` and a `verificationLayer` precisely so "nobody mistakes a normalised string
comparison for a finding". These land as candidates with
`basis: 'corpus-induction-record'`, and a curator converts candidate → resolution.

**`HOF_WORLD_VERIFIED_PERSON_RELATIONSHIPS.json`** (67 KB, 93 person-to-person
records) — the file the upload was about. Its unique contribution is smaller than it
looks, because most of it duplicates the crosswalk route:

| Segment | Count | Disposition |
| --- | --- | --- |
| `inducted_by` already covered by the crosswalk | **47** | Redundant — the crosswalk produces these with better evidence (the institution's own manifest) |
| `inducted_by` *not* covered by the crosswalk | **4** | Genuinely new |
| Non-induction, mappable to a `RelationshipKind` | **5** | Genuinely new |
| Unmappable relationship types | **37** | See below |

So beyond the crosswalk, this file adds **9 usable relationships and 37 open
questions**. Worth having; not the thing that opens the lens.

Its records carry `confidence`, `verificationLayer`, `evidence` (a prose *string*)
and `sourceUrls` — real provenance, but not the review model. **No file anywhere in
the archive contains `decisionReference` or `contentVersion`.** I grepped all 268.

The 4 uncovered inductions:

```
jose-c-feliciano-2012   inducted  honorable-jose-a-villanueva-2015
albert-b-ratner-2011    inducted  mayor-frank-jackson-2025
paramjit-singh-2010     inducted  ramesh-shah-2020
valarie-mccall-2020     inducted  le-nguyen-2026
```

The 5 non-induction mappables:

```
dr-jaya-shah-2012     → mona-alag-2017          collaborator        → collaborated-with
dr-jaya-shah-2012     → ramesh-shah-2020        family_spouse       → family-of
jim-craciun-2017      → mona-alag-2017          family_relationship → family-of
berj-shakarian-2020   → leo-weidenthal-2010     family_spouse       → family-of
dr-eugene-jordan-2024 → khalid-samad-2016-2016  collaborator        → collaborated-with
```

All 93 person ids in the file resolve against the live 111 from `buildPeople()` —
**0 unresolved, no crosswalk needed for id matching.**

### The other datasets — the recently-generated archival corpus

The archive's large, recently-dated research files have no repo counterpart, and the
reasonable expectation is that they contain further connections. **They do not — not
in the sense the lens counts.** Measured, every link-bearing dataset that is not the
verified-93:

| Dataset | Rows | Entities | Distinct pairs | Novel vs the 93 | What it actually is |
| --- | ---: | --- | ---: | ---: | --- |
| `ARCHIVAL_NETWORK.json` → `personPairs` | 308 | person↔person | 308 | **286** | **Copresence** |
| `ARCHIVAL_PERSON_PAIRS.csv` | 308 | person↔person | 308 | 286 | Same data as a CSV |
| `relationship-candidates.csv` | 546 | person↔person | 474 | **426** | **Review queue** |
| `relationship-review.csv` (person targets) | 487 | person↔person | 477 | 426 | Same 426 — identical set |
| `institution_edges_by_role.csv` | 714 | person→**organization** | — | — | Not person↔person |
| `INDUCTION_LINEAGE.json` → `edges` | 36 | person↔person | 35 | **0** | Induction, already held |
| `STORY_CONNECTION_STARTERS` → presenter links | 52 | person↔person | 52 | **0** | Same induction facts |
| `induction-relationship-candidates.csv` | 65 | person↔person | 12 | **0** | 52 rows have no resolved target |

And the remaining large files carry **no person-to-person claims at all**:
`ORGANIZATIONS` (536 orgs), `ARCHIVAL_OBJECTS` (487 resources), `WRHS_COLLECTIONS`
(64), `PROJECTS_INITIATIVES` (169), `CARE_NETWORKS` / `SOCIAL_JUSTICE_NETWORKS` /
`INSTITUTIONAL_ECOLOGIES_EXPANDED` (whose `edges` are all person→institution, the
same 714), and `MULTI_COMMUNITY_LAYERED_IDENTITY` (person→community memberships, plus
`bridgePeople` lists, which are per-person attributes, not pairwise claims).

`SOURCES_CLAIMS.json` holds 2,448 subject–predicate–value claims. Its pairwise
predicates are exactly the set already in the verified 93 — `inducted_by` 32,
`documented_mention` 16, `inducted_by_or_induction_connection` 14,
`ceremonial_connection` 4, `collaborator` 2, `family_spouse` 2,
`public_service_relationship` 2, `electoral_relationship` 1, `friend` 1,
`family_relationship` 1. It is the **substrate the verified-93 was derived from**,
not additional material. Everything else in it is single-person attributes
(`classYear`, `lifeEvent`, `born_in`) or person→organization (`led`,
`associated_with`, `educated_at`, `founded`).

**None of it reaches documented/approved.** No file in the archive carries
`decisionReference` or `contentVersion` — I grepped all 268. Provenance is
`confidence` scores plus a `verificationLayer` string, and the layers are candid
about their own strength: `rule-based-role-candidate` (all 714 institution edges, all
at confidence 0.48), `runtime-derived-candidate` (the lineage edges), and
`derived-from-shared-archival-evidence` (the copresence pairs).

#### The novel pairs are copresence, plainly

This is the part worth being blunt about. The 426 novel pairs in the review queues
break down by the queue's own `evidenceType`:

- **437 rows `shared-source-page`** — both names appear on the same web page.
- **36 rows `profile-name-mention`** — one person's profile mentions the other.
- Confidence 0.34–0.54. **All 546 rows are `needsReview: true`.**

The 286 novel archival pairs are the same shape, and that file guardrails itself:

> "This edge means the two inductees appear in the same source or collection context;
> it is not by itself proof of a direct social relationship."

That is `context`, not `documented` — the exact distinction `connection.ts` was
written to hold. And `ContextBasis` is `'induction-year' | 'community' |
'contribution' | 'place'`: there is **no basis for "same archival box" or "same web
page"**, so even reclassifying them requires extending the type. `SharedContext`
carries no review and **never counts toward the threshold**, so none of this is a
route to 15 however it is classified.

#### The queue's own best subset adds nothing

`relationship-review.csv` flags 13 rows as `review-as-documented-person-relationship`
— its highest-confidence class, the ones it thinks are real relationships. All 13 are
`inducted_by` at confidence 0.78, and **all 13 are already in the verified 93. Zero
novel.** The corpus's own best material is material the repo can already reach
through the crosswalk.

**Conclusion:** the newly-generated corpus is valuable — for organizations, archival
holdings, WRHS pull lists and story clusters — but it contributes **zero additional
documented person-to-person relationships**. The 9 genuinely-new relationships found
earlier all come from `HOF_WORLD_VERIFIED_PERSON_RELATIONSHIPS.json`, and nothing
else in the archive adds to them.

One thing it *does* bear on: **44 `associated_with_place` claims**. `connection.ts:248`
already anticipates these — *"`associated` is the catch-all the 44 seeded links would
land in… it is the one role that tells a visitor nothing"* — and
`placeAssociationProblems` rejects the `associated` role for exactly that reason. So
they are known, and they need a real `PlaceRole` per claim before Places moves.

### ⚠️ Two archive files are OLDER than the repo's and must not overwrite them

Ingest must be file-by-file and explicit. A bulk copy of `HOF_WORLD/` over `data/`
would silently roll back work:

| Archive file | Archive | Repo | |
| --- | --- | --- | --- |
| `cihof_induction_crosswalk.json` | 26,346 B | **35,793 B** | **repo is newer — do not overwrite** |
| `media-manifest.json` | 924,300 B | **927,274 B** | **repo is newer — do not overwrite.** The archive's copy is byte-identical to the repo's own `media_manifest.json.backup-2026-09-22T01-37-52-692Z`, i.e. a snapshot the repo has already moved past |

Also byte-identical and therefore pointless to copy: `story-lenses.json`,
`story-sections.json`, `physical-wall-positions.json`, `cihof_curated_metadata.json`,
`cihof_country_inferences.json`, `cihof_curated_entities.json`,
`cihof_archive_items.json`, `wrhs_exhibition_research_addendum.json`, and
`relationships.json` (both are `[]`).

`places.json` differs — the archive's is larger, same 14 places, adds a `provenance`
field. Still zero review records, so it moves the Places lens not at all.

The archive also contains **15 `.py` files and 1 `.sh`**. None were executed and none
should be ingested.

---

## The worksheet

Given the above, the worksheet is scoped to **what the crosswalk cannot produce**:
the 4 uncovered inductions, the 5 non-induction mappables, and whatever survives
triage of the 37. It writes to `data/cihof_relationships.json`, which `emit.ts`
already reads and already prefers over crosswalk output for the same pair.

It follows `packages/content/src/worksheet.ts` and
`packages/pipeline/src/build/worksheet.ts` exactly:

- Lives in `data/` as JSON, hand-edited between runs.
- `buildRelationshipWorksheet(people, previous)` refreshes **only** derived reference
  columns and adds new rows. Status, decisions and written labels are carried across
  untouched, because they belong to whoever wrote them.
- **Refuses to drop** a decided row whose subject left the roster — exits non-zero,
  names the rows, the way `crosswalk.mjs:28` and `:79` already do. A generator does
  not discard review work.
- `relationshipEntryProblems(entry)` names what is wrong with a row marked ready, in
  the words of the person who has to fix it — mirroring `entryProblems`.
- `comparable()` nulls `generatedAt` so `--check` compares content, not timestamps.

### What a curator sees per row

| Column | Source | |
| --- | --- | --- |
| `from` / `to` + display names | corpus | pre-filled |
| proposed `kind` | mapped from `relationshipType` | pre-filled, **confirmable** |
| `label` / `inverseLabel` | composed from display names | pre-filled, **editable** |
| `evidence[].id` | derived from record id + source index | pre-filled |
| `evidence[].title` | the record's prose `evidence` string | pre-filled, **editable** |
| `evidence[].url` | `sourceUrls[n]` | pre-filled |
| `evidence[].kind` | — | **curator only** |
| source prose + `confidence` + `verificationLayer` | corpus | read-only, shown as context |
| `status` | — | **curator only** |
| `decisionReference` | — | **curator only** |
| `contentVersion` | — | **curator only** |
| `publication.kiosk` / `.publicWeb` | — | **curator only, separately** |

The split is the whole point. A generator can propose a `kind` and compose a label
from two names it already holds. It cannot decide whether a source actually supports
the claim, which is what `decisionReference` records, and it cannot decide who may
see it. `evidence[].kind` is curator-only because choosing between `primary-source`,
`secondary-source` and `collection-record` is an assessment of the source, not a
property of the URL.

The worksheet must **never** write a `review` block itself. Not even a draft one. The
failure it exists to prevent is a row that looks finished because a script filled in
the fields that make it look finished.

### Directional labels

The premise that "all 51 `inducted_by` need both label and inverseLabel" is true of
the data but already solved in code for 47 of them. `inductionRelationships()`
composes both:

```ts
label:        `inducted ${inductedName}`,
inverseLabel: `was inducted by ${inducterName}`,
```

`isDirectional()` marks `mentored`, `taught`, `succeeded`, `employed`, `nominated`
and `inducted` as needing both, and `connectionProblems()` rejects a directional kind
with no inverse. So this is a real constraint that costs nothing on the crosswalk
route. It costs something only on the worksheet route: the **4** uncovered inductions
need both labels, and of the 5 non-induction mappables, `collaborated-with` and
`family-of` are non-directional and need only `label`.

In my measurement, all 47 crosswalk relationships passed `connectionProblems()` with
zero findings — labels included.

---

## The round trip

Decisions must land as a reviewable git diff. Two routes exist and they suit
different things.

**For the crosswalk: extend `packages/pipeline/scripts/crosswalk.mjs`.** This is the
right home. It already reads the file, carries resolutions forward, refuses to drop
resolved rows, writes with `--check` for CI, and is wired into the `Curator sheets
are current` step in `.github/workflows/pages.yml`. A curator edits
`data/cihof_induction_crosswalk.json` directly and commits; CI fails if the
derived columns drift. No new machinery.

**For bulk decision application: reuse the portal pattern in
`scripts/portal-runner.js`.** It already implements the gates worth having, and they
are stronger than I expected:

- dry run is the **default** (`body.dryRun !== false`), and applying requires an
  explicit opt-out;
- the CSV is hashed (`hashText(csv)`), and an apply is refused unless a *prior
  successful dry-run job* exists whose `meta.csvHash` matches — you cannot apply a
  CSV nobody previewed (`:419–423`);
- **the working tree must be clean**: `readGitStatus()`, and apply is refused with
  "The repo has uncommitted changes. Commit, stash, or discard them before applying
  portal edits." (`:427–430`);
- the decision CSV is written to a timestamped file under the decisions directory, so
  the input that produced a diff is itself committed;
- `scripts/apply-curation-decisions.js` takes `--input=` and `--dry-run`, and backs
  up the target before writing (`:88–90`).

A `relationships:apply` step slots into `buildDecisionApplySummary`'s `targets`
alongside `curate:apply` and `media:apply`. That gets the hash-match, clean-tree and
dry-run gates for free.

**Why not put the crosswalk through the portal too:** the crosswalk is 95 rows
decided once, by one or two people, over a few sittings. A CSV round trip adds a
lossy hop for no benefit when the JSON is already the review surface and CI already
guards it. The portal route earns its complexity on the 37-row triage, where the
decision is repetitive and batch-shaped.

Either way the invariant holds: **every curator decision is a diff somebody can read
in a PR.**

---

## The 37 unmappable relationship types

| `relationshipType` | n | Recommendation |
| --- | --- | --- |
| `documented_mention` | 16 | **Reclassify — not a relationship** |
| `inducted_by_or_induction_connection` | 12 | **Triage individually** |
| `ceremonial_connection` | 4 | **Reclassify as context** |
| `public_service_relationship` | 2 | **Triage** → likely `collaborated-with` |
| `electoral_relationship` | 1 | **Reclassify — not a relationship** |
| `friend` | 1 | **Extend `RelationshipKind`, or drop** |
| `joint_oral_history_participant` | 1 | **Triage** → evidence exists; likely `collaborated-with` |

Three options exist for each, and the right answer differs by type:

**Recommended: reclassify most, extend for none, triage twelve.**

*Reclassify (22 of 37).* `documented_mention` is the clearest case: one person's
profile mentioning another is a fact about a document, not about the two lives. That
is precisely the distinction `connection.ts` exists to defend — "Shared theme and
same class are absent because they are context, not relationship, and putting them
here is how the distinction erodes." `ceremonial_connection` and
`electoral_relationship` are the same shape: co-presence at an event, or appearing on
a ballot together, assert nothing about the people. These become `SharedContext` or
nothing at all. Note `SharedContext` carries no review by design and **never counts
toward the threshold**, so reclassifying is not a way to reach 15 cheaply — it is a
way to stop overstating.

*Triage (14 of 37).* `inducted_by_or_induction_connection` is 12 records whose own
type name is a disjunction — the generator could not tell which relation it had. Each
needs a human looking at the source. Some will become `inducted` and join the
crosswalk route; others will turn out to be context. The 2
`public_service_relationship` and the 1 `joint_oral_history_participant` are probably
`collaborated-with`, but "probably" is the word that this review exists to remove.

*Extend `RelationshipKind` (0 recommended).* The single `friend` record is the only
candidate, and one record is not a reason to widen a deliberately short enum. The
type's own comment says it is "kept deliberately short and concrete". Either the
source supports something more specific, or the record waits until a second instance
justifies the kind. **Do not widen the enum for this batch.**

This triage is **14 individual source judgements**, and it yields at most a handful of
relationships. It is the lowest-value work in this scope and should go last.

---

## Prerequisite: the `evidence.ts` bug

`usableEvidence()` calls `.filter()` on `value.evidence` assuming an array:

```ts
// packages/content/src/evidence.ts:50
return (values ?? []).filter(isUsableEvidence);
```

The archive's records carry `evidence` as a prose **string**. So
`substantiationProblems()` — and through it `connectionProblems()` — throws
`TypeError: (values ?? []).filter is not a function` instead of returning a reason.

I hit this immediately: **all 93 records threw** rather than reporting a problem. A
function whose documented job is "why a claim is not yet publishable, in words a
reviewer can act on" hands a reviewer a stack trace on the first malformed record.

It is fail-closed, so nothing unsafe reaches a visitor. But a reviewer pointed at any
externally-sourced file gets nothing usable. **Fix before the review pass starts**: a
type guard in `usableEvidence`, returning `[]` for a non-array, plus a
`substantiationProblems` finding like `evidence is not a list`. One line and a test.

---

## What this does not do

This is a worksheet and a resolution pass. It is **not** the review-record write path
from `docs/CLEAN_APP_PLAN.md` §3/§6, which calls for a new
`packages/content/decision.ts` that constructs and validates review records
generally, with a migration note, before any portal UI is built.

The relationship between them:

- **This is a stepping stone, not a parallel track.** It produces real review records
  for one claim type by hand, in a sheet. Doing that first surfaces what
  `decision.ts` actually has to model — what a `decisionReference` looks like in
  practice, how `contentVersion` is assigned, how much evidence capture a curator
  will tolerate per claim. CLEAN_APP_PLAN §8 flags exactly this as make-or-break:
  "if approving a relationship is tedious, nothing gets approved and Links never
  returns." Better to learn that on 47 rows in a JSON file than after building a UI.
- It deliberately does **not** generalise. No `decision.ts`, no migration of existing
  approvals, no portal UI. When `decision.ts` is designed, this worksheet's review
  blocks should be re-expressible through it — and if they are not, that is a finding
  about `decision.ts`, not about these 47 relationships.

**It also does not make the lens render.** `apps/exhibit/src/app/App.tsx:21` has a
`links: 'Connections'` label, but there is no `Links.tsx`, and the stage renders
`state.lens === 'years' ? <Years/> : <People/>`. Put `links` in `bundle.lenses` today
and a visitor gets a "Connections" button that shows the People grid. The content gate
and the view are separate pieces of work and **the view must land first, or at the
same time.**

---

## Ordered steps

Reordered so the shortest path to an open lens comes first, and **needs no archive
ingest at all**.

### Phase A — open the lens from what is already committed

| # | Step | Effort | Judgement required |
| --- | --- | --- | --- |
| 1 | Guard `usableEvidence` against a non-array `evidence`; add the `substantiationProblems` finding; test | **~1h** | none |
| 2 | **Curator confirms the 25 unambiguous candidates** the repo's crosswalk already offers (plus a look at the 2 ambiguous ones) | **~2–4h of curator time** | **25–27 decisions** |
| 3 | Write the `publicationDecision` — `decisionReference`, `contentVersion`, `publication: { kiosk: true, publicWeb: false }` | **~1h** + the meeting | **One decision, high stakes** |
| 4 | Build `Links.tsx` and wire it into `App.tsx`'s stage | **~2–3d** | design judgement |
| 5 | **Lens opens at 31.** Verify via `lens-gate.test.ts` and a kiosk build | **~2h** | none |

**Phase A is the whole job for opening Links:** ~3 engineering days, half a day of
curator time, and **26–28 decisions**. No archive, no worksheet, no new data model.

### Phase B — enrichment, none of it blocking

| # | Step | Effort | Judgement required |
| --- | --- | --- | --- |
| 6 | Ingest `cihof_induction_crosswalk.resolved.json` as **candidates** into the 68 rows that have none. Join on `recordedName`. Extend `buildInductionCrosswalk` and `crosswalk:check` | **~0.5d** | none — mechanical join |
| 7 | Curator resolves the remaining ~70 names → **47 relationships** | **~1–2d of curator time** | **~70 decisions** |
| 8 | Relationship worksheet: types in `packages/content`, builder in `packages/pipeline`, refuse-to-drop, `--check`, tests | **~1.5d** | none |
| 9 | Seed the worksheet with the 4 + 5 genuinely-new relationships; curator reviews → **56** | **~0.5d** + **9 decisions** | **9 source judgements** |
| 10 | `relationships:apply` wired into the portal's dry-run / hash-match / clean-tree gates | **~1d** | none |
| 11 | Triage the 37: reclassify 22, judge 14 | **~0.5d** + **14 decisions** | **14 source judgements** |
| 12 | Public-web decision, separately, on its own evidence | — | **deliberate, later** |

**Explicitly not scoped:** ingesting the archival network, organizations, WRHS
collections or the 426-pair review queues *for the purpose of Links*. They contain no
documented person-to-person relationships. They may well be worth ingesting for the
Places lens, story clusters or the WRHS pull list — that is a different piece of work
with a different justification.

---

## Where the real cost is

Engineering here is small and mostly already written. **The cost is curatorial
judgement, and it does not compress** — but the amount needed to *open the lens* is
far smaller than it first appears:

**To open Links (Phase A): ≈27 decisions.**

- **25–27 name confirmations** — each is "who is this person the roster wrote down",
  with a candidate already offered and its `verificationLayer` shown. Fast, but not
  automatic.
- **1 publication decision** — one line, and the one that actually puts claims about
  real people in front of visitors.

**To reach 56 (Phase B): ≈93 more.** ~70 further name resolutions, 9 relationship
reviews, 14 triage judgements.

No transform reduces either number, because the fields they produce —
`decisionReference`, `contentVersion`, `publication` — exist specifically to record
that a person decided. Adopting the archive's 93 machine proposals unreviewed would
reproduce exactly the `reviewedBy: "Claude (automated, curator sign-off pending)"`
stamp the archive itself honestly carries. That is the design working, not an
obstacle to route around.

The honest summary, in order of how much it matters:

1. **The Links lens is already satisfiable.** 31 relationships, zero problems, from
   committed data — blocked on 25 confirmations, one publication decision, and a
   `Links.tsx` that does not exist yet.
2. **The archive does not open it, and neither would ingesting it.** It raises 31 to
   47 and then to 56, which is enrichment above a bar already cleared.
3. **The newly-generated corpus adds no documented relationships at all.** Its ~426
   novel person-to-person pairs are copresence — same page, same archival box — which
   this model calls context, and context never counts toward the threshold. Its own
   highest-confidence subset of 13 is 100% duplicates of material the repo can
   already reach.

---

## Risks

- **The lens opens before a view exists.** Content work and `Links.tsx` are separate,
  and the failure is silent: a "Connections" button rendering the People grid. Land
  step 5 before or with step 6. *Most likely thing to go wrong.*
- **Candidates get bulk-accepted.** 93 proposals with an "accept all" shape is an
  invitation. The crosswalk type already separates `CrosswalkCandidate` from
  `CrosswalkResolution` for this reason; the tooling must not offer a blanket accept.
- **The archive overwrites newer repo files.** `cihof_induction_crosswalk.json` and
  `media-manifest.json` in the archive are older. Ingest file-by-file, never by
  directory copy.
- **`documented_mention` gets mapped rather than reclassified.** 16 records is
  tempting when the threshold is 15. It would be the exact erosion `connection.ts`
  was written to prevent. Phase A's 31 remove the temptation entirely — another
  reason to do it first.
- **Copresence gets ingested to inflate the count.** There are 426 + 286 novel pairs
  sitting in the archive, and they look like connections. Drawing them would put
  ~700 lines on a wall asserting that people who appeared on the same web page knew
  each other. This is the single largest correctness risk in the whole corpus, and
  the only defence is that `ContextBasis` has no basis for them — do not add one to
  make the ingest possible.
- **Evidence capture proves too tedious** (CLEAN_APP_PLAN §8). Watch this during step
  3 and record the friction; it is the main input to designing `decision.ts`.
- **Kiosk approval leaks to public.** Guarded in code and asserted by tests, but the
  worksheet must present the two flags as separate decisions, never one "approve".
