# CIHOF current-state audit
## A usable exhibit foundation, with the city-story layer still to build

**Baseline:** `d97afd32b967a5b6e62ad6075b133979e8468b0a`, September 20, 2026.  
**Scope:** current active source plus the corresponding successful public deployment artifact.  
**Not completed:** live walkthrough, rendered visual inspection, browser test execution, performance profiling, assistive-technology testing, or physical touchscreen evaluation.

Source IDs below refer to [SOURCES.md](SOURCES.md). The measured artifact inventory is [E01](evidence/deployment_inventory.json). Recommendations are not reported as existing capabilities.

## Executive finding

The current site is no longer a bare directory. It has a persistent person-selection model, an articulated constellation interaction, a complete induction chronology, discovery controls, progressively deeper records, source-aware gates, and several meaningful accessibility/session fixes. Those should survive the upgrade. [R02–R06, R11]

But the experience is still organized mainly around **who was inducted, who shares an induction year, and reading an individual record**. It does not yet make **communities, Cleveland places, specific contributions, and historical activity** function as a coordinated exploratory system. The biggest improvement will come from joining those dimensions through sourced records—not replacing the design with another shell.

## What is actually shipped

| Item | Current deployment finding | Interpretation |
|---|---|---|
| Collection | 111 valid person records; 16 induction classes | Preserve complete inclusion. Do not require a portrait, video, or enriched story to remain discoverable. |
| Explicit relationships | 0 in both split JSON and runtime bundle | Links currently derives same-induction-year context, not a populated civic-relationship network. |
| Generated graph | 297 entities; 856 edges | Theme/community membership, portraits, and induction context. Not 856 documented collaborations. |
| Place groundwork | 14 separate starter place records | Valuable seeds, but no Place or Organization entities in the shipped entity graph and no active geographic scene. |
| Story groundwork | 3 story records, 15 beats | 0 beats pass the current approved Cleveland-context display gate. |
| Archive leads | 11, with 0 passing the public display gate | Staff research leads, not 11 cleared archival exhibits. |
| Images | 111 primary plus 999 gallery image references; all 1,110 local paths exist | Existing assets could support a gallery/evidence experience after appropriate use/caption checks. |
| Films | 0 video records in the shipped public media manifest | The text-and-portrait release should stand on its own. Do not design an experience that requires unreleased films. |
| Runtime bundle | Approximately 3.2 MB, before any transfer compression | Measure startup; this is a file-size observation, not a finding of slow performance. |
| Whole artifact | 113,841,622 bytes | Asset delivery, not just application JavaScript, deserves a manifest and provisioning strategy. |

Evidence: E01; relationship behavior R03/R09. Image metadata records rights approval and kiosk approval, but has no per-image `approvedForPublicWeb` field. This audit does not retroactively grant rights or change their interpretation.

## Existing work to preserve

The MG tracker records MG-00 through MG-04 complete, MG-05 and MG-06 ready for review, and MG-07/MG-08 not started. It reports a 61/61 visitor regression run following recent fixes; that result is inherited evidence, not independently reproduced here. Physical installation, assistive technology, curator review, mobile continuation, and the pinned Node runtime remain explicit open items. [R11]

Keep the active `ArchiveExhibit` entry and separate staff portal. Preserve missing-portrait fallbacks, all-person chronology, accessible list alternatives, relationship-source explanations, media gating, selection return, the authoritative session reset, and the current public-build filtering. [R01–R06, R16]

## Findings and required changes

### A01 — The network has mechanics but no explicit relationship content

**Observed:** `relationships.json` is empty. `archiveLinks()` supplements published records with same-class peers. The interface already distinguishes these with labels and a legend. [R03, R05, R09]

**Consequence:** the visual promise of a Cleveland constellation exceeds the historical relationship content currently supplied to it. This is not a reason to remove the truthful class context or manufacture stronger ties.

**Change:** add an editorial path for evidence-backed relations and display typed connections to places, organizations, events, and contributions. Keep “honored in the same year” as a separate optional context. Never describe shared tags as proof that two people knew one another. CE-01, CE-04, CE-06.

### A02 — Cleveland is named, but it is not yet a geographic interaction

**Observed:** `places` and related legacy URL aliases resolve to Links. Fourteen place records exist separately, with schematic marker coordinates. Non-person targets are skipped in the current relationship projection. [R02–R03, E01]

**Change:** implement a Places lens in the existing exhibit shell. Reuse and review the place seeds, reconcile their IDs with the existing entity model, and add sourced person–place associations. Distinguish lives, work, organizing, study, and service. Do not convert a seed marker's x/y into latitude/longitude. CE-01, CE-05.

### A03 — The ethnicity interface does not match the richness of the stored vocabulary

**Observed:** the active Community control reads `communityTags`. The vocabulary includes broad “European Heritage,” specific community labels, and organizations such as City Club and Jones Day. More specific heritage-like terms already exist in `countryTags`, but that field also includes labels that are not countries. Heritage appears deeper in records and search, not as a dedicated organizing interaction. [R02, R04, R07, R10]

**Change:** separate heritage/ethnic or cultural community, nationality where explicitly recorded, organizational affiliation, and place. Preserve original wording and sources. Add approved crosswalks, not guessed reclassification. Make specific community histories visible without fixing each person to one category. CE-01, CE-03.

### A04 — Discovery state is not shared by all views

**Observed:** contribution, community, year, and search filters affect People. Links and Years receive the full people array. Individual scenes are conditionally rendered; portraits are not a single persistent regrouping field. [R02]

**Change:** create one query/selection/navigation controller with explicit rules for global filters, scene-specific controls, and out-of-filter selections. Add stable keyed grouping and meaningful transitions, not independent grids that appear to forget the visitor's question. CE-02, CE-03.

