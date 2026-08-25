# CIHOF Recent Changes And Future Plan

Date range: Monday, August 24, 2026 through Tuesday, August 25, 2026.

This replaces the older August 17-19 status note and summarizes the latest architecture, data, portal, and admin work.

## Executive Summary

The visitor experience has been re-architected around one persistent Hall surface. Visitors are no longer moving between separate app pages such as Living Hall, Person, Connections, World, and Time. Instead, they are physically reorganizing one collection of honored lives through three readings of the same Hall:

- PORTRAITS
- TRACES
- LEGACIES

The staff/curation portal has been separated from the public visitor app. The main visitor screen now keeps only a hidden, password-protected admin panel for operational data import/export and kiosk settings. Deeper data review, editing, and curation lives in the separate portal app.

## What We Completed Since Monday

### Persistent Hall Architecture

- Created a persistent visitor Hall model based around `HallLens` and `HallFocus`.
- Kept the portrait collection mounted while the visitor changes arrangement modes.
- Replaced public page-style navigation with three arrangement controls: PORTRAITS, TRACES, and LEGACIES.
- Mapped legacy visitor URLs into the new model.
- Preserved staff/review mode separately rather than forcing it into the visitor architecture.
- Updated idle reset so it returns to PORTRAITS, clears focus/trace/place/time state, and resumes attract behavior without navigating to a separate attract page.

### PORTRAITS

- Made PORTRAITS the default public Hall lens.
- Removed public use of the label `Living Hall`.
- Reworked the default Hall as a contemporary physical Hall-of-Fame portrait wall.
- Touching a portrait now focuses the same frame in place instead of navigating to a Person page.
- Focus creates room around the selected frame and reveals concise adjacent context: name, class year, documented context, and HONORED FOR summary.

### Production PortraitFrame System

- Added a reusable CSS/SVG-built `PortraitFrame` primitive.
- Explicitly did not use generated PNG frame concepts as runtime assets.
- Supported the same keyed frame across STANDARD, FOCUS, TRACE, and LEGACY states.
- Added TALL and WIDE as aspect modifiers, not separate decorative frame systems.
- Added CSS custom properties for continuous animation between frame states.
- Added subtle deterministic PORTRAITS-only variation.
- LEGACIES straightens frame irregularities back to zero.

### TRACES

- Folded the visitor roles of Connections, Follow a Thread, World, and Routes into the same persistent Hall.
- TRACES keeps the focused person's persistent portrait frame as the anchor.
- Surrounding portrait frames reorganize into a restrained relationship field.
- Relationship lines connect the actual portrait frames rather than duplicate portraits.
- Unrelated portraits remain present but recede toward the perimeter/background.
- Touching a related portrait makes that exact frame the new focus, moves it to the anchor position, moves the old focus outward, redraws relationship lines, and remains in TRACES.
- Integrated conceptual traces and documented place anchors into the same Hall surface.
- Preserved geography safeguards: no invented relationships, no inferred migration stories, no assumption that every person is an immigrant, and no directional migration arrows unless direction is explicitly documented.

### LEGACIES

- Folded the visitor role of the old Time screen into the same persistent Hall.
- Existing frames animate into chronological order by real `classYear`.
- The Hall itself becomes the timeline.
- Frames are arranged in one or two long horizontal rows.
- Induction class/year labels are integrated into the same horizontal field.
- Added horizontal drag/swipe behavior and accessible non-drag chronology controls.
- Touching a portrait expands that same frame in place without leaving LEGACIES.
- Switching from focused LEGACIES to TRACES preserves the same person as the anchor.

### Focused Person Actions

- Reframed person detail as a focused condition of a portrait frame, not a destination.
- Focused overview now stays anchored to the Hall.
- LIFE + WORK opens as an adjacent reading area while part of the Hall remains visible.
- WATCH / WATCH INDUCTION opens as an anchored media area when approved media exists.
- WATCH is hidden when approved media is unavailable.
- TAKE IT WITH YOU opens QR continuation as a temporary anchored layer.
- QR close/auto-close returns to the same focused person and lens.
- Removed duplicate relationship browsing from person focus because TRACES is now the relationship system.

