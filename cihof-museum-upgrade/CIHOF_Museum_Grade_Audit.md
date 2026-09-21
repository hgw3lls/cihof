# CIHOF: museum-interactive audit

**Prepared for Tony Yanick · September 19, 2026**  
**Project:** Cleveland International Hall of Fame / proposed WRHS installation  
**Requested site:** https://hgw3lls.github.io/cihof/  
**Audited repository snapshot:** `hgw3lls/cihof` at `f47d1d7ff9080072a7f3a28508a73e83907f61a5`

## Executive assessment

**Keep the existing architectural and visual direction. Upgrade the experience from an attractive archive browser into an interpretive, accessible, dependable exhibit.** The priority is not another framework, more animation, or additional primary scenes. It is a stronger relationship between visitor curiosity, verified historical meaning, and reliable operation.

People / Links / Years is a viable organizing system. Selection persists between scenes, real portraits anchor the collection, and the current implementation separates publicly cleared film assets from material awaiting review. Those are assets worth preserving. The release should not yet be signed off for permanent unattended gallery use on the evidence reviewed: there are concrete session-state defects, content-eligibility problems, an under-explained relationship view, a film-dependent chronology, and gaps in offline and deployment verification. [R1–R6, R8–R10]

### Evidence boundary

This is a **source-backed implementation audit and design assessment**, not a completed live visual or hardware acceptance test. I attempted to open and automate the public site, but the browser environment blocked the origin with `ERR_BLOCKED_BY_ADMINISTRATOR`; a separate fetch also failed. This does **not** establish that the site is unavailable to visitors.

The connected repository was accessible. GitHub reports a successful Pages deployment of the audited commit on September 18, 2026. I inspected the active entry point, the three visitor scenes, model helpers, portions of their styling, QR component, installation configuration, service-worker code and registration, package scripts, deployment workflow, and current visitor tests. I did not execute the project's test suite, measure production performance, capture current rendered screenshots, audit every canonical record, verify every rights document, or inspect the physical installation. No Lighthouse score, contrast pass, ADA certification, or observed visitor-success rate is asserted here. [R0–R12]

The companion `CIHOF_Codex_Upgrade_Plan.md` turns this assessment into bounded implementation tasks. Nothing was committed, changed, or deployed to the repository during this review.

## 1. What to preserve

**A coherent, limited set of entry points.** People, Links, and Years are different ways into the same collection, rather than unrelated mini-apps. The shared selected-person state gives a visitor continuity while moving between them. Do not revive older scene architecture merely because it remains in the repository. The README explicitly identifies the current visitor implementation and marks earlier architecture as historical. [R1–R2]

**An editorial identity rather than a generic software dashboard.** The inspected stylesheet establishes locally hosted Bricolage, Instrument Sans and Newsreader, a paper/ink palette, strong rules, monochrome portrait treatment, and a red accent. This is a credible exhibition-design vocabulary. Preserve its directness; do not replace it with translucent cards, gratuitous gradients, generic rounded tiles, or animated dashboards. This judgment concerns the design encoded in the stylesheet, not a pixel-level review of the deployed rendering. [R7]

**A meaningful starting point for media governance.** Public playback requires approval and caption/transcript metadata, and the deployment workflow uses the public build rather than the restricted local build. This distinction is important and should become more explicit and testable, not be relaxed to make a demo look complete. [R1, R5, R10]

**Existing engineering work.** The entry point already uses an error boundary and service-worker registration. The tests cover scene continuity, QR generation, pending media, simulated approved media, touch swiping, legacy deep links, theme persistence, and layout properties at several viewport sizes. This is not a blank slate. [R6, R9, R11]

## 2. The museum-grade standard for this project

For CIHOF, I would define a successful exhibit as follows: a visitor can begin without instructions from staff; learn why one person matters; understand a documented connection rather than merely see an edge; explore without typing, hearing audio, or owning a phone; and leave the next visitor a clean, working experience.

A useful current local benchmark is CMA's **ArtLens Reimagined**, which opened to the public in July 2026. The transferable lesson is not its equipment or number of interactives. It is the integration of accessible physical design, clear entry points, interpretation, and different ways to engage. CIHOF should borrow that discipline without copying its gesture-based installations or adding AI simply to appear contemporary. [S1]

