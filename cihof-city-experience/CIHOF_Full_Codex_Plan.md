# CIHOF full Codex implementation plan
## One collection. Multiple ways to understand a shared city.

**Audited baseline:** `d97afd32b967a5b6e62ad6075b133979e8468b0a`.  
**Status:** proposed implementation plan; no changes applied.  
Read [the audit](CIHOF_Current_State_Audit.md), [sources](SOURCES.md), and [root-guidance addendum](AGENTS_ADDENDUM.md) before execution.

## 1. Product objective

Transform the existing TV/touchscreen application from a person-and-induction archive into a coordinated encounter with Cleveland's people, communities, places, and specific civic contributions.

A visitor should be able to begin without knowing an inductee's name. A recognizable neighborhood, community, institution, contribution, or period should lead to a person, an explained action, evidence, and an intelligible connection to another story.

The signature effect is **the same collection reorganizing to reveal a new relationship**. Motion, image scale, and typography should explain that change. They must not obscure reading, move touch targets unpredictably, or imply stronger historical claims than the data supports.

### The first complete visitor journey

Open the collection → choose a community or contribution → see the same people reorganize → select a person → explore a documented Cleveland place → open “What changed?” → inspect a source → compare or follow a clearly explained connection → return to the original view with the question and position preserved.

A shorter journey must also succeed: find a name, understand one specific contribution, read the full record, or take a mobile continuation. No visitor should have to complete a tour.

## 2. Architecture decision: evolve the active exhibit

Keep React, TypeScript, Vite, the current runtime loaders, canonical data preparation, QR support, public/kiosk build split, and separate staff portal. Do not introduce a server, graph database, live AI API, WebGL engine, or new router simply to implement these interactions. Add a dependency only after a documented need and review of the installed versions.

The active root remains `src/features/archive-exhibit/ArchiveExhibit.tsx`. Do not implement in `src/app/App.tsx`, `src/features/living-hall/`, or other rollback interfaces. The root should gradually become a controller/composition layer rather than absorb every new interaction.

Use the existing `EntityRecord`, `EntityRelationshipRecord`, `RelationshipRecord`, `StoryBeat`, `StorySectionRecord`, and `ArchiveLead` structures. Extend them additively with reviewed, typed attributes and references. Do not create a competing person database. See [DATA_CONTRACTS.md](DATA_CONTRACTS.md).

### Proposed module boundaries

These are proposed paths, not a claim that they already exist. Inspect the repository for reusable equivalents before creating files.

| Concern | Existing home / proposed addition |
|---|---|
| Shell and selection integration | Existing `ArchiveExhibit.tsx`; proposed `state/exhibitState.ts` and `state/useExhibitController.ts` under its feature directory. |
| Coordinated discovery | Proposed `DiscoveryBar.tsx`, `selectors/discovery.ts`, `CollectionStage.tsx`, and extracted `PeopleScene.tsx`. |
| Meaningful regrouping | Proposed `layouts/portraitLayouts.ts` and `useLayoutTransition.ts`; keep semantic DOM controls. |
| Person interpretation | Extract `RecordView`; proposed `record/PersonStory.tsx`, `record/EvidencePanel.tsx`, `record/PersonGallery.tsx`. |
| Places | Proposed `PlacesScene.tsx` and `selectors/places.ts`; one adapter into the existing runtime bundle. |
| Connections and comparison | Existing `LinksScene.tsx`, `archiveModel.ts`, `linkLayout.js`; proposed `ComparePanel.tsx` and `selectors/comparison.ts`. |
| Time | Keep `YearsScene.tsx`; proposed `HistoryScene.tsx` for documented activity, with a clear Inductions / Activity switch. |
| Publication | Extend existing `vite.config.ts` visitor-data filtering and `src/data/relationshipPublication.ts`; extract shared pure publication utilities as justified. |
| Offline release | Existing `public/sw.js`, build info, offline validation; proposed generated versioned release manifest and a provisioning status service. |
| Authoring | Existing portal/review dashboard; add fields and validation there, not to visitor admin. |

Do not perform unrelated renaming or stylesheet rewrites alongside content migration. Land behavior changes in reviewable stages.

## 3. Target visitor interface

Keep a single exhibit shell, not four independent mini-applications. It has a stable selected-person area, a main collection stage, contextual detail/evidence, and a reachable discovery/navigation strip.

