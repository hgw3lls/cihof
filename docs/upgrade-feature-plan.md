# CIHOF Upgrade Feature Plan

## Purpose

Upgrade the current CIHOF Explorer from a solid rebuild into a richer museum-grade kiosk and web experience. The next phase should use the existing 111 inductee records more intelligently, make discovery feel more guided and tactile, and harden the app for unattended large-screen use.

This plan builds on the current app, which already includes Explore, Timeline, Regions, Journeys, a detail drawer, URL state, kiosk mode, and attract mode.

## Current Baseline

- Data source: `data/cihof_kiosk_manifest.csv`
- Runtime data: `public/data/inductees.json`
- Data report: `public/data/data-report.json`
- Current collection: 111 inductees from 2010-2026
- Region distribution: Europe 63, Asia 30, North America 9, Africa 8, South America 1
- Media coverage: 111 primary images, 111 image galleries, 64 video records
- Known gap: 47 inductees have no linked video

## Product Goals

1. Help visitors discover people through more than search and filters.
2. Turn biography text into useful themes, relationships, and guided paths.
3. Make kiosk use feel obvious, responsive, and recoverable on a touchscreen.
4. Preserve the calm institutional visual language while adding more movement and depth.
5. Keep all improvements offline-friendly and data-driven where possible.

## Phase 1: Data Enrichment

### Add Derived Data Fields

Extend the prep pipeline so each inductee gets richer computed fields:

- `decade`: derived from `classYear`
- `hasVideo`: true when YouTube or local video exists
- `hasGallery`: true when more than one image is available
- `storySummary`: short display-safe summary generated from `bioText`
- `storyHighlights`: 2-4 short phrases pulled from the biography
- `themeTags`: normalized topics such as civic leadership, arts, business, education, medicine, law, faith, immigrant advocacy, diplomacy, cultural preservation, media, science, philanthropy
- `communityTags`: inferred community/culture terms when the source text supports them
- `relatedIds`: ranked related inductees by region, year, shared tags, and shared biography terms
- `mediaCompleteness`: image/video/gallery score for kiosk curation

### Improve Data Quality Reporting

Expand `data-report.json` with:

- counts by decade
- counts by theme tag
- media completeness distribution
- biographies below a minimum length
- profiles with weak or duplicate summaries
- inductees with unusually sparse relationship data
- image host/source counts
- video coverage by year and region

### Build a Curated Metadata Layer

Create a small editable file, likely `data/cihof_curated_metadata.json`, for human-owned upgrades that should not be inferred every run:

- featured status
- preferred display title overrides
- manually approved theme tags
- journey membership overrides
- image crop/focal point hints
- kiosk attract priority
- accessibility notes for media where needed

The prep script should merge curated metadata after parsing the CSV and before writing runtime JSON.

## Phase 2: Better Discovery Features

### Smart Explore

Improve Explore from a filtered grid into a discovery wall:

- Add theme chips generated from `themeTags`.
- Add quick filters for `With video`, `Recent classes`, `Featured`, and `Has gallery`.
- Add an active filter bar with one-tap removal.
- Add "Surprise me" to open a strong random profile weighted by media completeness and featured status.
- Add result grouping options: by year, region, or theme.
- Improve empty states with suggested filter resets.

### Relationship-Based Detail Drawer

Replace the current simple related logic with ranked relationship sections:

- Same class year
- Same region
- Shared themes
- Similar biography language
- Featured next stories

Each related card should explain the connection in one short label, for example `Shared theme: civic leadership` or `Class of 2024`.

### Dynamic Journeys

Keep the curated journeys, but add generated journeys from enriched data:

- Civic Builders
- Culture Keepers
- Newest Honorees
- Women Leaders
- Global Business and Diplomacy
- Science, Medicine, and Education
- Stories With Video
- Around the World in Cleveland

Generated journeys should still support manual overrides from curated metadata.

### Compare Mode

Add a kiosk-friendly comparison view for 2-3 selected inductees:

- portraits, years, regions, and summaries side by side
- shared and unique theme tags
- media availability
- quick handoff into full story detail

This is useful for docents, classroom use, and visitors browsing with others.

## Phase 3: Kiosk Interaction Upgrade

### Touch-First Navigation