These are proposed design targets, not measured visitor statistics:

| Visitor depth | Intended result |
|---|---|
| First few seconds | Recognize the exhibit's subject and a clear invitation to act. |
| Around 30 seconds | Discover one person and understand the reason they were honored. |
| Around 90 seconds | Follow one evidenced connection or place the person in an induction class. |
| Longer engagement | Read the full record, inspect sources, view approved media, or take a record away. |

The crucial transition is **person → contribution → Cleveland context → evidence or connection**. A directory can stop at the person. An exhibit should make the next step rewarding.

## 3. Visitor orientation and interpretive hierarchy

The neutral view currently devotes the identity area to collection counts and dates, while the main surface offers portraits or an index. The component does not provide an equivalent of “what am I invited to discover here?” beyond its navigation. Counts establish scale, but they do not establish significance. [R2]

I recommend an unobtrusive introductory statement within the existing layout, not a separate start screen. A draft for curatorial review is: **“Many communities. One city. Meet the people who helped shape Cleveland.”** Pair it with a clear action such as “Choose a portrait” and a small set of non-typing entry points.

Once a person is selected, prioritize their name, one approved sentence about why they were honored, and a clear route to the full record. Keep institution and induction details available, but do not make administrative metadata carry the whole interpretation.

At WRHS, the strongest distinctive layer would be a small, carefully sourced **Cleveland connection** within relevant records: an institution, neighborhood, organization, event, photograph, or archival object that helps situate the life. This is a proposed editorial feature, not a claim that such material is already approved or that WRHS has supplied particular objects. Implement its schema and review workflow before publishing new historical claims.

## 4. People: inclusive discovery and stable navigation

### Image availability must not decide who exists

The active component builds its visitor collection with `inductees.filter(person => person.primaryImageUrl)`. The filtered array then feeds selection lookup, year derivation, and film association. A future approved inductee without an image URL can therefore disappear from multiple parts of the exhibit. I did not establish that any current record is missing an image; the defect is the eligibility rule. [R2]

Build the public collection from explicit publication eligibility instead. Use an honest typographic fallback for absent or failed portraits. Do not manufacture a face. A person's place in the Hall of Fame must not depend on media completeness.

### Selection should not destabilize the grid

Selecting someone currently removes their tile from the matching results. Opening or closing a full record resets the main field's scroll position. Together these choices can disturb the visitor's spatial context; removing the activated button also creates a keyboard-focus issue that requires explicit handling. The existing tests actually assert that a searched selected portrait disappears, so those expectations must change deliberately rather than be preserved unquestioningly. [R2, R11]

Keep the tile in place with an “In focus” treatment, or preserve an equivalent placeholder without changing the grid geometry. On return from a record, restore the previous browsing position and meaningful focus.

### Discovery should not depend on knowing a name

Current search matches names and induction-year strings. It does not search the broader contribution, community, or heritage metadata in the active visitor component. [R2]

Retain search, but add a restrained set of curator-approved browsing controls within People: induction year, contribution area, and community where the data is suitable. A physical keyboard can be useful without becoming necessary. Distinguish cultural heritage, birthplace, nationality, and migration history in the data model; do not infer one from another or infer identity from a person's name.

Preserve a neutral default. Avoid “most viewed” ranking and do not treat the number of surviving records or graph connections as a measure of a person's importance.

## 5. Links: explain the historical relationship

The graph distinguishes archive references from induction-class context, which is a good start. However, a connected node's `context` appears in its accessible label, while the visible node displays its portrait and name. A sighted visitor can see that two people are linked without seeing the reason. The geometry currently communicates more than the text explains. [R3]

Add a visible relation description when a connection is selected, with a source reference and an explicit action to continue to the connected person's record. Preserve a direct, predictable way to re-center; do not turn every tap into a multi-step wizard. A compact relation panel or an equivalent list beside/below the graph can provide both explanation and keyboard access.

Differentiate **documented personal/institutional relationships** from **shared context**, using wording as well as line style. “Honored in the same year” is clearer than “classmates,” which can suggest a relationship beyond an induction cohort. A shared year is useful context, not evidence of friendship or collaboration.

