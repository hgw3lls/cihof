# Source register and verification boundary

## Method

GitHub source reads were pinned to commit `d97afd32b967a5b6e62ad6075b133979e8468b0a`. The successful deployment artifact for that commit was downloaded, extracted, and inventoried. Its `data/build-info.json` matches the same SHA and public build target. Current browser behavior was not successfully exercised: the public URL could not be opened here, and a local browser render was administratively blocked. That restriction was not bypassed.

Repository statements that earlier tests passed are attributed to the repository's records, not presented as tests performed for this report. All screen composition recommendations are proposals; no unobserved visual defect, measured contrast ratio, frame rate, or physical reach result is asserted.

## Repository evidence

For each path below, the pinned source URL is:
`https://github.com/hgw3lls/cihof/blob/d97afd32b967a5b6e62ad6075b133979e8468b0a/<path>`.
These are private-repository links and require the owner's access.

| ID | Path or resource | What it establishes |
|---|---|---|
| R01 | `AGENTS.md` | Active entry, legacy exclusions, canonical data, Node 22, build boundaries, existing execution rules. |
| R02 | `src/features/archive-exhibit/ArchiveExhibit.tsx` | Current People/Links/Years shell, conditional scenes, person selection, People-only filters, full record, reset, QR, admin integration. |
| R03 | `src/features/archive-exhibit/archiveModel.ts` | Collection eligibility, explicit relationships vs shared class, exclusion of non-person relationship targets, media readiness delegation. |
| R04 | `src/features/archive-exhibit/interpretiveModel.ts` | Approved tag filtering, search normalization, current contribution and Cleveland-story gates, biography rendering. |
| R05 | `src/features/archive-exhibit/LinksScene.tsx` | Centered constellation, previews, connection list, visible evidence/context distinctions, measured layout and collision handling. |
| R06 | `src/features/archive-exhibit/YearsScene.tsx` | Induction chronology, all-person coverage, year-jump controls, film/transcript handling, scroll return. |
| R07 | `src/data/types.ts` | Existing person/entity/relationship/story/archive models; legacy fields and newer extensions coexist. |
| R08 | `src/data/relationshipPublication.ts` | Current record validation and inferred/reference checks; provenance is not a separate approval workflow. |
| R09 | `public/data/relationships.json` | Empty explicit relationship array at the audited commit. |
| R10 | `public/data/data-report.json` | 111 records and existing vocabulary, including mixed community and heritage categories. |
| R11 | `cihof-museum-upgrade/TASK_TRACKER.md` | MG-00–04 complete, MG-05–06 awaiting review, MG-07–08 not started; inherited test reports and open sign-offs. |
| R12 | `docs/current-architecture.md` | Visitor/staff split, runtime bundle, compatibility aliases. Source code takes precedence where names differ. |
| R13 | `package.json` | Existing commands and dependency families. No framework migration is needed for this plan. |
| R14 | `.github/workflows/pages.yml` | Public build/deploy workflow; no explicit visitor-test or target-specific content gate in that workflow. |
| R15 | `playwright.config.ts` | Current suite builds its own public preview with accelerated kiosk timings; this is not a smoke test of an unchanged production artifact. |
| R16 | `vite.config.ts` | Existing target-aware public copying, film filtering, candidate-entity/edge filtering, and build metadata. Extend these safeguards rather than duplicating them. |
| R17 | `public/sw.js` | Fixed cache family/version, opportunistic caching, immediate worker activation, network-first data/documents. |
| R18 | GitHub Actions run `35547145326` | Successful deployment of audited SHA. `https://github.com/hgw3lls/cihof/actions/runs/35547145326` |

Some files were read by selected relevant ranges. No claim is made that every file or every line in the repository was inspected.

## Artifact evidence

[E01: deployment_inventory.json](evidence/deployment_inventory.json) records counts and SHA-256 hashes of inspected data files. The source is the downloaded `github-pages` artifact `10615874564`, not an older source report. The inventory script is included so the counts can be regenerated against an extracted deployment.

Important reconciliation: older/generated source reports describe 451 entities and 1,948 edges. The actual public deployment contains **297 entities and 856 generated edges** after publication filtering. Neither number is a count of direct person-to-person relationships. The actual explicit relationship array is empty.

The artifact still includes starter story records and archive-lead metadata that the visitor UI gates out. The source-curation envelope in the runtime bundle is a summary; it does not contain its original full record packet. This report does not claim that all staff data or all candidate entities are published.

## External technical references

These provide narrowly used implementation guidance, not a certification of this installation.

- W01 — W3C, WCAG 2.2 Understanding SC 2.5.7, Dragging Movements: `https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html`. Provide a single-pointer non-drag alternative; keyboard access is a separate requirement.
- W02 — W3C, WCAG 2.2 Understanding SC 2.5.8, Target Size (Minimum): `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`. The AA minimum is 24 × 24 CSS pixels subject to exceptions. The larger target sizes in this package are proposed exhibit design requirements.
- W03 — W3C, WCAG 2.2 Understanding SC 2.2.1, Timing Adjustable: `https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html`. Retain a tested way to manage session limits; fixture timing values are not production settings.
- W04 — Chrome for Developers, Serving cached audio and video: `https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video`. Future local video playback needs a deliberate complete-response/range-request strategy rather than assuming ordinary image caching is sufficient.
- W05 — OpenAI, AGENTS.md guide, official guide entry: `https://developers.openai.com/codex/guides/agents-md/`. Use repository instructions and scoped task files; this package is supplemental guidance, not a replacement for the project's root instructions.

Accessed September 20, 2026, America/Detroit. Recommendations, budgets, task boundaries, and interaction concepts elsewhere in this package are proposed design decisions, not claims that these sources prescribe them.