The proposed visible lenses are **People, Places, Connections, Time**. “Connections” and “Time” may retain the existing internal `links` and `years` route values. Existing deep links continue to resolve. An old `scene=years` link opens induction chronology; historical activity needs an explicit mode. Add a real `places` scene intentionally and document its changed legacy alias behavior.

Within People, offer **All people / By community / By contribution** as grouping choices. These are organizational views of the collection, not new apps. A searchable list remains available in all applicable lenses.

The persistent controls are Back, clear/remove current filters, Start over, accessibility options, and an obvious route to the full record. Detail, comparison, gallery and evidence occupy the same reserved detail system; do not accumulate unrelated full-screen modals.

On the installed display, interaction controls should be tested in a reachable area. Do not assume moving everything to the bottom certifies access or that screen pixels describe the physical installation. The mobile companion can use a conventional stacked layout.

## 4. Coordinated interaction specification

### Portrait regrouping

Choose a grouping and watch the current collection reorganize into labeled, understandable groups. Keep the selected person trackable through the change. Use deterministic positions and stable IDs; reuse existing portraits and fallback states.

An approved multi-affiliation person can belong to multiple groups. In overview, use one primary visual anchor plus visible cross-membership cues, or explicitly labeled repeated memberships. The unique-person total must not silently become a membership total. Never arbitrarily assign a single “true” ethnicity to simplify layout.

Animate deliberate layout changes only. Target approximately 250–450 ms as an initial design hypothesis, not a measured current performance result. Reduced motion should produce an immediate or gentle opacity-only change with identical information. After the transition, everything stops moving.

### Places as an unfolding story

At city scale, show reviewed neighborhood/place groupings with a concise list alternative. At place scale, show a few associated people, a relevant image, and the role/dates of each association. From a person, “Their Cleveland” shows reviewed places connected to that life.

Distinguish residence, work, study, organizing, service, and institutional association. Scope can extend to Greater Cleveland where the evidence requires it; do not force all biographies or places into present-day city boundaries.

Use local geometry/assets with documented provenance. The 14 current seed records are research starting points. Their x/y marker values are schematic. A schematic presentation must say so; a geographic presentation requires reviewed coordinates and boundary data. Historic names and boundaries require their own dates/notes.

### “What changed?” and story depth

The initial encounter shows a portrait, a specific approved contribution statement, and optional approved community/place context. A short authored sequence can reveal an action, an institution or initiative, and an evidenced consequence or continuing legacy. Omit unavailable steps.

Each step opens its evidence, not merely a generic source homepage. Preserve the complete source biography as a deeper layer. Separate literal quotations, source text, authored interpretation, and catalogue metadata. No generated speeches, synthetic voice clones, invented quotes, or automatic causal claims.

Use reviewed gallery images now rather than waiting for the 93 pending video holdings mentioned in existing records. New public media must meet its actual target clearance, caption/transcript, credit and file requirements. Keep withheld material out of public payloads and visitor controls.

### Connections and comparison

Retain current preview/recenter behavior and connection-list alternative. Add mixed entity targets only when their relationships are sourced and publication-eligible. Limit the initial neighborhood of the graph; a proposed starting bound is 8–12 visible targets with a clear route to the full list. Choose transparent editorial or deterministic ordering, not hidden importance scores.

Distinguish direct documented relationships, shared documented contexts, curator-authored comparisons, and shared induction context. Two people can share a place or theme without evidence they met. The explanation must preserve that distinction.

Comparison selects up to two people using buttons. The central area shows a shared place, concern, period, or actual relationship, with each side's evidence. “No direct relationship is documented in this collection” is an acceptable outcome. This is interpretation, not competition: no scores, winners, or community rankings.

### Historical activity

Retain induction browsing intact. Add Activity as a separate mode with sourced events and uncertain intervals. Show known date precision; do not spread a person's lifetime across a period as a substitute for evidence of activity.

Changing the date range preserves selected community, contribution and place where applicable. Unknown dates remain available in an “Undated in this collection” group and count; they are not assigned to the present or excluded from the overall collection.

### Visitor invitation, media and continuation

A modest attract state can demonstrate one actual relationship or grouping, then stop at first input. Once a visitor is active, no autoplay, self-advancing story, unsolicited audio, or rearrangement steals their place. Reset returns to a clean collection/attract state and clears comparison, filters, media, focus history, URL state and device handoff state.

