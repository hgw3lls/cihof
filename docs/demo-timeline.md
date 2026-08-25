# Demo Timeline Alignment

Updated: August 25, 2026.

This demo should be framed against the 2026 contract schedule:

- July 2026: kickoff, interface design, content review, and software architecture.
- August 2026: core software development and exhibition functionality.
- September 2026: content integration, testing, refinement, documentation, and client review.
- October 2026: final revisions, staff onboarding, and installation-ready delivery.

## Current Demo Position

The current app is best presented as a persistent Hall prototype moving into the September content-integration and review phase.

Demo-ready items:

- One public Hall surface with `PORTRAITS`, `TRACES`, and `LEGACIES`.
- `111` inductee records from 2010-2026.
- Primary image paths for every inductee.
- Persistent portrait frames that remain mounted across arrangement changes.
- Focused portrait overview with name, class year, documented context, and `HONORED FOR`.
- Anchored `LIFE + WORK`, `WATCH INDUCTION`, and `TAKE IT WITH YOU` actions.
- TRACES relationship/concept/place arrangement with guarded geography language.
- LEGACIES chronological horizontal arrangement by induction class.
- Hidden visitor admin for import/export, kiosk settings, access settings, and diagnostics.
- Separate staff portal at `portal.html`.
- Browser acceptance tests for persistent Hall flows, portrait frame states, admin access/settings, and portal readiness.

## Recommended Demo Flow

1. Open the visitor app in `PORTRAITS`.
2. Focus a portrait and show that the Hall remains visible.
3. Open `LIFE + WORK`, close it, and return to the same focused portrait.
4. Switch to `TRACES` and show the same focused frame becoming the relationship anchor.
5. Touch a related portrait and show the Hall re-index around that new anchor.
6. Switch to `LEGACIES` and show the same collection becoming the induction-class timeline.
7. Swipe horizontally through class years and focus another portrait in place.
8. Open hidden admin to show operational settings and diagnostics.
9. Open the separate portal to show where curation and source review live.

## Scope Boundaries

The current architecture is ready for content-integration review, but the content approval state is not complete.

Known production-readiness gaps:

- `0` public-approved profile summaries/context/HONORED FOR/Life + Work fields in curated metadata.
- Explicit curated relationship records still need expansion from source-derived candidates.
- Primary images are present, but kiosk-ready image/media approval and localization are not complete.
- Videos require rights, captions, transcripts, posters, and local/offline packaging before production kiosk use.
- Final hardware, accessibility, and burn-in testing are still installation-phase work.

Do not present old Explore, Timeline, Regions, Journeys, or detail drawer flows as the current public model. Those concepts have been folded into the persistent Hall lenses.