There is also a publication check to resolve. The local model accepts `inducted_by_candidate` and `related_to`, but the function itself does not check review status or supporting evidence. An upstream build stage may already filter these records; I did not complete that end-to-end trace. Do not report this as proven publication of false relationships. Require Codex to trace the canonical-to-public pipeline and add an explicit, tested eligibility rule at the appropriate layers. [R5]

Preserve direction and multiple relationship types. The current helper treats either endpoint as the related person and collapses output into a generic archive category, deduplicating by person. A richer typed model should not accidentally turn “introduced by” into its inverse or lose a second documented relationship. [R5]

## 6. Years: make the collection primary and films secondary

This is the largest mismatch between the navigation promise and the current content strategy.

The README reports **111 inductees and 93 local film records, with all 93 awaiting rights, caption, and transcript review**. The Years scene is explicitly built as a film line. It creates cards from films, while people without film entries contribute only to year-level counts. Pending films open an explanation of the production approval process. [R1, R4]

The publication safeguards are right. The visitor-facing structure is not yet right for this content state.

Recast Years as **induction-class history containing every publication-eligible person**. Approved films become optional additions to person entries. An unapproved or absent film must not leave that person absent or make a main scene feel unfinished. Keep detailed approval status in the staff portal; visitors should still have a complete person record to explore.

Make the time semantics explicit. “Class of 2015” is an induction date, not necessarily when the person's achievement, arrival, or historical contribution occurred. A later life-event timeline would need a separate curated date model, source references, and uncertainty handling. Do not derive historical chronology from induction years.

When films are approved, retain captions and transcripts. Add a real playback error state, promise-rejection handling, accessible controls, and continuity between a film and its person record. The present approved-state test checks that player and caption elements exist; it does not establish that a public video file decodes, plays, seeks, or loads its transcript successfully. [R4, R11]

## 7. Full records, editorial authority, and archival evidence

The record view currently exposes biography, year, heritage/community tags, induction information, and honors. It does not render supporting source citations in that view. This is a presentation finding, not a statement that the repository lacks source data. [R2]

I recommend four clear layers: a short approved contribution statement; the complete biography; relevant Cleveland context; and source/record notes. Keep source detail unobtrusive but reachable. On the kiosk, show useful source information inside the exhibit rather than relying on a browser escape to an external site. The companion website can expose ordinary outbound links.

Remove the runtime editorial repair in `biographyParagraphs`/`RecordView`. The code splits prose into roughly sized groups and prefixes the person's name when a paragraph begins with a lowercase character. Rendering should not guess how to repair an approved biography. Preserve approved paragraph boundaries or use a controlled editorial migration with human review. [R2]

For new interpretive text, store its review status and evidence. Drafting assistance can support curators; it should not silently create visitor-facing claims, identity classifications, or undocumented connections.

## 8. Accessibility: software and physical installation

WCAG 2.2 is a useful software acceptance baseline, but source inspection cannot certify conformance or physical accessibility. Treat the wall unit, keyboard/trackpad, reach, viewing angle, lighting, audio provision, and screen-reader path as one installation. [S2, S5]

### Reach and control size

Navigation is currently in the masthead. That does not by itself prove a reach violation: the answer depends on screen placement and the available alternative input. Nevertheless, the installation should offer reachable essential controls rather than require a visitor to reach the top of a large wall display. A lower control region or tested equivalent keyboard operation should cover all essential actions. [R2, S5]

WCAG's AA target-size criterion uses 24 × 24 CSS pixels with exceptions; that is not a recommended physical museum-button size. Prototype generously sized kiosk controls, then approve their physical size on the installed panel at the actual operating-system scale. Do not equate a 3840-pixel browser screenshot with a 50-inch screen's real-world readability. [S3]

The Access Board's unobstructed reach guidance generally uses a 15–48 inch range, with additional requirements where reach is obstructed. Verify the actual mounting, shelf, clear floor area, and approach rather than declaring the installation compliant from a CSS measurement. [S5]

### Keyboard, focus, and dialogs