### Visitor Navigation And Interaction Cleanup

- Public global navigation now contains only PORTRAITS, TRACES, and LEGACIES.
- These controls are arrangement modes, not page destinations.
- Accessibility labels stay literal:
  - Arrange Hall by portraits
  - Arrange Hall by documented places and connections
  - Arrange Hall by induction history
- Reduced-motion behavior and transition input guards were preserved.
- Obsolete visitor modes are bypassed or mapped into the persistent Hall model instead of exposed publicly.

### Staff Portal Separation

- Split the public visitor app and staff portal into separate apps/entry points.
- The public visitor app no longer imports or renders the staff review dashboard.
- The portal runs separately at `portal.html`.
- The portal keeps source-data review and curation workflows.
- The public screen keeps only a hidden admin panel for operational kiosk tasks.

### One-File Runtime Data Bundle

- Added a one-file runtime data bundle at `public/data/cihof-runtime-data.json`.
- Updated the data preparation script to generate the runtime bundle.
- Runtime data loading now prefers the bundle and falls back to legacy files where needed.
- The hidden admin can export the current runtime data file, import a replacement runtime data file into the current browser, and return to built-in data.
- This supports a simple kiosk operator workflow without exposing the full curation portal on the public screen.

### Hidden Admin Settings

- Added a password-protected hidden admin panel on the visitor screen.
- Admin can open through `?admin=1`, a configured keyboard shortcut, or the hidden brand tap gesture.
- Added browser-local app settings:
  - number of portraits shown in PORTRAITS
  - portrait frame size
  - overall screen scale
  - Hall field inset
  - label scale
  - idle reset timing
  - idle warning timing
  - attract regroup timing
  - motion mode
  - show/hide touch cue
  - show/hide theme vocabulary
  - show/hide record texture
- Added configurable admin hotkey choices.
- Added local admin password change with current-password check, confirmation, and 8-character minimum.
- Admin password is stored in browser local storage only and is not included in exported data files.

### Original Site Data And Curation Direction

- Began consolidating original Cleveland International Hall of Fame site material into a source-data workflow.
- Preserved harvested/original-site material under the data area for review and pre-curation.
- Established the direction for using harvested material before manual curation:
  - parse profile text
  - identify names, class years, roles, summaries, images, and source URLs
  - separate documented facts from inferred or generated suggestions
  - preserve provenance for curator review
  - use the portal for review/edit workflows
- The current approach keeps generated parsing as a draft/review aid, not as automatically approved public interpretation.

### Validation And Smoke Tests

- Public visitor build passes.
- Separate portal build passes.
- Browser smoke verified:
  - hidden admin unlocks
  - PORTRAITS frame count setting changes the actual Hall
  - settings reset returns PORTRAITS to the full 111-frame collection
  - portal still renders separately
  - configurable admin hotkey works
  - old hotkey stops opening admin after a change
  - new admin password unlocks the panel

## Current Known State

- Public visitor model: one persistent Hall surface.
- Public lenses: PORTRAITS, TRACES, LEGACIES.
- Staff/curation portal: separate app.
- Runtime people count: 111 inductees.
- Primary image coverage: 111 profiles have primary image paths and 0 missing primary images.
- Duplicate ID count: 0.
- Generic image candidate count: 0.
- Runtime media data includes 94 video items.
- Kiosk-ready primary images: 0.
- Kiosk-ready videos: 0.
- Generated entity count: 443 entities.
- Generated entity relationship count: 1,869 relationships.
- Explicit curated relationship records currently remain a curation area to expand from source-derived candidates.
- Curated story section records currently remain limited and should be expanded through portal review.
- Curated metadata records exist for all 111 inductees, but public-approved context/HONORED FOR/Life + Work fields remain empty.
- Runtime bundle exists and is used as the preferred public data source.
- Hidden admin settings are browser-local kiosk settings, not canonical curation data.
- The architecture is ahead of the approved content. The next phase should prioritize curation and media readiness over new visitor features.

