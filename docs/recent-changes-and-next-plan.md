# Recent Changes Since Monday And Next Update Plan

Date range: Monday, August 17, 2026 through Wednesday, August 19, 2026.

This document summarizes the major project changes completed since Monday and defines the next practical plan for updates, fixes, hardening, and additions. The target remains a permanent museum-grade wall-mounted touchscreen surrounded by physical portrait frames.

## Executive Summary

Since Monday, the project moved from a broad React/Vite collection browser into a portrait-first museum kiosk experience with a stronger data model, relationship browsing, touchscreen search, story/media modes, attract mode, physical wall metadata hooks, country metadata, and a staff portal dashboard with local script runner controls.

The public visitor experience is now directionally aligned with the physical portrait wall. The largest remaining gap is operational hardening: admin separation, offline packaging, media readiness, automated kiosk tests, deploy gates, and recovery tooling.

## Changes Completed Since Monday

### GitHub Pages Deployment

- Added and adjusted GitHub Pages workflow support for deploying the Vite build.
- Confirmed production base path uses `/cihof/`.
- Current deployment remains static and uses the public visitor entry. Staff portal editing now runs from the separate local portal entry because GitHub Pages cannot run repo scripts or write changes.

Related commits:

- `0a03e64` Deploy site to GitHub Pages
- `5ba639d` Fix GitHub Pages deployment workflow

### Museum Kiosk Experience

- Reworked the app around a museum shell rather than a dashboard shell.
- Replaced broad top navigation with restrained bottom navigation:
  - All People
  - Time
  - Places
  - Journeys
  - Search
- Removed Regions as a top-level destination.
- Added kiosk reset behavior, attract mode entry, reset warning, media stop/reset behavior, and content protection in production.
- Added a portrait-first All People wall intended to visually relate to surrounding framed portraits.
- Added selected portrait states, featured outlines, missing-media fallbacks, and physical wall sorting support.

Related commit:

- `335da1d` Build museum kiosk experience

### Person View And Relationships

- Replaced the drawer-style profile with a museum-scale person view.
- Added a large portrait identity area, class year, country/community label, story summary, theme tags, and action rail.
- Added `WHO THEY CONNECT TO` relationship previews with labeled reasons and provenance.
- Added support for relationship metadata types including inducted by, same class, shared theme, organization, community, civic collaboration, mentor, colleague, family, place, and event.
- Added Six Degrees of Cleveland connection-finding through relationship/entity paths.
- Kept generated or inferred relationships labeled so they are not presented as documented facts.

### Entity And Relationship Data Model

- Expanded from a person-only runtime into an entity-and-relationship model.
- Added entity support for:
  - Person
  - Community
  - Place
  - Organization
  - Event
  - Theme
  - Media
- Added separate generated relationship JSON.
- Added validation for entity IDs, relationship endpoints, provenance, relationship types, and orphaned references.
- Preserved the existing inductee import/preparation pipeline through adapters.

### Places, Timeline, Journeys, Story, Media, And Search

- Replaced Regions with a Cleveland-centered Places view using curated local place data.
- Redesigned Timeline into a tactile chronological portrait experience with year rail, decade jumps, previous/next year controls, and Then/Now comparison.
- Fixed timeline selection and end navigation issues so current years like 2026 are easier to reach.
- Redesigned Journeys around interpretive prompts rather than generic categories.
- Added Their Story mode with story beats instead of long biography walls.
- Added media experience for local video/audio, YouTube fallback outside kiosk mode, image galleries, captions/transcripts status, and empty states.
- Redesigned Search for touchscreen use with on-screen keyboard, quick prompts, large results, and filters for name, community, organization, place, theme, year, profession, and story keyword.

Related commits:

- `8d6fc00` Fix timeline year selection
- `8de2a23` Improve timeline end navigation

### Attract Mode And Physical Wall Hooks

- Added attract mode that cycles through:
  - portrait grid
  - featured person
  - historic place
  - connection chain
  - journey prompt
  - interpretive/stat line