The QR wrapper claims a modal dialog and initially focuses its close button, but neither that wrapper nor `QRCodePanel` implements focus containment and background inertness. Closing a record or removing a selected tile also lacks an explicit, complete focus-return strategy in the active code inspected. These are concrete implementation gaps to test and repair. W3C's modal-dialog pattern requires a contained keyboard interaction and a meaningful focus return, not merely `aria-modal="true"`. [R2, R12, S4]

Test every visitor journey with only the physical keyboard, a screen reader, touch, and the alternative graph list. Hover must never be the sole way to reveal essential instructions.

### Time to read and watch

The active idle handler listens to pointer-down, keyboard, and wheel activity, then resets. It has no warning presentation and no active-playback coordination. When enabled, it can reset during passive reading or a film lasting longer than the inactivity interval. The installation configuration contains a warning value, but having a setting is not the same as using it in the active visitor experience. [R2, R4, R13]

Provide a visitor-facing extension or adjustment mechanism. Under WCAG's extension option, the warning gives at least 20 seconds and allows at least ten extensions. A proposed 30-second warning is a reasonable starting design choice, not a universal museum standard. Keep playback protected while it is genuinely progressing, while still recovering from stalled media. [S6]

Do not make a smartphone the only accessible alternative. QR continuation is a convenience; complete participation in the physical exhibit needs an equivalent path supported by the institution.

## 9. Session correctness and calm recovery

`reset()` clears the selected person, history, open record, active film, and scene. It does **not** clear the People query, Links query, or persisted Years scroll position. Consequently the next visitor can inherit a filtered or displaced experience even after a nominal reset. A same-scene reset also needs explicit scroll restoration. [R2]

Create one authoritative reset operation covering all temporary visitor state: queries, filters, selection, history, scene positions, media, overlays, and visitor URL state. Preserve intentional installation settings rather than indiscriminately clearing all storage. The existing persistent theme behavior should change only through an explicit product decision.

Expose a consistent **Start over** control. It should work from search results, records, the graph, Years, and QR states. Keep the person-level back/clear actions distinct from session reset.

Add a round-trip acceptance test: begin with a fresh visitor baseline; use all scenes and controls; reset; compare the resulting state with that baseline. Test this with and without a selected person, with no search results, during media activity, and after repeated resets.

## 10. Offline operation and release reliability

The worker registers in production. Its install handler does not pre-cache a complete exhibit; it calls `skipWaiting`. Documents and data use network-first requests; static assets use cache-first; the cache family has a fixed version string. This is useful opportunistic caching, not evidence of a fully provisioned offline installation. A local package may supply what the browser cache does not, but that deployment must be verified separately. [R8–R9]

Four failure modes need explicit treatment:

1. **Unvisited assets:** content never requested may not be cached when connectivity disappears.
2. **Hanging/error responses:** network-first has no timeout; a non-OK HTTP response is returned rather than automatically falling back to a healthy cached copy.
3. **Mixed/stale versions:** mutable data and cache-first assets can diverge across releases without a coordinated package identity.
4. **Video range requests:** cache-first attempts to cache successful responses, including possible HTTP 206 responses. The Service Worker specification rejects `Cache.put` for 206. Playback failure through that path is a source-supported risk, not a failure I reproduced on the deployed site. [R8, S7]

For the museum, I favor a versioned, locally served exhibition package with verified assets and a last-known-good rollback. Preflight the complete core collection before declaring the device ready. Serve large films from local storage with correct range support rather than assuming the browser should cache every large file. The public companion can use a separately tested offline strategy.

Coordinate release versions for application, data, and assets. Stage an update, validate it, activate only at an appropriate idle/staff-approved point, and retain a recoverable previous release. Revoked media approvals need a removal/update procedure; no browser mechanism can retroactively retract files already copied elsewhere.

The README warns that the default build and kiosk build contain restricted local media. Make that distinction machine-verifiable with unmistakable artifact names and negative public-artifact tests. Never publish a restricted build simply because it runs successfully. [R1, R10]

## 11. Quality gates, performance, and staff operations

The Pages workflow installs dependencies, builds the public site, uploads the artifact, and deploys. It does not run the existing browser suite. A successful deployment therefore verifies the build/deploy path, not visitor behavior. The test labeled for offline publication checks worker registration and exports; it does not browse the collection with the network removed. [R10–R11]

