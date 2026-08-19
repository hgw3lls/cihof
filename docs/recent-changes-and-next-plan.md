# Recent Changes Since Monday And Next Update Plan

Date range: Monday, August 17, 2026 through Wednesday, August 19, 2026.

Last updated after commit `656c11f Add kiosk build identity metadata`.

This document summarizes what has been completed since Monday, what should come next, and the best screen-only state-of-the-art ideas for turning the CIHOF experience into a permanent museum-grade wall-mounted touchscreen surrounded by physical portrait frames.

## Executive Summary

Since Monday, the project moved from a broad React/Vite collection browser into a portrait-first museum kiosk and staff portal system. The public experience now centers on a museum portrait wall, person-scale stories, relationship browsing, Cleveland places, tactile timeline navigation, interpretive journeys, touchscreen search, attract mode, and future physical wall integration hooks.

The operational side also advanced. The public kiosk and staff portal now build as separate entry points, the local portal runner is token-gated, portal apply is safer, kiosk health is published, Playwright smoke tests exist, media readiness has stricter gates, the viewport is locked for touchscreen installation use, and every build now emits build identity metadata.

The largest remaining gaps before a permanent installation are offline packaging, full media clearance, accessibility validation, a support/watchdog runbook, deeper curator editing tools, and a longer hardware burn-in process.

## What Was Completed Since Monday

### Public Kiosk And Navigation

- Reworked the visitor app around a museum shell rather than a dashboard shell.
- Replaced top-level dashboard navigation with restrained bottom navigation:
  - All People
  - Time
  - Places
  - Journeys
  - Search
- Removed broad continental Regions from primary navigation.
- Made All People the portrait-first home view.
- Added a portrait wall visual system that better matches surrounding framed portraits.
- Added large touch targets, selected states that do not depend on hover, and fallback portrait states.
- Preserved kiosk mode, reset behavior, media stop behavior, and attract mode behavior.
- Locked the browser viewport so the main window does not scroll; views now scroll inside the app frame.
- Preserved internal scroll position when opening and closing person views.

Related commits:

- `335da1d` Build museum kiosk experience
- `cdbb850` Lock kiosk viewport scrolling

### Person View, Stories, Media, And Relationships

- Replaced the drawer-style profile with a museum-scale person view.
- Added a large portrait identity area, class year, country/community label, story summary, theme tags, and action rail.
- Added `WHO THEY CONNECT TO` relationship previews with portrait cards, labeled reasons, and provenance.
- Added relationship metadata support for documented, curated, and inferred relationships.
- Added relationship types such as same class, shared theme, shared organization, shared community, mentor, colleague, family, related place, and related event.
- Added Six Degrees of Cleveland connection finding through people, organizations, communities, places, events, and themes.
- Added Their Story mode with narrative beats instead of long biography walls.
- Added a dedicated media experience with local media preference, YouTube fallback outside kiosk mode, image galleries, captions/transcripts status, and empty states.
- Added story lenses and connection theater concepts that reorganize people around interpretive prompts.

Related commits:

- `a3a5f3c` Add story lenses and connection theater
- `a6854cd` Add portal relationship curation

### Entity And Relationship Data Model

- Expanded the runtime from person-only data into an entity-and-relationship model.
- Added entities for:
  - Person
  - Community
  - Place
  - Organization
  - Event
  - Theme
  - Media
- Added separate generated entity relationship data.
- Preserved the existing inductee import pipeline through adapters.
- Added validation for entity IDs, relationship endpoints, provenance, valid relationship types, and orphaned references.

### Places, Timeline, Journeys, And Search

- Replaced Regions with a Cleveland-centered Places view.
- Added manually curated place support for neighborhoods, cultural centers, churches, schools, civic buildings, Cultural Gardens, businesses, festival locations, community organizations, and historically significant addresses.
- Redesigned Timeline into a horizontal chronological portrait experience.
- Added decade jumps, previous/next year controls, larger active year display, and Then/Now comparison.
- Fixed timeline end navigation so 2026 and edge years are easier to reach.
- Redesigned Journeys around interpretive questions instead of generic categories.
- Added prompt-led journeys such as who built Cleveland, who helped people arrive, who kept cultures alive, and how a city remembers.
- Redesigned Search for touchscreen use with on-screen keyboard, quick prompts, and large portrait rows.

Related commits:

- `8d6fc00` Fix timeline year selection
- `8de2a23` Improve timeline end navigation

### Attract Mode And Physical Wall Readiness

- Added attract mode that cycles through portrait grid, featured person, historic place, connection chain, journey prompt, and interpretive/stat line.
- Added idle warning before reset.
- Added touch-to-exit attract mode.
- Added optional physical wall metadata:
  - physical row
  - physical column
  - physical panel
  - wall label
  - wall coordinates
  - physical portrait present
