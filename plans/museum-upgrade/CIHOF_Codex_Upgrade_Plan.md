# CIHOF: Codex upgrade plan

**Prepared September 19, 2026 · for the existing `hgw3lls/cihof` repository**  
**Reference snapshot:** `f47d1d7ff9080072a7f3a28508a73e83907f61a5`  
**Companion:** `CIHOF_Museum_Grade_Audit.md`

## 0. How to use this plan

Attach this file and the audit to a Codex session operating on `hgw3lls/cihof`. Start with the bootstrap prompt below. Execute one bounded task at a time on a feature branch or isolated worktree. Review each diff and its evidence before moving to the next task. This document is a plan, not a report of completed implementation.

The audit inspected source associated with a successful September 18 deployment, but could not render or interact with the public site because the browsing environment blocked its origin. Codex must establish a fresh runtime baseline in its own environment. Compare the current HEAD with the reference snapshot; do not revert newer work to make this document match.

The desired result is an **interpretive, accessible, offline-capable museum exhibit**, not a new generic website. Keep the current People / Links / Years architecture and its selected-person continuity. Strengthen each scene's meaning and reliability.

### Definition of done

A task is done only when its intended behavior is implemented, relevant checks have actually run, results are recorded, regressions are reviewed, and any external/curatorial/hardware dependencies are explicitly marked unresolved. An unavailable tool or asset is a blocker to that check, not a passing result. Existing failures must be reported separately from introduced failures. Do not weaken an assertion merely to make a test pass.

## 1. Non-negotiable constraints

- Work in the **active** visitor implementation: `src/app/main.tsx` imports `src/features/archive-exhibit/ArchiveExhibit.tsx`. The older `src/app/App.tsx` and Living Hall implementation are retained for rollback, not the starting point for this upgrade.
- Preserve React/Vite/TypeScript and existing data/build workflows unless a measured problem justifies a narrowly scoped change. No framework migration, wholesale rewrite, or new state-management dependency by default.
- Preserve the current editorial visual vocabulary: strong typography, paper/ink surfaces, structural rules, real portraiture, and restrained accent color. No unsolicited logo redesign, glassmorphism, decorative globe, animated data dashboard, or generic card-template replacement.
- Every publication-eligible honoree remains discoverable without a portrait or film. Media incompleteness is not a publication-eligibility rule.
- Preserve canonical person IDs, compatible deep links, source provenance, existing approved text, and staff workflows. Treat generated outputs as generated; update canonical sources or generator logic instead of patching generated files alone.
- Never invent biographies, ethnicity/nationality, immigration routes, historical dates, sources, relationships, archival objects, portraits, or quotations. Never mark rights, captions, transcripts, or relationship claims approved without an authorized editorial decision.
- Keep public, local kiosk, and staff-review packages distinct. The audited README warns that the default build and restricted kiosk output may contain pending film payloads. Never deploy those artifacts as the public site.
- Discovery cannot require typing, hearing audio, owning a phone, or precise dragging. QR continuation is optional. Do not claim physical accessibility from browser tests alone.
- Keep visitor data collection minimal. Do not add cameras, face detection, personal identifiers, raw search logging, or cloud analytics as part of this upgrade.
- Do not push, merge, publish, change permissions, or deploy to production without an explicit instruction for that operation.

## 2. Current implementation map

These paths were verified at the reference commit. Inspect the current branch before editing; proposed new modules later in this plan are suggestions, not existing files.