## What We Should Do Next

### 1. Finish The Data/Curation Pipeline

- Define the canonical authored data format that the portal should edit.
- Decide whether the portal writes one master JSON bundle directly or writes authored source files that compile into the runtime bundle.
- Build side-by-side source review for original CIHOF site content.
- Add profile-level edit screens for names, class years, context lines, HONORED FOR summaries, Life + Work sections, image metadata, media records, source URLs, and curator notes.
- Add provenance controls so every important public claim can be traced back to a source.
- Keep draft/generated suggestions clearly separate from approved public data.

### 2. Deepen Relationship And TRACES Curation

- Add relationship review/edit workflows in the portal.
- Add relationship provenance fields that curators can inspect and approve.
- Add direct relationship types where documented: family, colleague, mentor, collaborator, shared organization, shared community, shared event, and same induction class.
- Add curated conceptual traces such as education, civic service, cultural preservation, community organizing, arts, business, medicine, law, and faith/community leadership.
- Keep geography safeguards strict.

### 3. Expand Original-Site Harvest Use Before Manual Curation

- Parse every available original-site profile page into a structured draft record.
- Extract candidate summaries, honored-for language, organizations, communities, places, media embeds, images, and source links.
- Deduplicate repeated names, organizations, and places.
- Flag conflicts between existing data and harvested source text.
- Build a review queue that prioritizes profiles with the most missing fields.

### 4. Harden The Hidden Admin

- Add an access recovery path for operators if the local password is forgotten.
- Consider an optional environment/config reset code for museum staff.
- Keep the hidden admin limited to operational tasks: import/export data, kiosk settings, access settings, and diagnostics.
- Do not move profile curation back into the visitor app.
- Add a diagnostics section showing build version, active data source, profile count, media count, current lens, local storage status, last reset, and last runtime error.

### 5. Add Stronger Automated Tests

- Add Playwright acceptance tests for PORTRAITS focus/close, TRACES focus re-indexing, LEGACIES drag/focus, focused person actions, QR auto-close, idle reset, legacy URL mapping, and admin import/export/settings.
- Add visual regression screenshots for PORTRAITS, TRACES, LEGACIES, focus, and admin.
- Add fast-tap stress tests for lens switching.
- Add reduced-motion test coverage.

### 6. Prepare Offline / Installation Packaging

- Add an offline package flow for the museum kiosk.
- Precache the app shell, runtime bundle, approved images, and approved media.
- Add checksum reporting for the runtime data bundle and media manifest.
- Add a `validate:offline` script.
- Prove the visitor app loads without network access.
- Write installation runbook steps for hardware startup, browser kiosk mode, local server start, forced reset, data import, rollback, and recovery after power loss.

### 7. Finish Media Readiness

- Confirm which video/audio/image assets are approved for public kiosk use.
- Add poster images, captions, transcripts, rights status, and approval flags.
- Keep WATCH hidden unless approved media is available.
- Add portal queues for missing captions, missing transcripts, missing posters, unknown rights, media not localized, and approval pending.

### 8. Physical Portrait Integration

- Map final physical wall panel/row/column data.
- Connect physical portrait selection hooks to the final hardware strategy.
- Test possible integrations such as local network lighting, serial/USB controller, DMX/Art-Net bridge, and LED edge indicators.
- Keep the digital Hall aligned with the actual physical portrait environment.

### 9. Future Art-Direction Pass

- Do not do this before architecture and curation are stable.
- Once stable, refine Hall scale, frame density, line weight, place labels, chronology rhythm, archival texture, and physical-wall match.
- Keep the same persistent Hall architecture.

## Guiding Principle

The final visitor experience should not feel like navigating an app.

The visitor should feel they are standing at one Hall and changing how the honored lives are arranged, connected, and remembered.

PORTRAITS, TRACES, and LEGACIES are three readings of the same collection.