Offer curated question trails as a later layer over approved records, not a chatbot. For example, a trail can ask what a community built or how a place connects different generations, but it may only include eligible content with authored connecting text.

Continue the person's complete public record on mobile. First verify the existing QR destination. A same-site companion is preferable to a broken external page, but introducing that destination needs explicit content/ownership approval. It must not expose kiosk-only media or send a private localhost URL to a phone.

## 5. State and navigation rules

Create one typed reducer/controller containing lens, grouping, global query/facets, selected person, comparison pair, place selection, time mode/range, open detail, and per-lens viewport/focus restoration.

Global filters intersect across distinct dimensions; multiple selections within a dimension use a clearly documented union. Search and filter chips show exactly what is active. A selected person outside the current filtered result remains in the focus area with an “Outside current selection” explanation; do not silently change their identity.

Not every record has places or activity dates. Lens counters distinguish matching people from people with mapped/dated content. Provide a route to the unmapped or undated matches. A Places count must not imply that people without a mapped location are absent from that community.

Back restores a meaningful prior interaction snapshot, including lens/query/detail/viewport. It is not only the previous person ID. Start over clears visitor state but retains approved installation settings. Reset and session timeout have one owner; new components must not maintain independent hidden sessions.

For a person deep link, validate the canonical ID and display a recoverable unavailable state for unknown records. Serialize only stable identifiers and meaningful visitor state, with an explicit URL version. Never serialize staff notes, media permissions, local filesystem paths, or long biographies.

## 6. Content and publication design

Preserve all 111 currently eligible identities during migration. The existing `approvalStatus: draft` field is not a safe switch for blanket hiding. New claims and newly interpreted associations need explicit review decisions and evidence. Do not bulk-promote starter stories, place links, tags or archive leads.

Normalize typed vocabulary with a reviewed crosswalk. A category must distinguish what is being asserted: heritage/ethnic-cultural community, nationality, language, organizational affiliation, place, or an unresolved historical label. No name-, portrait-, surname-, geolocation-, or country-based identity inference. More than one identity or affiliation can coexist.

Centralize publication selectors so UI, serializer, export and staff preview use the same rules. Existing candidate and video filters remain. Public bundles should contain approved visitor records, not every draft that happens to be hidden by a component. The public source-curation summary can remain if intentionally authorized; remove unnecessary staff detail by contract rather than broad ad hoc text scanning.

Treat rights clearance, factual review, and publication target as separate decisions. Existing image approvals must be interpreted according to recorded scope, not automatically extended to a new distribution channel. The content release process must be deterministic and produce a reviewable diff and coverage report.

## 7. Delivery plan and dependencies

| Stage | Deliverable | Depends on | Main acceptance outcome |
|---|---|---|---|
| CE-00 | Refreshed baseline and deliberate adoption | None | HEAD drift, MG status, existing failures and new scope recorded; no unsupported pass claims. |
| CE-01 | Typed content/publication contracts and adapters | CE-00 | Existing collection preserved; new drafts cannot publish; vocabulary/date/place semantics explicit. |
| CE-02 | Shared exhibit state and navigation | CE-01 | Filters, Back, selection, deep links, reset and viewport return work coherently. |
| CE-03 | Collection regrouping and discovery stage | CE-02 | Same collection visibly reorganizes; identity counts, focus and tap access remain correct. |
| CE-04 | Contribution stories, evidence and approved gallery | CE-01–03 | Person → action/context → evidence is usable; missing content remains honest. |
| CE-05 | Cleveland Places lens | CE-01–04 | Place → person and person → places work with sourced association types and list equivalence. |
| CE-06 | Mixed-entity connections and two-person comparison | CE-01–05 | Relationship kinds and evidence are clear; no inferred acquaintance or rankings. |
| CE-07 | Historical activity alongside induction | CE-01–06 | Time semantics are explicit; uncertain and undated records remain discoverable. |
| CE-08 | Attract/invitation, curated trails and continuation | CE-02–07 | A walk-up journey works without prior name knowledge; device handoff is valid or honestly unavailable. |
| CE-09 | Access, reach-mode and performance review | CE-03–08 | New journeys meet documented software gates; physical and assistive-technology sign-offs stay distinct. |
| CE-10 | Offline provisioning, safe update and recovery | CE-01–09 | Exact content package can be provisioned, restarted offline and recovered without mixing releases. |
| CE-11 | Release CI, editorial handoff and sign-off | CE-00–10 | Tested public artifact, clear local/portal boundaries, documented approvals and rollback. |