| Area | Current paths and role |
|---|---|
| Visitor entry | `src/app/main.tsx`: active exhibit, error boundary, worker registration, active styles |
| Shared visitor state | `src/features/archive-exhibit/ArchiveExhibit.tsx`: selection, queries, record, QR wrapper, scene state, idle/reset |
| Relationship view | `src/features/archive-exhibit/LinksScene.tsx` |
| Chronology and film player | `src/features/archive-exhibit/YearsScene.tsx` |
| View models and eligibility | `src/features/archive-exhibit/archiveModel.ts`; layout helper `linkLayout.js` |
| Active styles | `src/features/archive-exhibit/archive-exhibit.css` and `archive-support.css` |
| QR presentation | `src/components/QRCodePanel.tsx` |
| Installation policy | `src/config/installationConfig.ts`; inspect imported `src/app/kioskSettings` before altering persisted settings |
| Offline layer | `public/sw.js`, `src/app/serviceWorkerRegistration.ts` |
| Canonical/generated data | `data/`; `scripts/prepare-data.js`; `public/data/cihof-runtime-data.json` |
| Publication/build logic | `vite.config.ts`, `package.json`, media validation scripts and approval workflow |
| Visitor tests | `tests/index-experience.spec.ts`, `tests/admin-access-settings.spec.ts`, `playwright.config.ts` |
| Staff tests | `tests/portal-profile-readiness.spec.ts`, `tests/portal-relationship-source-leads.spec.ts`, `playwright.portal.config.ts` |
| Deployment | `.github/workflows/pages.yml` |
| Content approval | `docs/media-approval-sheet.csv`, `docs/media-approval-workflow.md` |

At the audited snapshot, README reports 111 inductees, 93 local films all awaiting review, 544 entities, and 2,041 entity relationships. Do not treat all entity relationships as approved person-to-person links. Recompute current counts and publication states rather than hard-coding these numbers into the application.

## 3. Bootstrap prompt — start here

```text
Work in the existing hgw3lls/cihof repository. Read the attached
CIHOF_Museum_Grade_Audit.md and CIHOF_Codex_Upgrade_Plan.md.

Begin with task MG-00 only. Do not redesign the exhibit or implement
all tasks at once.

Establish current HEAD, the active entry point, publication/build
boundaries, current tests, and differences from reference commit
f47d1d7ff9080072a7f3a28508a73e83907f61a5. Read existing AGENTS.md
instructions before adding or amending any repository guidance.

Preserve People / Links / Years, shared person selection, canonical
IDs, approved content, the editorial visual direction, and the
separate staff workflow. Do not work from the inactive legacy App.

Run a fresh local public-build baseline and the existing relevant
tests. Capture actual runtime evidence wherever the environment
supports it. The previous audit could not render the public URL;
therefore do not claim its source findings were already reproduced
in a browser. Distinguish reproduced defects, source risks, design
proposals, pre-existing failures, and blocked checks.

Produce a concise baseline report and a task-by-task execution plan.
Add or update AGENTS.md with practical repository constraints and
verified commands; keep detailed requirements in the plan rather
than duplicating everything in AGENTS.md. Do not modify canonical
content, approve assets, delete old tests, publish, push, or deploy.

Return changed files, commands actually run and their outcomes,
baseline evidence locations, unresolved dependencies, and the exact
next bounded task. Stop after MG-00.
```

OpenAI's official Codex guidance recommends repository context, durable `AGENTS.md` instructions, planning for complex work, and explicit testing/review. The task structure here follows that approach; the detailed product choices are specific recommendations for CIHOF. [S8]

## 4. Execution order

| Task | Priority | Main outcome | Depends on |
|---|---|---|---|
| MG-00 | P0 | Reproducible baseline and operating constraints | None |
| MG-01 | P0 | Inclusive collection and stable selection/return | MG-00 |
| MG-02 | P0 | Complete reset, accessible session timing, media coordination | MG-01 |
| MG-03 | P0 | Years includes every eligible person; films remain rights-safe | MG-01–02 |
| MG-04 | P0 | Explainable, evidence-aware relationships | MG-01 |
| MG-05 | P1 | Interpretive hierarchy and approved-text integrity | MG-01, MG-03–04 |
| MG-06 | P0/P1 | Complete keyboard/dialog/accessibility and companion paths | MG-02–05 |
| MG-07 | P0 | Verified local/offline package, recovery, media range handling | MG-00, MG-02–03 |
| MG-08 | P0 | CI release gates, operator handoff, hardware acceptance | MG-01–07 |

P0 means required before permanent gallery sign-off, not that every task must land before a controlled internal preview. MG-07's packaging investigation can run in parallel with editorial work in a separate worktree, but do not edit shared build/state files concurrently without an integration plan.

