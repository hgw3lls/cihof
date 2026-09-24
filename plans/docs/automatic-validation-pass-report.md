# CIHOF Fresh Deep Audit

Generated: 2026-09-13T20:51:50Z

## Scope

This is a fresh local automated audit of the current CIHOF workspace after the Week 1 cleanup passes. It refreshes generated runtime data, text readiness, non-external content review, curated metadata, media and launch gates, production builds, offline validation, script syntax checks, and Playwright browser suites.

External research remains separate. This audit does not integrate `data/external-research/*` and does not make factual, rights, approval, or physical-installation decisions.

## Result

The content/data pipeline is in strong shape: all 111 profiles now pass the automated text-readiness triage, core profile copy is fully populated, all 111 primary portraits are kiosk-ready, all 1110 image assets have approved image-rights status, all 999 gallery images are localized and kiosk-ready, curated metadata validates with 0 errors and 0 warnings, entity validation is clean, public and portal builds pass, offline validation passes with the expected remote-media warning, and the portal and kiosk Playwright suites pass.

The app is not launch-ready for the October 12, 2026 target. Launch is blocked by approval and installation work: final profile approvals, explicit reviewed TRACES relationships, and physical wall position mapping.

The 2 kiosk browser-test regressions from the previous pass are fixed and verified: the full kiosk Playwright suite now passes 36/36.

## Commands Run

| Command | Result | Key output |
| --- | --- | --- |
| `npm run prepare:data` | Pass | 111 profiles; 451 entities; 1948 generated entity relationships; 0 explicit relationships; 0 physical wall positions |
| `npm run content:text-readiness` | Pass | 111/111 profiles pass as-is; 0 minimal-edit profiles; 0 editorial-review profiles |
| `npm run content:review` | Pass | 96 records without targeted editorial cleanup flags; 2 highest-priority cleanup records listed |
| `npm run curate:report` | Pass | 111 curated records; 0 validation errors; 0 validation warnings; 111 populated approved-summary fields |
| `npm run validate:entities` | Pass | 451 entities; 1948 relationships; 0 errors; 0 warnings |
| `npm run audit:data` | Pass | 0 missing primary images; 0 duplicate ids; 0 generic image candidates; 47 profiles without video |
| `npm run media:youtube-plan` | Pass | 633 acquisition rows; 140 unique YouTube ids; 62 already downloaded; 0 rights-confirmed |
| `npm run media:gallery-localize` | Pass dry run | 0 remote-only gallery image candidates remain |
| `bash -n data/media-acquisition/youtube-download-commands.sh` | Pass | Generated YouTube command file parses cleanly |
| `npm run validate:kiosk` | Pass | 0 strict wall failures; 111/111 primary images wall-ready; 111/111 primary images kiosk-ready |
| `npm run validate:media-clearance` | Expected fail | 94 strict full-media failures; 0 schema errors; 261 warnings |
| `npm run launch:readiness:strict` | Expected fail | 6 passing gates; 3 blockers; 2 warnings |
| `npm run launch:readiness` | Blocked status | Same 3 launch blockers; exit 0 report refresh |
| `npm run build:public` | Pass | TypeScript and kiosk production build completed |
| `npm run build:portal` | Pass | TypeScript and portal production build completed |
| `npm run validate:offline` | Pass with warning | 111 profiles; 0 relationships; 1112 local asset references; 1204 remote media references |
| `node --check` across `scripts/*.js` | Pass | All JavaScript scripts parse cleanly |
| `npm run test:portal` | Pass with localhost permission | Playwright portal suite passed 2/2 |
| `npm run test:kiosk` | Pass with localhost permission | Playwright kiosk suite passed 36/36 |
| `git diff --check` | Pass | No whitespace errors |

## Current Readiness Snapshot

| Area | Current state |
| --- | --- |
| Profiles | 111 total |
| Class-year range | 2010-2026 |
| Regions | 5 |
| Nationality/heritage labels | 38 |
| Curated records | 111 draft, 0 final-approved |
| Core profile copy | 666/666 text fields pass as-is |
| Profile-level text readiness | 111 pass as-is, 0 minimal edits, 0 editorial review |
| Visitor-facing text fields | 1221 pass as-is; 112 optional polish; 64 minimal edit; 0 needs edit; 157 not applicable |
| Story summaries | 111 pass as-is |
| Story highlights | 111 pass as-is; 0 truncation flags |
| Life + Work summaries | 111 pass as-is |
| Full biographies | 111 pass as-is |
| Image alt text | 111 pass as-is; 0 generic placeholders |
| Pronunciation | 1 filled; 110 missing as optional polish |
| Theme tags | 111 approved/tagged |
| Community tags | 111 approved/tagged |
| Country/heritage tags | 109 tagged; 2 not-applicable/local-community exceptions |
| Primary images | 111/111 local wall-ready |
| Primary image kiosk approval | 111/111 |
| Image rights approval | 1110/1110 image assets approved |
| Gallery images | 999 total; 999 localized/kiosk-approved; 0 remote-only |
| Local image files | 1111 files in `public/media/images`; about 100M |
| Video coverage | 64 profiles with video references; 47 without video; 94 video items |
| Video kiosk readiness | 0/94 |
| Video local files | 7 video profiles still missing local file paths/files |
| Video posters/captions/transcripts | 94/94 still missing final poster, caption, and transcript approval paths |
| Generated entity graph | 451 entities; 1948 generated relationships |
| Explicit curated TRACES relationships | 0/30 target |
| Physical wall positions | 0/111 |
| Story infrastructure | 3 story sections; 6 story lenses; 11 WRHS/archive leads |