- Added touch-to-exit attract mode.
- Added idle reset warning copy.
- Added optional physical portrait metadata:
  - physical row
  - physical column
  - physical panel
  - wall label
  - wall coordinates
  - physical portrait present
- Added `onPhysicalPortraitSelected(personId)` abstraction for future LED, DMX, Art-Net, serial, or network lighting integration.

### Country Metadata

- Added country tags in addition to broad regions.
- Added browsing/filtering labels that prefer country/community where available.
- Added inferred country coverage from existing source text and generated metadata.
- Current generated runtime data has 111 people, all with country tags, spanning 2010 through 2026.

Related commits:

- `6cb45db` Add country metadata browsing
- `63e71de` Complete inferred country metadata

### Staff Portal Dashboard And Local Runner

- Built out the Review/Edit staff portal dashboard with stronger work queues, local browser drafts, editable metadata fields, validation warnings, JSON/CSV export, and import/export workflows.
- Added a local-only portal runner so staff can trigger whitelisted scripts from the portal when running locally.
- Added runner controls for data prep, curation report, media validation, entity validation, kiosk validation, data audit, build, kiosk build, metadata scaffold regeneration, media manifest regeneration, media localization, and 2026 import.
- Added direct dry-run/apply flow for portal draft decisions.
- Split the visitor app and staff portal into separate HTML/build entry points so the public kiosk build does not import the review dashboard.
- Added default local runner token enforcement and persistent `.portal/jobs/` job logs.
- Added documentation for running the portal and runner locally.
- Added `.portal/` to `.gitignore` for local runner scratch files.

Related commit:

- `896c771` Add staff portal runner controls

## Current Known State

- Runtime people coverage: 111 inductees.
- Year range: 2010 through 2026.
- Country coverage: 111 of 111 profiles have country tags.
- Primary images: 111 of 111 profiles have primary image paths.
- Video flag: 64 profiles have video according to runtime data.
- Entity validation currently reports 0 errors and 0 warnings.
- Production build passed after the most recent portal runner work.
- Media readiness is not museum-complete yet: reports still show rights, captions, transcripts, posters, and kiosk approval work remaining.
- The GitHub Pages site is static and now uses the public visitor entry by default. Staff portal script-running and repo-writing features require the local portal entry plus the local runner.

## Risks To Address Before Permanent Installation

1. Staff portal and public kiosk now have separate entry/build targets, and the local runner now requires a portal token by default.
2. The local portal runner still needs fuller admin authentication if it will be used beyond a trusted staff machine.
3. GitHub Pages deployment currently builds the site but should become stricter before museum release.
4. No automated Playwright kiosk regression suite exists yet.
5. No service worker/offline app-shell cache exists yet.
6. No OS/browser watchdog has been implemented yet.
7. Media approval, caption, transcript, poster, and rights workflows are not complete.
8. The review dashboard component is large and should be split before more portal features are added.
9. Generated/inferred metadata exists and needs continued curator approval boundaries.
10. Physical wall coordinates are supported, but current generated data does not yet include final mapped positions.

## Next Update Plan

### Phase 1: Hardening The Public Kiosk

Priority: highest.

- Keep visitor kiosk and staff portal separated through explicit entry/build targets.
- Keep review/debug routes disabled in the public kiosk build.
- Keep kiosk/admin controls hidden from visitor mode unless explicitly configured.
- Add a global error boundary with a museum-friendly reset screen.
- Add a health heartbeat and local status file or endpoint for watchdog monitoring.
- Add a scheduled reload/restart strategy for unattended operation.
- Add browser-level kiosk runbook for disabling address bar, downloads, printing, devtools, notifications, sleep, screen dimming, and system prompts.
- Add clear local/offline deployment instructions separate from GitHub Pages.

### Phase 2: Portal Security And Editability

Priority: high.

- Keep `CIHOF_PORTAL_TOKEN` or generated per-session token enforcement in place for the local runner.
- Keep the portal UI sending the runner token with every request.
- Keep persistent job logs under a local ignored directory.
- Add a runner status panel that shows active repo root, branch, latest commit, dirty state, and last successful validation.
- Add a safer two-step apply flow:
  - dry run
  - review diff summary
  - apply
  - regenerate data
  - validate
  - build
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