## MG-00 — Establish the baseline and actual product boundary

**Goal:** Make subsequent changes evidence-based and reversible.

**Inspect:** README, existing agent instructions, `src/app/main.tsx`, the active exhibit directory, settings/configuration, `package.json`, `vite.config.ts`, the tests and deployment workflow. Follow the public-data generation and approval pipeline far enough to identify where publication eligibility is enforced.

**Work:** Record current commit, runtime routes, feature flags actually consumed by the active app, artifact types, canonical versus generated data, and current content counts. Map legacy features/configuration that exist in source but are not active. Run the public build and existing visitor tests first; run portal checks separately. Do not “repair” a baseline failure until it is recorded.

Capture People neutral/selected/searched/no-results, full record, Links neutral/selected, Years neutral/selected, pending-media behavior, QR, light/dark, and keyboard-focus states. Use the existing 390×844, 768×1024, 1920×1080, and 3840×2160 coverage; add installed-device measurements when available. Record viewport, DPR, browser, OS scaling when known, commit, and data version. Screenshots are not substitutes for action tests.

**Acceptance:** A developer can reproduce the baseline from documented commands; every failed or blocked check is visible; restricted outputs are unmistakably identified; no production content or permission is changed; source risks from the audit are either reproduced, refined, or left honestly unverified.

**Prompt:**

```text
Execute MG-00 only. Establish the current baseline and publication
boundaries before modifying functionality. Add a concise baseline
report and practical AGENTS.md guidance. Keep production content
unchanged and do not deploy. Report actual checks and blockers.
```

## MG-01 — Inclusive collection and stable visitor context

**Goal:** Every eligible honoree is reachable; selecting and reading do not destabilize browsing.

**Primary files:** `ArchiveExhibit.tsx`, `archiveModel.ts`, active styles, existing visitor tests. Inspect the existing person-publication policy before changing collection construction.

**Changes:** Replace portrait-based collection filtering with canonical publication eligibility. Keep a real, accessible fallback for missing images, failed loads, and undersized assets. Do not request an empty URL or fabricate a portrait. Ensure IDs resolve identically in People, Links, Years, and deep links.

Keep a selected person's result position stable. Prefer an “In focus” treatment rather than removing the active result from the grid. Preserve the prior query/filter and scroll position on record close. Restore focus to the originating control; use a sensible surviving fallback when a data update removes that control. Keep the initial collection unselected and avoid a silently privileged default person.

Move shared session state into a small reducer/hook only where it clarifies invariants. Suggested new module names are `exhibitSession.ts` and `useExhibitSession.ts`; use existing equivalents if already present. Do not add a state library simply for this task.

**Tests:** Include an eligible person without an image, a broken image, an unusually long name, a selected search result, a record opened far down a list, and a deep link to a no-image person. Test mouse/touch/keyboard selection and return. Replace the old “selected tile disappears” assertion with the intentionally revised stable-context contract.

**Acceptance:** No person is excluded solely for missing media; return preserves browsing context; focus remains meaningful; all three scenes resolve the same eligible IDs; the change does not alter actual editorial publication statuses.

**Prompt:**

```text
Execute MG-01 only. Decouple person eligibility from portrait/media
availability and preserve grid position, browsing context, and focus
through selection and record return. Add regression fixtures and
update tests whose old behavior deliberately changes. No redesign,
content generation, rights changes, or framework migration.
```

## MG-02 — Authoritative reset and accessible sessions

**Goal:** A clean next-visitor experience without interrupting someone who is still reading or watching.

**Primary files:** Visitor shell/session module, `YearsScene.tsx`, `QRCodePanel.tsx`, installation settings/configuration, tests.

**Changes:** Implement one `resetSession(reason)` contract. It clears selected ID, person history, scene, People and Links queries, future filters, all scene positions, open record, QR, active media, and transient visitor URL state. Stop media and cancel pending work that belongs to the previous session. Clear state through explicit ownership, not `localStorage.clear()`. Preserve approved data, staff configuration, and intentional persistent theme behavior. Reset must work even when it does not change the current scene.