## Cleanup Checks Now Clear

| Cleanup check | Count |
| --- | ---: |
| Generic primary alt-text template | 0 |
| Non-external generic image alt text | 0 |
| Bio starts with duplicated scraped name | 0 |
| Bio temporal wording | 0 |
| Display name class-year artifact | 0 |
| Bio contact/address-like text | 0 |
| Life + Work summary flags | 0 |
| Story highlight truncation flags | 0 |
| Story summary flags | 0 |

## Remaining Queues

| Queue | Count | Notes |
| --- | ---: | --- |
| Profile approval draft records | 111 | Text is mechanically passable; curator approval still required |
| Accessibility review needed | 111 | Includes pronunciation/image-description/video accessibility workflow |
| Image rights review | 0 | All 1110 image assets now have approved image-rights status |
| Primary image kiosk approval | 0 | 111/111 primary portraits are kiosk-ready |
| Gallery image localization | 0 | All 999 gallery images are localized and kiosk-ready |
| Physical wall positions | 111 | Needs measured panel/row/column or coordinate source of truth |
| Relationship review queue | 101 profiles | Promote only reviewed relationships to explicit TRACES data |
| Explicit TRACES relationships | 30 needed | Current explicit relationship count is 0 |
| Organization review queue | 105 profiles | Useful for curator source review and relationship selection |
| Pronunciation missing | 110 | Optional polish; queue is in `artifacts/pronunciation-collection-queue.csv` |
| Video rights/caption/transcript readiness | 64 profiles / 94 videos | Remaining full-media strict failures are video-only |
| No video linked | 47 profiles | Not a launch blocker under current policy |
| Place review queue | 39 profiles | Treat as source leads, not migration-direction facts |
| Profile alias/duplicate source review | 13 profiles | Original-site source cleanup queue |
| Archive leads staff-only | 11 | Keep out of visitor-facing display until staff selects and clears items |
| Country/heritage local-community exceptions | 2 | Text readiness treats Jim Foster and Dick Pogue as not applicable; non-external review still surfaces them for relationship-focused review |
| Display name life dates | 1 | Helen Karpinski remains a minor optional-polish identity label case |

## Launch Gates

| Gate | Status | Actual | Target |
| --- | --- | ---: | ---: |
| Profile text populated | Pass | 111/111 | 111/111 |
| Curated records approved | Blocker | 0/111 | 111/111 |
| Curated metadata valid | Pass | 0 errors | 0 errors |
| Primary images wall-ready | Pass | 111/111 | 111/111 |
| Primary images kiosk-ready | Pass | 111/111 | 111/111 |
| Approved video policy | Pass | 0/0 approved videos ready | all approved videos ready |
| Explicit TRACES relationships | Blocker | 0 | 30 |
| Physical wall positions | Blocker | 0 | 111 |
| Story section depth | Pass | 3 | 3 |
| Remote media references | Warning | 1204 | 0 |
| Caption/transcript review | Warning | 0/94 | 94/94 |

## Kiosk Browser Fix Verification

| Test | Fix | Verification |
| --- | --- | --- |
| `tests/cleveland-trace-language.spec.ts:62` | Lowered the TRACES information panel below emphasized related portraits while preserving the open chooser as the top interactive layer. | Targeted Playwright passed; full `npm run test:kiosk` passed 36/36 |
| `tests/portrait-frame-system.spec.ts:41` | Updated the frame-state interaction path to dismiss carried LEGACIES focus before using class-year controls, then jump to the target class year before clicking the portrait. | Targeted Playwright passed; full `npm run test:kiosk` passed 36/36 |

## Highest Priority Records

The non-external review now lists 2 highest-priority cleanup/approval records:

| Record | Main next action |
| --- | --- |
| Dick Pogue | Review relationship evidence and labels |
| Jim Foster | Review relationship evidence and labels |

## Recommended Next Move

1. Start approval batching from the text-readiness report: all 111 profiles are mechanically passable now, so curator review can move in clean batches.
2. Run the remaining launch-blocker lanes in parallel: 111 profile approvals, 30 explicit TRACES relationships, and 111 physical wall positions.
3. Keep video work behind the approval wall: 64 video profiles need rights, local files where missing, posters, captions, and transcripts before any video should be enabled.
4. Treat pronunciation and archive leads as polish/source-review queues unless the installation team decides they are required for opening.
5. Keep kiosk Playwright in the daily confidence loop now that the full suite is green again.

The project is no longer blocked by basic content cleanup, primary image approval, or gallery image localization. Browser confidence is currently green; the month-end risk is now profile approval throughput, relationship curation, video/media polish, and physical installation mapping.
