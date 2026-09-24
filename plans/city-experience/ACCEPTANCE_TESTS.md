# Acceptance and evidence matrix

All tests below are requirements to execute in the implementation environment. None is reported as passed by this static audit. Preserve existing regression tests; add narrow tests beside the feature that introduces each behavior.

## Test environments

Use the repository-pinned Node 22 and lockfile. Record browser/OS version and build SHA. Test the current 1920×1080 CSS baseline, 3840×2160 CSS where supported, 4K output with the actual configured OS scaling, and a narrow mobile continuation viewport. CSS viewport and physical pixel dimensions are not interchangeable.

Use mouse, keyboard-only and single-pointer tap-only paths separately. Real touchscreen, seated/standing reach, screen-reader and independent nonvisual journeys require the supported installed setup. Record untested combinations, not just those that pass.

## Core visitor cases

| ID | Case | Pass condition |
|---|---|---|
| T01 | Complete collection | Baseline 111 valid people remain discoverable despite missing imagery, missing enrichment or legacy workflow status. Content updates may change the count only through a documented source change. |
| T02 | Regroup collection | Community/contribution arrangements preserve unique person identity and selected-person continuity; groups are labeled; memberships are not misreported as people. |
| T03 | Multi-affiliation | A reviewed multi-affiliation person is discoverable through each appropriate facet without an invented single primary identity. |
| T04 | Combined filters | Cross-dimensional intersections, within-dimension unions, counts and removable chips behave as documented across lenses. |
| T05 | Sparse data | Unmapped, undated, uncategorized and no-story records remain accessible; empty state offers a clear recovery rather than false facts. |
| T06 | Back and close | Return restores lens, filters, selected person, detail origin, scroll and logical focus; stale DOM references do not strand focus. |
| T07 | Start over | Clears search, facets, person, comparison, place, date state, history, details, media and URL visitor state; retains installation settings. |
| T08 | Deep links | Old People/Links/Years/person URLs work; historical activity is never inferred from an old induction link; invalid IDs recover without a blank screen. |
| T09 | Place association | Each visible place association shows its role and source; schematic markers are never treated as geocoordinates; map and list expose equivalent records. |
| T10 | Contribution story | Each published step has evidence; opening/closing evidence restores its step; absent outcomes are omitted rather than fabricated. |
| T11 | Connection semantics | Direct, shared-context, curatorial comparison and induction context have distinct wording/presentation; reverse direction does not invert the claim. |
| T12 | Comparison | Add/remove/replace up to two people by tapping; shared facts are supported; no direct-link case is honest; no score or winner is introduced. |
| T13 | Time | Induction versus activity labels/date fields are distinct; approximate/open/unknown periods follow the schema; unknown does not become present day. |
| T14 | Gallery/media | Only target-eligible assets are offered; missing file and load failure show a recoverable state; zoom works without pinch or drag; captions and credits persist. |
| T15 | Film future fixture | Captions/transcript/poster/rights/file prerequisites enforced. Playback, pause, replay, backwards seek, transcript and close integrate with the existing session controller. |
| T16 | Attract state | First interaction stops automated choreography without discarding the visitor's selection; media never autoplays sound. |
| T17 | Session warning | Visitor can extend session and keep focus; reading, media progress and input have deliberate policies; test timers cannot leak into production. |
| T18 | Continuation | QR resolves to same person's authorized public record on a real phone; never localhost, a staff route or kiosk-only media; current external target limitations remain open until checked. |

## Content and publication cases

| ID | Case | Pass condition |
|---|---|---|
| P01 | Draft enrichment | Draft/withheld stories and relationships absent from public payloads, not merely hidden by CSS. Legitimate public catalogue metadata follows its own explicit decision. |
| P02 | Legacy statuses | Migration does not hide all base records or bulk-approve new content from `curated`/`draft` labels. |
| P03 | Candidate exclusion | Existing provisional candidate person/relationship exclusions remain effective in runtime, split JSON and export formats. |
| P04 | Reference integrity | Every surviving endpoint, place association, story media reference and trail step resolves after filtering. |
| P05 | Target separation | Public, kiosk and portal outputs contain only intended entry/data/assets. Pending holdings do not require publishing films to pass a valid text/portrait public release. |
| P06 | Source fidelity | Source biography retained; reviewed paragraph segmentation does not rewrite facts; quotations exact with locator; authored text labeled. |
| P07 | Fixture exclusion | Synthetic test people, places and claims absent from generated visitor artifacts. Test fixture IDs never reuse real people. |
| P08 | Revocation | Withdrawal removes visible claim/control and public payload; unaffected base person remains discoverable; old cached versions follow agreed revocation/update policy. |
| P09 | Determinism | Same source and target yield equivalent content output apart from explicit build metadata; semantic diffs identify approved changes. |

## Access and rendering cases

| ID | Case | Pass condition |
|---|---|---|
| A01 | Tap-only access | Every authored drag, pan, zoom, compare and date adjustment has a usable single-pointer non-drag equivalent. |
| A02 | Keyboard/nonvisual | Complete core journey via semantic controls/list; reading order and visible focus meaningful; no canvas-only historical content. |
| A03 | Focus | Reorganization, comparison, record, evidence, warning and reset move/restore focus predictably; inert/modal behavior appropriate; Escape closes the right layer. |
| A04 | Reduced motion | Same information without spatial motion; no targets continue drifting while reading. |
| A05 | Reflow/text | Long names, long source text, text enlargement, narrow continuation and software reach mode work without clipped controls or inaccessible horizontal reading. |
| A06 | Meaning beyond color | Relation type, selected states, groups and warnings understandable without color or hover alone. |
| A07 | Target sizing | Actual computed target size/spacing meets the agreed project spec; real reach and viewing-distance results recorded separately. |
| A08 | Automated scans | Run axe on representative states; resolve serious issues and document any exceptions. A clean scan alone is not accessibility sign-off. |