- Added `onPhysicalPortraitSelected(personId)` as a no-op/console abstraction for future LED, DMX, Art-Net, serial, or local network lighting integration.
- Added optional physical wall sort/layout support for the digital grid.

### Country Metadata

- Added country tags in addition to broad regions.
- Added country-aware browsing/filtering labels.
- Inferred missing country coverage from available profile text and metadata.
- Current runtime data has country coverage for all 111 profiles.

Related commits:

- `6cb45db` Add country metadata browsing
- `63e71de` Complete inferred country metadata

### Staff Portal And Local Runner

- Built out the Review/Edit staff portal dashboard with work queues, local browser drafts, editable metadata fields, validation warnings, JSON/CSV export, and import/export workflows.
- Added a local-only portal runner so staff can trigger whitelisted scripts from the portal.
- Added runner controls for data prep, reports, validation, audit, builds, metadata generation, media manifest generation, media localization, and 2026 import.
- Split public visitor app and staff portal into separate HTML/build entry points.
- Added token enforcement for the local runner.
- Gated external runner access so the runner stays local/trusted.
- Added persistent `.portal/jobs/` runner logs.
- Added runner status for repo root, branch, commit, dirty state, upstream sync, and last successful validation/build.
- Added a safer portal apply gate requiring a fresh successful dry run before real apply.
- Added portal editing for story lenses and approved relationship records.
- Documented the local portal runner workflow.

Related commits:

- `896c771` Add staff portal runner controls
- `d3e99c3` Split kiosk and portal builds
- `9ab896b` Gate external portal runner access
- `b11b8c7` Harden portal runner access
- `79ec523` Add portal runner repo status
- `eae81b2` Add safe portal apply gate
- `b348551` Make story lenses editable in portal

### Deployment, Validation, And Kiosk Hardening

- Added and adjusted GitHub Pages workflow support.
- Confirmed production base path uses `/cihof/`.
- Public GitHub Pages deployment uses the visitor entry; staff script-running remains local-only.
- Added a global museum-friendly error boundary.
- Added kiosk health heartbeat and runtime status publishing through `window.__CIHOF_KIOSK_STATUS__` and local storage when available.
- Added Playwright kiosk smoke tests for:
  - portrait wall loading
  - health status publishing
  - viewport scroll lock
  - bottom navigation
  - person view and reset
  - idle reset into attract mode
- Added stricter wall-build media validation.
- Split media validation into wall-readiness and full media-clearance profiles.
- Prevented visitor-facing runtime data from relying on external image URLs when local manifest images exist.
- Gated local media display by approval/caption/transcript readiness.
- Added build identity metadata to the Vite build.
- Kiosk and portal builds now emit `data/build-info.json`.
- Kiosk health now includes matching build info, including build target, app version, commit, branch, base path, output directory, and build time.

Related commits:

- `4fe02ae` Update GitHub Pages actions
- `8cbba73` Add kiosk health and smoke tests
- `53fbe0a` Harden kiosk media readiness gate
- `cdbb850` Lock kiosk viewport scrolling
- `656c11f` Add kiosk build identity metadata

## Current Known State

- Runtime people coverage: 111 inductees.
- Year range: 2010 through 2026.
- Country coverage: 111 of 111 profiles have country tags.
- Primary images: 111 of 111 profiles have primary image paths.
- Runtime video flag: 64 profiles have video according to generated data.
- Entity validation currently reports 0 errors and 0 warnings.
- Public kiosk and staff portal are separate build targets.
- GitHub Pages deploys the public visitor build successfully.
- Latest deployed commit at this update: `656c11f`.
- `npm run build:kiosk` passes.
- `npm run build:portal` passes.
- `npm run test:kiosk` passes with 5 Playwright smoke tests.
- Kiosk build emits `dist/data/build-info.json`.
- Portal build emits `dist-portal/data/build-info.json`.
- Wall media validation passes for current wall-ready rules.
- Full media clearance is still not museum-complete: rights approvals, captions, transcripts, posters, and kiosk approvals still need curator/media work.
- GitHub Pages remains useful for web preview, but the final museum installation should run from a local/offline package, not from public web hosting.

## Risks To Address Before Permanent Installation