Replace small text controls where practical with larger touch controls:

- icon-backed nav tabs
- persistent Back, Home, and Reset controls
- larger carousel arrows
- clear selected states on chips and cards
- bottom or side action rail on large kiosk displays

Target minimums:

- primary touch targets: 56px or larger
- secondary controls: 44px or larger
- no hover-only affordances
- no required keyboard interaction

### Attract Mode 2

Upgrade attract mode from a rotating profile into a richer passive loop:

- rotate between featured profiles, year highlights, region highlights, and journey prompts
- show a visible countdown or subtle progress indicator
- prioritize profiles with strong images and video
- avoid repeating the same region too often
- allow any tap to start, but route taps on a featured person directly to that story
- optionally support a `?kiosk=1&attract=1` launch URL

### Session Recovery

Make unattended use more robust:

- idle warning before reset, such as a 10-second "continue exploring?" prompt
- reset all transient UI: drawer, lightbox, filters, selected journey, scroll positions
- stop YouTube/video playback on reset or drawer close
- store kiosk preferences separately from visitor session state
- add a hidden maintenance gesture or URL flag for diagnostics

### Kiosk-Safe Media

Reduce external dependency risk during kiosk use:

- prefer local video files when present
- add poster images for video embeds
- lazy-load YouTube only after the visitor requests video playback
- suppress all external navigation in kiosk mode
- add media load failure tracking in UI state or diagnostics

## Phase 4: Timeline And Region Upgrades

### Timeline

Improve timeline as a historical exploration tool:

- decade rail above the year chips
- class-year overview showing counts and region mix
- jump to next/previous class year instead of only next/previous person
- "then and now" mode for newest versus earliest classes
- year detail panel with all inductees from the selected class

### Region View

The current region constellation is a good start. Improve it with:

- region detail panels with strongest stories, video count, and class range
- optional subregion/community tags from enriched metadata
- clearer proportional counts without making Europe visually dominate the whole view
- "region tour" that steps through representative inductees
- cross-filter links into Timeline and Explore

## Phase 5: Reliability And Verification

### Automated Checks

Add test and audit coverage around the highest-risk flows:

- data prep produces valid JSON matching the TypeScript shape
- all generated IDs are stable and unique
- all related IDs resolve
- all journey IDs resolve
- all theme tags are from an approved vocabulary unless marked custom
- kiosk reset clears state
- drawer navigation does not break at list edges
- videos are hidden or gated in kiosk mode as expected

### Browser Verification

Add Playwright coverage for:

- desktop viewport
- tablet viewport
- large kiosk viewport, such as 1920x1080
- touch-style interaction path: attract, start, filter, open detail, close, reset
- no overlapping text in major views
- no blank media areas for missing images

### Performance Targets

Keep the app fast with the full dataset:

- initial data load under 1 second on a local kiosk machine
- filter/search response under 100ms
- no layout shift when images fail
- detail drawer opens within one interaction frame after data is loaded

## Recommended Implementation Order

1. Extend data model and report with derived fields.
2. Add curated metadata merge support.
3. Replace related-inductee ranking with relationship reasons.
4. Add theme chips and quick filters to Explore.
5. Upgrade attract mode and kiosk reset behavior.
6. Improve video handling for kiosk safety.
7. Add generated journeys from tags and media availability.
8. Add Playwright kiosk smoke tests.
9. Upgrade Timeline year detail and Region tours.
10. Add Compare mode after relationship data is stable.

## First Sprint Scope

A practical first sprint should be data-heavy and low-risk:

- add `themeTags`, `storySummary`, `hasVideo`, `hasGallery`, `decade`, and `relatedIds`
- expand `data-report.json`
- add theme chips and quick media filters in Explore
- show relationship reasons in the detail drawer
- add a stronger kiosk reset that closes drawer, lightbox, journey state, and active media

This sprint turns the existing dataset into a better application substrate without requiring a visual redesign.

## Definition Of Done

An upgrade is done when:

- data generation is deterministic
- generated runtime JSON is validated before app build
- kiosk mode can be used for several minutes without dead ends or external navigation
- every major view has an obvious path back home
- each profile can lead to meaningful next stories
- missing videos are treated as a content state, not a broken state
- browser checks pass at desktop, tablet, and kiosk sizes