Add an obvious, consistently reachable Start over control. Keep “back to previous person,” “close record,” and “start over” semantically distinct.

Separate public-companion and physical-kiosk timing policy. Do not impose a museum inactivity reset on an ordinary reading website by default. For the kiosk, provide an accessible warning and extension/adjustment path. Proposed warning duration: 30 seconds; preserve the visitor's exact state on extension. Support at least ten extensions when implementing WCAG's extension option. Do not just connect the existing shorter warning setting without checking it. [S6]

Notify the session controller while a video is genuinely playing/progressing. A stalled video must not keep the exhibit permanently occupied. Ensure visible transcript reading, QR use, keyboard access, and touch-scroll activity receive appropriate treatment. Use one policy rather than competing, unexplained QR and page timers. Avoid a trap where a full-screen warning intercepts the very action needed to extend.

**Tests:** Fake-clock tests for reset and extension; active playback longer than the idle interval; paused/stalled/ended video; no-results search; repeated reset; same-scene reset; QR warning; post-reset URL; settings persistence; session remount/unmount cleanup.

**Acceptance:** Reset state equals the agreed fresh-visitor baseline; readers get a usable continuation mechanism; active media does not unexpectedly disappear; timers do not leak or multiply; public-companion mode does not inherit kiosk timing accidentally.

**Prompt:**

```text
Execute MG-02 only. Implement a single full-session reset and
accessible, mode-aware inactivity policy. Cover searches, scrolling,
media, QR, URL state, and focus while preserving installation
settings. Add deterministic timer tests. Do not add tracking or
change content approvals.
```

## MG-03 — Complete induction chronology and dependable media

**Goal:** Years is valuable with zero approved films.

**Primary files:** `YearsScene.tsx`, `archiveModel.ts`, active styles, public media/build policy, relevant tests.

**Changes:** Build the chronology from all publication-eligible people grouped by induction class. Give each person an individually accessible entry. Films are optional child assets, not the source of person eligibility. Maintain touch scrolling, arrow buttons, year rail, keyboard navigation, and selection continuity.

Use clear induction-year language. Do not fabricate life-event dates from class years. Represent genuinely missing/unknown class dates honestly rather than connecting all unknown-date people as a cohort.

Avoid filling a major visitor scene with internal “awaiting approval” screens. Where a film is not publishable, provide the complete person experience without an apparent broken player; retain all detailed review state in the staff workflow. Do not remove pending source records or clearances from canonical data.

Retain the current rights/caption/transcript gates. Trace whether permission scope distinguishes public web use from onsite kiosk use; do not assume `approvedForKiosk` alone grants public distribution. Add an explicit compatible policy where needed, with an unresolved-review state rather than silently granting new rights.

Add media loading/error/retry states, safe handling of `video.play()` rejection, caption-load/transcript-load failures, and return to the associated record. Preserve full transcript text. Ensure video and transcript focus/visibility are correct in both tabs and mobile layouts. Media must cooperate with the session controller.

**Tests:** No films; all films pending; mixed approved/pending; person with no video; missing caption/transcript; real playable synthetic or clearly licensed test fixture; seek and replay; decode/network failure. Keep test-only approval changes out of canonical data and public production artifacts. Check successful decoding/time progression, not just existence of a `<video>` tag.

**Acceptance:** Every eligible person can be reached by year without media; no unauthorized payload becomes public; time labels are semantically correct; actual fixture playback/captions/transcript work; failure returns a usable person record rather than a dead end.

**Prompt:**

```text
Execute MG-03 only. Rework Years into a complete induction-class
chronology driven by eligible people, with approved films as optional
enhancements. Preserve all input methods and clearance gates. Add
real test-fixture playback and failure tests; never approve real
media merely to make the interface or tests look complete.
```

## MG-04 — Truthful, visible relationship explanations

**Goal:** The visitor can understand why two people are connected and inspect the evidence.

**Primary files:** `archiveModel.ts`, `LinksScene.tsx`, layout/styles, canonical/public relationship adapters and validators identified in MG-00.