1. Offline packaging is not complete yet; no service worker/local app-shell cache has been added.
2. Full media clearance is not complete: captions, transcripts, posters, rights, and final kiosk approval still need a dedicated pass.
3. The Playwright suite exists, but it is still a smoke suite; it needs broader coverage and visual regression checks.
4. No OS/browser watchdog or museum hardware recovery script has been implemented yet.
5. No 72-hour burn-in test has been run on the actual target hardware.
6. Accessibility needs a dedicated automated and manual review pass.
7. The review dashboard component is large and should be split before more portal features are added.
8. Generated and inferred metadata needs continued curator approval boundaries.
9. Physical wall coordinate support exists, but final wall position data has not been mapped.
10. Build identity exists, but release packaging still needs checksums, offline asset validation, and rollback instructions.

## What Comes Next

### Phase 1: Finish Public Kiosk Hardening

Priority: highest.

Completed in this phase:

- Public kiosk and staff portal are separated by build target.
- Kiosk/admin controls are hidden from visitor mode unless explicitly configured.
- Global error boundary exists.
- Health heartbeat exists.
- Starter Playwright kiosk smoke suite exists.
- Main viewport is locked and internal view scrolling is supported.
- Build identity metadata exists.

Next work:

- Add a scheduled reload/restart strategy for unattended operation.
- Add local static package instructions separate from GitHub Pages.
- Add a browser/OS kiosk runbook for disabling address bar, downloads, printing, devtools, notifications, sleep, screen dimming, and system prompts.
- Add a support runbook for forced reset, power loss, browser crash, stale data, media failure, and staff exit procedure.
- Add a hidden diagnostics screen showing build info, data counts, media readiness, browser info, uptime, reset count, last error, and local storage health.

### Phase 2: Offline Installation Package

Priority: highest.

- Add service worker or equivalent local static cache strategy.
- Precache app shell, runtime JSON, core images, and kiosk-safe media manifests.
- Add `validate:offline` to confirm all required local assets exist.
- Add checksum reporting for runtime JSON and media manifest.
- Add a packaged release folder separate from development, GitHub Pages, and staff portal output.
- Add rollback instructions for staff.
- Prove the kiosk loads after disconnecting the network.

### Phase 3: Museum Media Readiness

Priority: high.

- Finish local media packaging and validation.
- Add poster images for every playable local video.
- Add captions for all public video.
- Add transcripts for all video/audio where available.
- Mark image/video/audio rights and approval status explicitly.
- Keep kiosk build blocked when unapproved media would be exposed.
- Add a media health dashboard in the portal.
- Add curator-facing queues for missing poster, missing captions, missing transcript, rights unknown, and approval pending.

### Phase 4: Portal Editability And Curation Depth

Priority: high.

- Split the portal into smaller modules:
  - runner client
  - draft store
  - CSV builder
  - validation helpers
  - workbench UI
  - readiness UI
  - export/apply UI
- Add dedicated editors for:
  - country/community metadata
  - story beats
  - relationship reasons
  - media approvals
  - physical wall positions
  - journey membership/order
- Add a curator approval state for every visitor-facing generated or inferred field.
- Add provenance-aware review queues so staff can separate documented facts from inferred suggestions.

### Phase 5: Accessibility And Touchscreen Verification

Priority: high.

- Add automated accessibility checks to CI or local validation.
- Add manual keyboard and screen-reader notes for the core flows.
- Add high-contrast/reduced-motion/larger-text accessibility mode.
- Confirm every core visitor path works without hover and without a physical keyboard.
- Check touch target sizes and focus states at 1920x1080.
- Add visual/screenshot regression checks for overlapping text, bottom nav usability, and portrait grid layout.
- Review production copy/selection blocking so it does not interfere with assistive technology.
- Document physical mount accessibility assumptions: reach range, glare, wheelchair approach, and clear floor space.

### Phase 6: Broader Automated Testing

Priority: high.

- Expand Playwright coverage for:
  - Timeline first year and 2026/current-year navigation
  - Search prompt selection and on-screen keyboard input
  - Person action rail
  - media stop on navigation/reset
  - Six Degrees path and no-path states
  - staff portal route disabled in public build
  - build-info artifact availability
  - Places marker selection
  - Journey start, next, previous, exit
- Add tests for reset from every major mode.
- Add a test that public kiosk build does not import the review dashboard bundle.

### Phase 7: Physical Wall Integration Readiness

Priority: medium.

- Create a wall-position editor in the portal.
- Add calibration mode for row/column/panel mapping.
- Add a staff-only wall debug overlay.
- Add a simulator panel for future lighting behavior.
- Keep hardware control out of the app until the museum selects hardware.
- Prepare adapter options:
  - no-op console logger
  - local WebSocket bridge
  - serial bridge
  - DMX/Art-Net bridge
  - local network controller

## State-Of-The-Art Screen-Only Ideas

These ideas do not require external hardware, cameras, sensors, cloud AI, or live internet. They can run entirely on the touchscreen using local data, approved media, and generated/curated metadata.