The numbered prompts contain file targets and exact stage expectations. Their dependencies are intentionally conservative for sequential execution. Content review can run alongside implementation, but no stage's coding completion authorizes publication. CE-10 supplies MG-07 evidence; CE-11 supplies MG-08 evidence. MG-05/06 remain review items until their own outstanding evidence is resolved.

## 8. First prototype scope

Use approximately 12 richly documented people as a **prototype coverage target**, not a privileged permanent subset. Authorized reviewers should choose records that exercise multiple communities, contributions, periods, places, long names, missing media, multiple affiliations and sparse context. Keep all 111 searchable and readable throughout.

The first complete demonstrator ends at CE-05: grouping → person → contribution → evidence → place → another eligible person. Comparison and historical time extend it next.

Production readiness does not require every inductee to have the same amount of media, every community to have the same number of people, or every story to have a direct interpersonal link. It does require honest coverage labels and complete baseline access.

## 9. Software quality and acceptance

Use the [test matrix](ACCEPTANCE_TESTS.md). Initial project targets: major controls 56–64 CSS pixels with at least 48-pixel default touch targets; body text designed around a 1920×1080 effective CSS viewport, then checked at real scaling and physical viewing distance. These are proposed exhibit requirements, not a WCAG or installation certificate. W3C's AA minimum and drag-alternative requirements are explained separately in SOURCES W01–W03.

Proposed performance targets for the agreed kiosk device: visible input acknowledgement within 100 ms under steady-state conditions; common transitions settled within 500 ms; no unbounded force simulation while reading; no startup decoding of all gallery images; memory returns near the warmed baseline after repeated session resets. Record the device, browser, OS scaling, dataset and measurement method. Targets that cannot be achieved must be revised explicitly, not reported as passed without a measurement.

Accessibility tests cover keyboard and tap-only operation separately, semantic DOM/list equivalence, focus return, dialogue dismissal, text enlargement, reduced motion, no color-only relationship meaning, caption/transcript behavior, readable errors, and timing extension. Real-device and independent blind-visitor journeys remain a separate installation requirement.

## 10. Offline and release design

The existing service worker is not a substitute for provisioning. Generate a build/content-versioned release manifest covering shell, required data, portraits, and any required media. Decide which optional gallery/media packs are provisioned; do not promise every unprovisioned optional asset offline.

Cache or stage a new release completely before activation. Activate at a safe reset/restart, retain the last known-good package, and ensure shell/data/assets refer to the same content version. Provide canonical navigation fallback under `/cihof/`, including person/lens query strings. Cache-write failure must not turn a successful network response into an unexplained blank display.

For a local installation, ship a complete package with an approved local server/launcher rather than relying on `file://` or a visitor's earlier browsing. The public site still requires an initial successful load/provisioning; never claim first-ever networkless access.

Future video caching needs an explicit range-request strategy and integrity checks. Unapproved films stay absent regardless of network availability. Staff diagnostics should expose version, provisioning completeness, missing required assets, and recoverable errors without revealing unnecessary visitor data.

Keep fixture browser tests separate from exact-artifact smoke tests. The current `test:kiosk` config rebuilds with accelerated timers; a new production-artifact suite must not rebuild or mutate the artifact it certifies. Upload only the public output after its gates pass. Default/kiosk artifacts are not GitHub Pages artifacts.

## 11. Definition of done

A stage is complete when code, automated checks, data contracts, screenshots where available, and a completion record support its acceptance conditions. “Ready for review” is the correct state for unresolved editorial or installation decisions. Do not erase limitations to make the tracker green.

The installation is ready only when an authorized reviewer has checked real content, the exact public/local artifacts are target-correct, the intended hardware/access path has been tested, offline recovery is demonstrated, and staff know how to update and roll back. A successful build, generated screenshot, or inherited test report is not sufficient alone.

## 12. Deliberate exclusions

No framework rewrite, automatic identity classification, invented relationships, chatbot-centered experience, synthetic historical testimony, celebrity/ethnicity ranking, popularity-sized portraits, visitor tracking by community interest, uncontrolled external browsing on the kiosk, or mandatory phone-based access. Keep privacy-preserving operational diagnostics; any future analytics or visitor submissions require a separate consent, retention and moderation design.