**Changes:** Trace `inducted_by_candidate` and `related_to` through canonical sources, curation decisions, generated runtime data, and visitor rendering. Record whether provisional rows are already excluded upstream. Enforce explicit publication eligibility without assuming an apparent type name alone proves or disproves approval.

Preserve typed direction, relation identity, source references, review status, and meaningful forward/reverse descriptions. Retain multiple documented relationships between a pair where appropriate; do not lose their meaning through person-only deduplication. Separate shared-class context from a documented relationship. Label it “Honored in the same year” or similarly precise wording.

Display the relevant explanation visibly when a connection is explored. Keep selection predictable: a compact explanation panel can accompany re-centering, or a visible relation control can open it. Avoid making the visitor guess whether a tap selects, opens, or moves. Provide an equivalent accessible list of the selected person's relationships with the same text, sources, and actions.

Use wording and line treatment together; never encode meaning only in color. Do not shrink dense graph nodes below usable targets to fit the screen. Offer scrolling, filters, or a list with an explicit count rather than silently omitting relationships. Distinguish loading/error from “no documented connections.”

**Tests:** Directional relation viewed from either endpoint; two relation types for one pair; provisional/unapproved relation; approved sourced relation; same-class-only link; unknown class dates; no relationships; failed relationship load; repeated re-centering; keyboard list equivalence; responsive layout with long labels.

**Acceptance:** Every published edge has an intelligible explanation and provenance or is clearly identified as shared context; provisional publication behavior is documented and tested; visible and assistive experiences express the same relationship; no inferred friendship or migration claim is introduced.

**Prompt:**

```text
Execute MG-04 only. Make Links visibly explainable and evidence-aware.
Trace upstream approval handling before changing it. Preserve relation
type/direction and sources; distinguish shared induction year from
personal relationships. Add an equivalent accessible relation list
and regression tests. Do not invent or auto-approve links.
```

## MG-05 — Interpretive hierarchy, approved text, and visual refinement

**Goal:** Preserve the design's character while making its meaning easier to grasp.

**Primary files:** Visitor shell/RecordView, active styles, People search/view model, canonical content schema/adapters and staff preview where necessary.

**Changes:** Add a concise, curator-reviewable invitation to the neutral state within the existing layout. Do not introduce a blocking introductory splash screen. The neutral sidebar must do more than repeat collection counts; selected state should foreground the person and their approved contribution.

Reorganize the full record into progressive layers: contribution; complete biography; optional approved Cleveland context; evidence/record notes. Preserve full source text. Remove runtime name-prefixing and heuristic editorial “repair.” Use approved paragraph structure or a documented review migration; do not silently paraphrase biographies.

Support contribution-area, induction-year, and suitable community browsing within People, using existing approved vocabulary. Treat identity, heritage, place, and migration facts as distinct fields. Keep ordinary search, but do not require a physical or onscreen keyboard to begin.

Add a minimal schema/view for approved Cleveland context and linked archival material only after inspecting existing structures. New fields may include a source reference, credit, rights scope, descriptive text, relationship to the person, and review state. Unknown fields remain empty or in staff review; the public UI must not expose fictitious placeholder objects.

Refine the existing typography, spacing, portrait crop/focal-point policy, and reading rhythm. Use sentence case for prose and descriptive controls where it improves comprehension; retain uppercase where it belongs in the identity system. Start long-form line height around 1.4–1.6 and measure actual layout rather than applying indiscriminately. Review both themes and all states. Consolidate active selectors and tokens instead of appending another override layer. Do not remove shared portal/support styles without checking their consumers.

**Tests/review:** Approved text renders unchanged; absent source/context fields have honest fallbacks; long names and long biographies; filter combinations; accent/diacritic normalization in search without changing displayed names; portrait focal points; neutral/selected/reading hierarchy; regression screenshots with real fonts loaded.

**Acceptance:** A first-time visitor has a clear invitation; short and deep reading both work; every new interpretive claim awaits authorized review; no source text is “fixed” during rendering; visual changes remain recognizably CIHOF rather than a generic redesign.

**Prompt:**