### 1. Living Portrait Wall

The default wall subtly reorganizes around a visitor's path. After a visitor taps a person, the wall can gently highlight related people by class, country, community, theme, organization, or place. The interaction should feel like the physical wall is responding, not like a dashboard filter.

Why it matters: it makes the surrounding physical portrait wall feel digitally alive while staying portrait-first.

### 2. Guided Story Lenses

Add big interpretive prompts that temporarily reshape the wall:

- Who built Cleveland?
- Who helped people arrive?
- Who kept cultures alive?
- Who changed the city?
- What survives migration?
- Who spoke for their community?
- How does a city remember?

Each lens could show a curated lead person, a small set of related portraits, one place, one organization, and one line explaining the interpretive idea.

Why it matters: visitors do not need to know names before discovering stories.

### 3. Connection Theater

Turn Six Degrees of Cleveland into a dramatic step-by-step sequence. The screen shows Person A and Person B at opposite sides, then reveals each connection one at a time with portrait, place, organization, or community cards.

Rules:

- Prefer documented and curated relationships.
- Label inferred paths clearly.
- Never fabricate a link.
- Keep paths short and readable.

Why it matters: relationships become a museum experience, not a data visualization.

### 4. Then And Now Time Machine

Expand Timeline's Then/Now mode into a visual class comparison:

- earliest class beside newest class
- portrait groups
- theme distribution
- country/community distribution
- how media coverage changed
- what kinds of civic work repeat across time

Why it matters: it gives visitors a simple way to understand the Hall of Fame as a living institution.

### 5. Cleveland Memory Map

Use the local Places view as a story map rather than only a map. Tapping a place can show:

- who connects to it
- what communities used it
- what events happened there
- what organizations lived nearby
- one archival image if available

Why it matters: it roots immigrant stories in Cleveland streets, neighborhoods, churches, gardens, schools, and civic buildings.

### 6. Find This Portrait On The Wall

When a person is selected, the screen can show the physical panel, row, and column and visually indicate where the real portrait is located. If exact wall coordinates are unavailable, the app can show "wall position not mapped yet" rather than guessing.

Why it matters: it directly connects digital exploration to the framed portraits around the touchscreen.

### 7. Curated Docent Playlists

Create short guided sequences that feel like a docent path:

- New Arrivals
- Cultural Gardens
- Women Who Built Institutions
- Civic Cleveland
- Medicine And Care
- Class of 2026
- One Neighborhood, Many Communities

Each step should have one sentence explaining why it follows the previous step.

Why it matters: it gives the installation a human curatorial voice.

### 8. Daily Lens Rotation

Attract mode can choose a daily theme from local metadata:

- today in Cleveland memory
- a country/community focus
- a class-year anniversary
- an institution-building theme
- a place-based prompt

Why it matters: repeat visitors and staff see freshness without needing live content.

### 9. Shared And Different Comparison

Let visitors compare two people:

- shared class, place, community, theme, or organization
- different generation or path
- side-by-side portrait and story beats
- "what connects them" and "what makes each story distinct"

Why it matters: comparison is intuitive on a large shared screen and useful for families, docents, and classrooms.

### 10. Accessible Deep Mode

Add a large-text, high-contrast, reduced-motion mode with simplified navigation and stronger progress cues. Keep it beautiful, not medical-looking.

Why it matters: state-of-the-art museum interactives are not only visually advanced; they are easier for more people to use.

## Recommended Immediate Next Five Tasks

1. Build the offline installation package foundation: service worker or static cache, `validate:offline`, and a packaged release folder.
2. Add a diagnostics screen that exposes build info, health heartbeat, data counts, media readiness, last error, and reset count.
3. Expand Playwright coverage to Timeline edge years, Search, Places, Journeys, media stop/reset, and Six Degrees.
4. Start the full media clearance workflow: posters, captions, transcripts, rights approval, and kiosk approval.
5. Add the first state-of-the-art screen-only interactive: either Connection Theater polish or Find This Portrait On The Wall.

## Practical Museum-Ready Release Standard

The project should not be considered museum-ready until:

- public kiosk build has no staff/admin entry point;
- kiosk build passes automated tests at 1920x1080;
- app can load without internet;
- idle reset and watchdog recovery are proven;
- all visible media has rights status and kiosk approval;
- videos have captions/transcripts or approved empty states;
- YouTube and external links are disabled in kiosk mode;
- staff can update data through a documented local workflow;
- there is a rollback path for the installed build;
- build identity and diagnostics are visible to staff;
- physical wall metadata has been mapped or intentionally disabled;
- accessibility review is completed;
- a 72-hour hardware burn-in passes without blank screens, uncaught errors, memory growth, or media failures.