## Offline, update and operational cases

| ID | Case | Pass condition |
|---|---|---|
| O01 | Provisioning | Required manifest assets complete and checksum-valid before “offline ready”; optional absent packs labeled. |
| O02 | Restart offline | Provisioned app opens after browser/device restart without network, including an unvisited person deep link and required media. |
| O03 | Incomplete first use | First-ever offline load is not claimed to work; interrupted provisioning gives a recoverable status. |
| O04 | Update interruption | Interrupted download, bad checksum or server error leaves last working release available; no mixed schema/content/shell. |
| O05 | Safe activation | New release activates at agreed idle/reset/restart point; active session not hijacked by immediate worker takeover. |
| O06 | Storage failure | Quota/cache-write failures and missing optional images do not blank a successful online response; retry/recovery available to staff. |
| O07 | Scope/navigation | `/cihof/` base path, queries and deep-link document fallback correct; portal/unrelated app caches not accidentally removed. |
| O08 | Future video range | Approved media supports playback/seeking under offline range requests; ordinary image caching is not treated as proof. |
| O09 | Endurance | Repeated person/filter/lens/compare/reset cycles show no runaway timers, listeners, memory or stale media; extended run executed on target hardware. |
| O10 | Exact artifact | Production smoke suite tests a hash-identified output without rebuilding it or injecting test timing settings. |
| O11 | Rollback | Staff can identify release version, inspect missing assets, restore last known-good package, and record outcome. |

## Existing command baseline

These commands exist in the inspected repository. A stage may run a justified subset, but a release must record the relevant full results. Existing known failures and authorization-blocked content work must not be disguised as regressions.

```sh
nvm use
npm ci
npm run typecheck
npm run validate:entities
npm run build:public
npm run test:kiosk
npm run validate:kiosk
npm run build:portal
npm run test:portal
```

Inspect and run `npm run validate:offline` against the intended target, reporting its actual result. Root guidance describes an older public-artifact reference failure; do not assume it persists, because the current deployed output already has additional filtering. `npm run validate:media-clearance` may legitimately fail while holdings remain pending; the public release gate must test the published set rather than demand unauthorized clearance.

**Proposed additions, not existing commands:** a pure publication/schema suite, a production-artifact smoke suite with no rebuild, target-specific release validation, and a state-atlas capture covering new lenses. Name these scripts only when they are actually implemented and update the tracker.

## Completion evidence

Save commands, exit codes, build SHA/target, dataset revision, screenshot/trace paths, and manual review results using [TASK_COMPLETION.md](templates/TASK_COMPLETION.md). Mark blocked rendering, absent hardware, missing rights and pending content as such. Screenshots document a rendered state; they do not prove all interactions, source accuracy or accessibility.

---

## Addendum: source audit cases

Added 2026-09-21 from [CIHOF_Source_Audit.md](CIHOF_Source_Audit.md). These
cover behavior the existing matrix assumes but does not test, in four places
where the current implementation does the opposite of the requirement rather
than simply lacking it. Same rules as above: none is reported as passed here.

| ID | Case | Pass condition |
|---|---|---|
| P10 | Override provenance | An imported runtime bundle is refused unless it carries a recognized schema version and a content revision, and passes the same pure publication selectors the build uses. A refusal names the reason. No second set of publication rules exists. |
| P11 | Override visibility and reversal | While an imported bundle is in effect, a staff-readable indicator names the imported revision, and clearing it does not require the passcode form. The documented Start Over behavior for an active override matches the code. |
| P12 | Withdrawal reaches the device | After a record is withdrawn and a new release is published, no cache, local fallback or prior import can still present it. Exercised against the real payload size, not a fixture small enough to fit a storage limit the real one exceeds. |
| P13 | Staff surface absent from public output | The public artifact contains no admin panel code path, verified against the built bundle rather than by route. Any compile-time credential in a non-public target is recorded as readable in that bundle. |
| O12 | Activation is deliberate | A new release does not take over a session in progress. The agreed idle, reset or restart activation point is exercised, and the previous release remains available until the new one has activated successfully. |
| O13 | Caching failure is not visitor-facing | A cache write that fails for quota or storage reasons still returns the successful network response to the page. Exercised by forcing the write to fail, not by assuming it succeeds. |
| O14 | First load offline | A device provisioned but never navigated beyond the entry page opens an unvisited person deep link offline, or the product states plainly that it cannot and the provisioning step says so. |
| T19 | The suite is actually running | The visitor suite asserts that it collected a plausible number of tests. A collection error, an import that throws at module scope, or a filter that silently matches nothing fails the run rather than reporting an ordinary failure with zero tests. |

T19 exists because `npm run test:kiosk` exited 1 having collected zero tests
while every recorded result still read like a normal pass or failure. A suite
that cannot run is worse than a failing one, because it looks the same as a
suite that has nothing to say.