Add release checks for session reset, real approved-media playback using a valid test fixture, rejected media exclusion, relation eligibility, keyboard/focus, failure recovery, and offline browsing. Keep synthetic approval changes confined to test fixtures; do not mark production records approved to make tests pass.

Measure performance before optimizing. Capture actual application/data transfer, portrait decoding cost, scene-switch latency, graph layout cost, and memory behavior over repeated sessions. Do not replace React or add a new graph library without evidence of a problem. The existing graph's bounded collision work is a measurement target, not proof of a bottleneck. [R3]

A proposed gallery acceptance run should include a 72-hour soak, repeated visitor journeys, an extended network outage, browser/process restart, power restoration, corrupted-update recovery, and successful rollback. These are proposed project gates, not an existing test result or an industry certification.

Inspect the existing diagnostics, logs, and staff tools before adding replacements. Staff need a clear ready/not-ready screen, installed version, last successful validation, asset counts, restricted/public build identity, and recovery instructions. A process watchdog and OS kiosk restrictions address failures beyond a React error boundary.

Security remains a follow-up verification area. Hidden gestures and a client-side prompt should not be treated as the security boundary for privileged operations. Keep visitor assets read-only, isolate staff publishing and credentials, and audit imports and local services before gallery deployment. This review did not establish a remotely exploitable vulnerability.

## 12. Recommended priorities and sign-off

**First: correct the visitor contract.** Include all publication-eligible inductees regardless of media completeness; fix reset and focus continuity; make Years complete without films; make Links visibly explainable; remove rendering-time biography repair.

**Second: prove reliability and access.** Add accessible timing/dialog behavior, physical-reach validation, approved-media and offline tests, coordinated release packaging, and deployment gates.

**Third: enrich the exhibit.** Add carefully curated Cleveland context, useful contribution/community browsing, approved archival objects, and more nuanced interpretations within the existing three scenes.

Do not make a chatbot, a larger force-directed graph, automated biographical generation, a decorative globe, gamification, or a framework rewrite the next major investment. The distinctive result should be **a city understood through people, relationships, and evidence**, not a larger collection of interface effects.

Final sign-off should be shared: engineering verifies behavior and recovery; curators approve claims and permissions; accessibility participants and specialists verify actual use; museum staff verify operation and handoff. That combination would justify the museum-grade claim more convincingly than an untested redesign.

---

## Source register

Repository links are pinned to the audited commit. They may require access to the private repository. Findings derived from code are not claims that every conditional failure occurred in production.

[R0] Deployment run: https://github.com/hgw3lls/cihof/actions/runs/35403346114  
[R1] README: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/README.md  
[R2] Active visitor shell: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/features/archive-exhibit/ArchiveExhibit.tsx  
[R3] Links: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/features/archive-exhibit/LinksScene.tsx  
[R4] Years/media: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/features/archive-exhibit/YearsScene.tsx  
[R5] Model/eligibility: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/features/archive-exhibit/archiveModel.ts  
[R6] Entry point: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/app/main.tsx  
[R7] Visitor CSS, inspected portions: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/features/archive-exhibit/archive-exhibit.css  
[R8] Service worker: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/public/sw.js  
[R9] Worker registration: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/app/serviceWorkerRegistration.ts  
[R10] Deployment workflow: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/.github/workflows/pages.yml  
[R11] Visitor tests: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/tests/index-experience.spec.ts  
[R12] QR component: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/components/QRCodePanel.tsx  
[R13] Installation configuration: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/src/config/installationConfig.ts  
[R14] Build/test commands: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/package.json  
[R15] Browser test configuration: https://github.com/hgw3lls/cihof/blob/f47d1d7ff9080072a7f3a28508a73e83907f61a5/playwright.config.ts

[S1] CMA, ArtLens Reimagined: https://www.clevelandart.org/exhibitions/artlens-reimagined-intersection-art-technology-and-innovation  
[S2] W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/  
[S3] W3C, Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html  
[S4] W3C, Modal Dialog Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/  
[S5] US Access Board, Operable Parts: https://www.access-board.gov/ada/guides/chapter-3-operable-parts/  
[S6] W3C, Timing Adjustable: https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html  
[S7] W3C, Service Workers, Cache.put algorithm: https://w3c.github.io/ServiceWorker/#cache-put