```text
Execute MG-05 only. Improve interpretation and reading hierarchy
inside the existing editorial design. Preserve approved biographies,
remove runtime prose repair, add curator-controlled entry copy and
optional sourced Cleveland context, and support non-typing discovery.
Consolidate active CSS carefully. Do not fabricate content or rebrand.
```

## MG-06 — Accessibility, reachable operation, and continuation

**Goal:** Complete visitor journeys with keyboard, touch, and appropriate assistive technology.

**Primary files:** Active shell/scenes, QR wrapper/component, shared dialog/focus utilities, styles, tests, installation documentation.

**Changes:** Implement a correct modal contract for QR and any new dialogs: labelled purpose, initial focus, contained tab sequence, inert background, Escape when appropriate, and focus restoration to a surviving trigger. Do not apply `aria-modal` unless the behavior is truly modal. Fix focus restoration for record close, selection changes, and scene transitions. [S4]

Audit all essential controls, target spacing, focus visibility, contrast, reflow, zoom, motion preferences, and screen-reader naming. Adopt WCAG 2.2 AA as the intended software baseline, with larger practical kiosk targets; do not equate AA's CSS minimum with the best physical target size. Provide non-drag alternatives and make instructions visible without hover. [S2–S3]

Prototype a reachable control arrangement appropriate to the installed wall/shelf system. All essential functions must have a reachable equivalent. Record physical screen dimensions, mounted height, operating-system scaling, input-device placement, approach/clearance, and seated/standing use. Browser viewport tests do not certify these conditions. Resolve the independent path for blind visitors with the institution; an optional phone is not the sole fallback. [S5]

Verify the QR's actual encoded URL is a stable public continuation route, not localhost, a private address, staff portal, or a URL containing admin/session parameters. Verify it loads the same person on a phone with usable reading layout. Preserve kiosk access to the complete core story; QR should not conceal content exclusively behind a phone.

**Tests:** Full Tab/Shift+Tab cycles; screen-reader spot checks and accessible-tree inspection; reduced motion; 200% text/zoom and narrow reflow with justified graph alternatives; both themes; QR URL decoding and round-trip; stale/invalid person URL; Escape and return focus; no invisible focus under overlays. Add automated accessibility checks as one layer, not as the entire proof.

**Acceptance:** All main journeys work without touch or precise dragging; modal semantics match behavior; extension/reset controls are usable; companion links resolve correctly; physical and assistive checks have documented results or remain explicit release blockers.

**Prompt:**

```text
Execute MG-06 only. Complete keyboard, focus, modal, reflow, target,
motion, and QR-continuation behavior. Use automated checks plus manual
journeys, and separate software results from physical installation
checks. Preserve kiosk access without requiring a visitor's phone.
Do not claim accessibility certification from a scan alone.
```

## MG-07 — Offline package, safe updates, and recovery

**Goal:** The provisioned gallery system works independently of internet availability and recovers from failed releases.

**Primary files:** `public/sw.js`, worker registration, `vite.config.ts`, packaging/validation scripts, runtime data loading, diagnostics; inspect existing implementations before adding alternatives.

**Changes:** Document two deployment modes: an approved public site and a locally served gallery package. Keep restricted review material isolated from public output. Determine what the installed kiosk must contain versus the staff review workstation; do not ship unnecessary pending payloads merely because they are locally available.

Replace “worker registered” as the readiness definition with a validated inventory of the required core shell, fonts, person data, and portraits/fallbacks. Generate a release manifest with application/data/asset identity and hashes or another documented integrity mechanism. Do not hard-code a manual cache version as the only release identity.

For browser offline support, pre-cache/stage the approved core deliberately. For large gallery films, prefer a verified on-disk package and local server with range support rather than downloading the full archive into a fragile request cache. Select the simpler architecture that meets the actual installation requirements.

Handle network timeouts, non-OK responses, corrupted/missing data, cache-write rejection, and quota problems without discarding a healthy active release. Treat HTTP 206/range requests deliberately: do not blindly pass partial responses into `Cache.put`. Test seek and playback with the worker actually controlling the page. [S7]