### A05 — Years accurately shows induction, not historical activity

**Observed:** Years groups records by `classYear`, includes all people, provides year jumps and optional films, and handles an unknown-class case. [R06]

**Change:** keep this useful induction chronology. Add a separately labeled historical activity mode driven by sourced dates or intervals. Never repurpose induction year, generation labels, or prose guesses as activity dates. Undated contributions stay discoverable. CE-07.

### A06 — A contribution summary is not yet an explorable contribution

**Observed:** selected-person and full-record views show the published contribution and biography. The approved Cleveland-context gate is implemented, but no shipped starter beat passes it. [R02, R04, E01]

**Change:** reuse StorySectionRecord/StoryBeat to build “What changed?” sequences with event/entity references, dates, and source evidence. Offer the full source record underneath. Do not imply causation or continuing legacy merely because an institution is mentioned. CE-01, CE-04.

### A07 — Comparing two lives is not an active interaction

**Observed:** active selection supports one person; the examined active component tree does not provide a comparison panel. [R02–R06]

**Change:** add two-person comparison as an overlay/workspace within the same shell. Explain shared place, period, theme, or documented relationship without scores, winners, or importance rankings. Provide Add to comparison buttons; drag can be optional. CE-06.

### A08 — The gallery collection is available but underused by the active exhibit

**Observed:** the deployment contains 999 gallery references with local files. The active record currently emphasizes portrait, text, and approved archive metadata, not a gallery browser. [R02, E01]

**Change:** expose an explicitly approved per-person selection with good captions, credits, zoom and tap controls. A gallery photograph is not automatically proof for a newly authored historical claim. Avoid loading all images at startup. CE-04.

### A09 — Approval semantics require reconciliation before expansion

**Observed:** all 111 shipped person records have `approvalStatus: draft`, while most descriptive source fields are `curated`. Collection eligibility intentionally checks only valid identity/name. Relationship publication checks provenance and references, not an independent review decision. [R03–R04, R07–R08, E01]

**Risk:** a well-intentioned “approved records only” patch could hide the entire existing collection. The opposite mistake would equate every generated “curated” field with new authorization.

**Change:** document the meanings of existing fields, preserve baseline eligibility, and introduce explicit item/field-level review plus publication target decisions for new interpretive content. Obtain authorized migration decisions; never bulk-approve or bulk-unpublish through an inferred rule. CE-00, CE-01.

### A10 — Public serialization already works in important areas, but needs a fuller contract

**Observed:** Vite filters films, candidate entities, and provisional edges; the artifact confirms those removals. Starter stories and archive leads remain in the public runtime bundle even when hidden by display gates. The source-curation summary remains, but its full record packet does not. [R16, E01]

**Change:** extend the existing visitor serializer into a tested allowlist for each public content type. Distinguish approved visitor content from staff-only draft metadata at build time as well as display time. Include legitimate public archival metadata only where an editorial publication policy allows it. This is a publication-boundary issue, not proof of a personal-data breach. CE-01, CE-10, CE-11.

### A11 — Offline behavior is opportunistic rather than a verified installation package

**Observed:** the worker uses a fixed `v2` cache version, immediate activation, network-first documents/data, and cache-first assets as they are requested. Installation does not provision a versioned collection manifest. [R17]

**Risk to test:** incomplete first-use coverage, inconsistent release pieces, stale mutable assets, failed offline deep links, storage failures, and future media range requests. These are source-grounded risks, not failures reproduced in a browser here.

**Change:** implement versioned manifests, staged provisioning, safe activation, canonical document fallback, storage/error handling, and target-specific offline tests. Preserve a working release until its replacement is complete. CE-10; fulfill MG-07.

### A12 — Deployment currently proves build success, not exhibit readiness

**Observed:** Pages installs dependencies, builds the public target, uploads, and deploys. It does not explicitly run visitor tests or content/artifact gates. The existing Playwright suite builds a test-configured preview with shortened session timings. [R13–R15]

**Change:** keep fixture tests separate from smoke checks of the exact production artifact. Add publication, compatibility, performance-budget and asset-integrity checks before deployment; tie reports to SHA/artifact hash. A green build is not curator or physical-accessibility approval. CE-11; fulfill MG-08.

### A13 — Reading and evidence need presentation work, not rewritten facts

**Observed:** biography paragraph conversion currently returns the original text as one paragraph. Approved contexts and archival sources can open external links. [R02, R04]

**Change:** support reviewed paragraph segmentation preserving source text, concise authored story layers, and an in-app evidence panel. In kiosk mode, do not make an external browser tab the only way to read evidence. Maintain source identity and optional phone continuation. CE-04, CE-08.

### A14 — Visual and access work needs evidence, not a claimed certification

**Observed:** existing code includes target sizing work, alternate controls, reduced-motion handling and focus restoration. The MG tracker explicitly leaves physical reach, screen readers and real-device continuation open. [R02, R05–R06, R11]

**Change:** retain those fixes and test every new journey at target CSS sizes/scaling and real hardware. Use the main DOM/list interface for independent access; a phone is an optional continuation, not the accessibility fallback. Network layout work should be bounded and profiled before increasing node counts. CE-03, CE-09.

## Priority decision

**First:** preserve the current release, resolve the publication/identity model, and build coordinated state plus a small richly documented prototype.

**Next:** deliver the portrait regrouping, sourced contribution story, and Places lens. These create the central “different lives, shared city” experience.

**Then:** comparison, historical activity, archive/media refinements, and deeper guided paths. Complete offline and deployment gates before installation release; those should not be left as visual-polish tasks.

Do not make the first milestone a new logo, 3D globe, chatbot, arbitrary force graph, full-screen video attract loop, or a framework rewrite. None resolves the main gaps found here.