### Phase 3: Museum Media Readiness

Priority: high.

- Finish local media packaging and validation.
- Add required poster images for every playable local video.
- Add captions for all public video.
- Add transcripts for all video/audio where available.
- Mark rights and approval status explicitly for every image/video/audio item.
- Block kiosk build when unapproved media would be exposed.
- Add a media health dashboard in the portal.
- Add graceful visitor-facing empty states for every missing media case.

### Phase 4: Offline Installation Package

Priority: high.

- Add service worker or equivalent local static cache strategy.
- Precache app shell, runtime JSON, core images, and kiosk-safe media manifests.
- Add build metadata:
  - app version
  - commit hash
  - data generated timestamp
  - media manifest checksum
  - build target
- Add a `validate:offline` script that confirms required assets exist locally.
- Add a packaged release folder for museum installation separate from development and GitHub Pages.

### Phase 5: Automated Touchscreen Testing

Priority: high.

- Add Playwright tests for:
  - 1920x1080 kiosk viewport
  - All People portrait selection and close
  - Time rail first/current year navigation
  - Search prompt selection and keyboard input
  - Person view action rail
  - Watch/Listen media stop on navigation
  - Six Degrees path/no-path behavior
  - Attract mode touch exit
  - Idle warning and reset
  - Staff portal route disabled in public build
- Add screenshot checks for overlapping text, bottom nav usability, and portrait grid layout.

### Phase 6: More Creative Visitor Experiences

Priority: medium.

- Add a "Find This Portrait On The Wall" mode using physical coordinates.
- Add a "Follow The Light" integration point for future LED/DMX highlighting.
- Add curated docent playlists:
  - Who Built Cleveland?
  - New Arrivals
  - Cultural Gardens
  - Women Who Built Institutions
  - Civic Cleveland
  - Class of 2026
- Add daily attract-mode themes.
- Add relationship-led prompts:
  - Same class, different paths
  - Same country, different generations
  - One neighborhood, many communities
  - One organization, many lives
- Add comparison moments between two inductees, two classes, or two communities.
- Add richer place stories with archival images and related people.

### Phase 7: Data And Curation Depth

Priority: medium.

- Move more inferred metadata into explicit curated metadata files.
- Add manually curated organizations, communities, places, and events.
- Build a relationship editor in the portal.
- Add provenance labels everywhere staff need them.
- Keep visitor-facing labels simple, but do not let inferred metadata read as documented fact.
- Add story beat coverage goals:
  - first pass: every profile has at least 3 clean beats
  - second pass: every featured profile has 5 to 8 curated beats
  - third pass: every journey profile has curated transitions

### Phase 8: Physical Wall Integration Readiness

Priority: medium.

- Create a wall-position editor in the portal.
- Add calibration mode for row/column/panel mapping.
- Add a debug overlay that can be toggled only in admin mode.
- Add a message adapter layer for future integrations:
  - console/no-op
  - local WebSocket
  - serial bridge
  - DMX/Art-Net bridge
  - local network controller
- Add a simulator panel so lighting behavior can be tested without hardware.

## Recommended Immediate Next Five Tasks

1. Add token authentication to the local portal runner.
2. Add persistent runner job logs and a status panel.
3. Add Playwright smoke tests for 1920x1080 All People, person view, timeline end years, attract mode, and media stop.
4. Make GitHub Actions run `validate:entities` and a stricter kiosk validation job before Pages deployment.
5. Start the media readiness pass: posters, captions, transcripts, rights approval, and kiosk approval status.

## Practical Release Standard

The project should not be considered museum-ready until:

- public kiosk build has no staff/admin entry point;
- kiosk build passes automated tests at 1920x1080;
- app can load without internet;
- idle reset and watchdog recovery are proven;
- all visible media has rights status and kiosk approval;
- YouTube/external links are disabled in kiosk mode;
- staff can update data through a documented local workflow;
- there is a rollback path for the installed build;
- physical wall metadata has been mapped or intentionally disabled.