Keep application, data, and assets coherent. Stage and validate an update before switching releases; activate at an appropriate idle or staff-approved point rather than disrupting a visitor. Retain a last-known-good rollback, except where revoked rights require material to be withheld. Add a documented revocation/update procedure and do not promise that already-distributed public files can be retroactively erased.

Add readiness diagnostics and recovery actions to existing staff tools where possible. Distinguish “internet offline,” “local server unavailable,” “package incomplete,” and “healthy offline.” Inspect browser/OS startup and watchdog arrangements separately from in-app error handling.

**Tests:** Provision core without manually visiting every record; go offline; restart browser; open previously unvisited people and approved media. Simulate a hanging request, HTTP 500, corrupt data, storage/write failure, valid partial-content request, interrupted update, mixed-version attempt, revoked asset, and rollback. Verify public output contains no rejected payloads, including captions/posters/transcripts associated with blocked media.

**Acceptance:** Core content works after verified provisioning and restart without internet; media ranges/playback are correct; failed updates preserve a coherent usable release; staff can identify and recover failures; no restricted artifact is published.

**Prompt:**

```text
Execute MG-07 only. Implement and test a coherent approved offline
release, with deliberate provisioning, HTTP/range and cache-failure
handling, staged updates, and rollback. Distinguish the public site
from the locally served museum package. Reuse diagnostics and
packaging infrastructure where suitable. Do not deploy or expose
restricted media.
```

## MG-08 — Release gates, operations, and actual sign-off

**Goal:** Make “ready for the museum” an evidence-backed release decision.

**Primary files:** `.github/workflows/pages.yml`, relevant test configurations, validators/packaging, release and operator documentation.

**Changes:** Put repeatable checks before public deployment. Run browser/interaction tests against the public build artifact, not an unrelated development environment. Run staff portal checks separately and keep its payload out of the visitor artifact. Add data/relationship validation, rejected-media artifact checks, automated accessibility checks, and deliberate offline/recovery tests where they can run reliably in CI.

Inspect existing validator assumptions. The full-media-clearance command is expected to report pending materials at the audited snapshot; do not turn “every archived film must be approved” into an accidental prerequisite for publishing a perfectly valid text/portrait exhibit. The gate should strictly validate what is published while accurately reporting pending holdings.

Name and retain build artifacts so a restricted package cannot be confused with the Pages output. Record commit, data revision, approval revision, test results, screenshots, and intended target. Make deployment consume the tested artifact. A release should not rebuild different content after passing tests.

Create a concise staff runbook: startup/shutdown, ready/not-ready checks, safe restart, network loss, content publication, permissions, approved media addition, cache/release update, rollback, and escalation. No secrets in browser bundles, instructions, screenshots, or exported logs. Verify local import/auth/service boundaries without making unsupported security claims.

Set performance and endurance targets after baseline measurement. Suggested initial project targets: visible control feedback within 100 ms and warm scene changes within 300 ms on the selected hardware, measured under a documented test method; 72-hour unattended soak without an unrecovered failure; no monotonic resource growth across repeated representative journeys. These are proposed acceptance goals, not asserted current results or universal standards.

Conduct a formative visitor test with participants spanning age, reading pace, mobility/dexterity, and access needs. Ask them to find a person without typing, explain a relationship, navigate Years without a film, recover their place, and start a new session. Record confusion and task outcomes, not personal identifying data. Treat this as formative evaluation, not a statistically representative survey.

**Acceptance:** A failing required gate prevents deployment; the tested and deployed artifact are identical; staff can recover the installed system; physical/accessibility and curatorial reviews are completed or explicitly block gallery sign-off; no generated status report invents a passed test.

**Prompt:**

```text
Execute MG-08 only. Add release gates for the tested public artifact,
keep portal/restricted packages separate, and produce a practical
museum handoff and acceptance record. Preserve pending holdings
without publishing them or treating them all as approved. Do not
claim hardware, visitor, or accessibility tests were completed unless
they were actually run. Do not deploy without explicit authorization.
```

## 5. Verified commands and execution cautions

