# CIHOF Rebuild Plan

## Current Status Note

This is a historical rebuild plan from the pre-persistent-Hall phase. The current public visitor architecture is documented in `docs/current-architecture.md`.

The shipped public model is no longer Explore Wall, Timeline, Region Map, Journeys, and Detail as separate visitor views. The current model is one persistent Hall surface with three arrangement lenses:

- `PORTRAITS`
- `TRACES`
- `LEGACIES`

Legacy concepts from this plan have been mapped into the current architecture:

- Explore/search/home behavior maps into `PORTRAITS`.
- Connections, journeys, region, routes, and world behavior map into `TRACES`.
- Timeline behavior maps into `LEGACIES`.
- Inductee detail is now a focused condition of a persistent portrait frame.

Keep this document as historical product context only. Do not use it as the implementation source of truth for new visitor work.

## Goal

Create a new interactive Cleveland International Hall of Fame experience from scratch using the existing inductee data as the foundation. The product should work well as a kiosk, a large touchscreen display, and a standard web app.

## Experience Principles

- Lead with people: portraits, names, years, regions, and a short story preview should be visible immediately.
- Make browsing tactile: timeline, map, filters, search, and media should respond quickly and clearly.
- Keep the interface calm: museum/kiosk design, high contrast, readable typography, no marketing-style landing page.
- Support both casual discovery and directed search.
- Design for incomplete media: every inductee needs a strong fallback state when images or videos are missing.

## Core Data Model

Base the first schema on `data/cihof_kiosk_manifest.csv`.

Recommended normalized fields:

- `id`: stable slug from name and class year.
- `name`
- `classYear`
- `region`
- `profileUrl`
- `inductedBy`
- `primaryImageUrl`
- `imageUrls`
- `videoUrls`
- `youtubeVideoIds`
- `localImagePaths`
- `localVideoPaths`
- `bioText`
- `searchText`: derived field for search indexing.

## Primary Views

### 1. Explore Wall

A dense, visual grid of inductees with filtering and sorting.

Key interactions:

- Search by name, bio text, region, year, or inducer.
- Filter by region and class year.
- Sort by year, name, and region.
- Open a full detail panel without losing scroll position.

### 2. Timeline

A horizontal or vertical year-based journey through induction classes.

Key interactions:

- Scrub by year.
- Jump to decade.
- Show class counts per year.
- Compare regions represented in a selected year.

### 3. Region Map

A Cleveland-centered cultural map that groups inductees by region/community.

Key interactions:

- Select a region to reveal inductees.
- Show counts and representative portraits.
- Allow region-to-year cross-filtering.

### 4. Inductee Story Detail

A focused profile view for one inductee.

Key elements:

- Portrait or generated visual fallback.
- Name, class year, region, inducted-by line.
- Clean biography reading view.
- Image gallery.
- Video embeds or local video playback.
- Related inductees by region, year, or shared text themes.

## New Interactive Functions

Prioritize these for the first rebuild:

1. Fast faceted search across all inductees.
2. Timeline scrubber with year and decade navigation.
3. Region filter/map with live counts.
4. Rich inductee detail drawer/modal.
5. Media gallery with image and video fallbacks.
6. Saved kiosk state through URL params or local storage.
7. Keyboard/touch-friendly navigation.
8. Optional attract mode for unattended kiosk display.

Later enhancements:

- Theme/topic extraction from biographies.
- Relationship graph between inductees.
- Audio narration mode.
- Admin/import tool for updating the manifest.
- Offline media package validation.

## Technical Direction

Recommended stack for a fresh rebuild:

- Vite + React + TypeScript for the app shell.
- CSS modules or plain CSS with design tokens for predictable kiosk styling.
- Papa Parse or a small CSV parser for ingesting the manifest.
- Fuse.js or MiniSearch for local search.
- Framer Motion only if motion is purposeful and restrained.
- Playwright for viewport and kiosk interaction checks.

Suggested folders:

```text
src/
  app/
  data/
  features/
    explore/
    timeline/
    region-map/
    inductee-detail/
  components/
  styles/
public/
  data/
  images/
  videos/
```

## Data Prep Tasks

- Validate row count and required fields.
- Generate stable IDs.
- Normalize region labels.
- Strip generic site/social images from image lists.
- Extract YouTube IDs consistently.
- Detect missing primary images.
- Produce a clean `public/data/inductees.json` for runtime use.

## First Build Milestone

A useful first milestone should include:

- Data import pipeline from `data/cihof_kiosk_manifest.csv`.
- Explore grid.
- Search box.
- Region and year filters.
- Inductee detail panel.
- Basic responsive layout for desktop, tablet, and kiosk display.

## Design Notes

Use a restrained institutional visual language: crisp typography, strong spacing, high contrast, and meaningful media. Avoid decorative dashboards, oversized marketing heroes, and visual noise. The first screen should be the working experience, not an intro page.