These commands exist at the audited commit. Confirm they still exist before relying on them:

```sh
npm ci
npm run typecheck
npm run validate:entities
npm run build:public
npm run test:kiosk
npm run build:portal
npm run test:portal
npm run validate:offline
npm run launch:readiness
```

The Playwright visitor configuration can build its own public preview. Understand its environment overrides and avoid accidentally testing a different build or server through `reuseExistingServer`. Separate public and portal execution/output. Inspect `validate:offline` before wiring it to a public artifact; adapt its target assumptions rather than blindly adding the command to CI.

Additional commands present include `npm run build:kiosk`, `npm run validate:kiosk`, `npm run validate:media-clearance`, and `npm run launch:readiness:strict`. Their intent differs. The audited default `npm run build` is not a safe substitute for `build:public`. Never fix a validator by changing real pending approvals to approved. Do not add guessed package scripts to documentation without implementing them.

## 6. Cross-cutting test matrix

| Scenario | Required behavior |
|---|---|
| Eligible person lacks photo or film | Person remains reachable in the collection and chronology; honest fallback |
| Selected person found through search | Tile/context remain stable; close restores position and focus |
| Active reading and playback | Accessible extension policy; no unexplained abrupt reset |
| Start over from every state | Fresh visitor baseline without destroying staff settings |
| Provisional relation | Policy determines eligibility explicitly; no accidental factual assertion |
| Same induction year | Shared context label, not implied friendship/collaboration |
| No approved videos anywhere | All three primary scenes remain coherent and useful |
| Approved video fixture | Decodes, progresses, seeks, captions/transcript load, failure is recoverable |
| QR dialog | True modal keyboard behavior, adequate time, correct continuation URL |
| Offline after provisioning | Previously unvisited core content works after restart |
| HTTP error, hang, range, cache failure | Bounded recovery and no broken active package |
| Interrupted or revoked-content update | Coherent rollback or safe withholding; no stale permission bypass |
| Narrow/zoomed/seated/keyboard use | Essential functions have a usable equivalent; physical checks documented |
| Public build artifact | No restricted videos, derivatives, privileged credentials, or staff-only payloads |
| CI and deployment | Test the exact release; failure prevents publication |

## 7. Curatorial work that Codex must not replace

Software can build validators, review queues, previews, migrations, and source displays. The following require an authorized human decision: film usage rights and distribution scope; caption/transcript approval; person contribution summaries; cultural/heritage classifications; relationship claims; interpretation of archival objects; historical date uncertainty; new translations; portrait cropping where a meaningful image is altered; final exhibition copy.

A sensible first enrichment batch is a small cross-section of approved records that demonstrates the complete interpretive model, rather than automated enrichment of all 111 at once. The particular people and objects should be selected by the curatorial team, not ranked by popularity or guessed from available media.

## 8. Changes explicitly out of scope

Do not add a conversational AI guide, biometric interaction, a new primary scene, a map with inferred migration routes, an automated historical relationship generator, a CMS replacement, or a new backend just to satisfy the phrase “state of the art.” Do not remove old source indiscriminately. Archive/deletion cleanup can be a separate, evidence-based maintenance task after the active release is stable.

## 9. Required completion message for each task

```text
Task:
Commit/worktree:
Implemented behavior:
Files changed:
Tests/commands actually run and outcomes:
Evidence files:
Existing failures versus introduced failures:
Curatorial or hardware dependencies:
Remaining risks:
Rollback approach:
Next bounded task:
```

## References

The companion audit's source register pins the inspected repository files and deployment evidence. Re-check current HEAD before using its observations as present-tense claims.

[S2] WCAG 2.2: https://www.w3.org/TR/WCAG22/  
[S3] Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html  
[S4] Modal Dialog Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/  
[S5] Operable Parts: https://www.access-board.gov/ada/guides/chapter-3-operable-parts/  
[S6] Timing Adjustable: https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html  
[S7] Cache.put algorithm: https://w3c.github.io/ServiceWorker/#cache-put  
[S8] OpenAI Codex best practices: https://developers.openai.com/codex/learn/best-practices/
