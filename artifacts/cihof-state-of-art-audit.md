# CIHOF State-of-the-Art Audit

Generated: 2026-08-26

Scope: current `main` build at commit `2692c714309841e3c4f1ecd1b47aa3ff0933be13`, including the local kiosk build in `dist`, portal build in `dist-portal`, runtime data, Playwright suites, generated visual review screenshots, and a browser-level audit pass against the production kiosk preview.

No application code was changed for this audit.

## Executive Verdict

CIHOF is already strong as a custom museum-kiosk experience: it uses a persistent collection wall, real portraits, class years, story beats, trace relationships, places, staff curation workflows, idle recovery, reduced-motion controls, and tested kiosk/portal builds. Compared with current museum-interaction practice, its strongest state-of-the-art alignment is experiential: the wall behaves like a living collection surface rather than a website transplanted onto a screen.

The main gaps are operational and standards-oriented rather than visual. The app is not yet state-of-the-art for fully offline media, captions/transcripts, service-worker/PWA resilience, touch-target comfort at public scale, or cultural-data interoperability via CIDOC CRM / Linked Art / IIIF-style publication. These are fixable without redesigning the core Hall model.

## Evidence Run

- Kiosk build: passed, `dist`, commit `2692c7143098`, built `2026-08-26T03:27:17.183Z`.
- Portal build: passed, `dist-portal`, commit `2692c7143098`, built `2026-08-26T03:17:58.958Z`.
- TypeScript: passed before build/test flow.
- Kiosk Playwright suite: 25 passed in 3.1m against production preview.
- Portal Playwright suite: 2 passed in 7.1s against `dist-portal`.
- Data audit: 111 inductees, 5 regions, 36 countries, 0 duplicate IDs, 0 missing primary images, 47 videos missing.
- Entity validation: 443 entities, 1869 entity relationships, 0 errors, 0 warnings.
- Offline package validation: passed for `dist`, with warning that 1204 remote media references remain.
- Strict full media validation: failed by design/current readiness, with 1204 strict failures, 261 warnings, 111/111 primary images wall-ready, 0/111 primary images kiosk-ready, 0/94 videos kiosk-ready.
- Browser audit against production preview: no console errors, no page errors, no failed requests, no external requests in sampled kiosk states, all visible images loaded and had alt text.
- Reduced-motion browser audit: transition and animation durations collapsed to `1e-06s`; no runtime errors.

## Findings

### P1: Full Offline Media Is Not Yet State-of-the-Art

The wall package passes the current offline package check, but strict full media readiness fails: 1204 strict failures, 261 warnings, 0/111 primary images marked kiosk-ready, 0/94 videos kiosk-ready, missing local videos/posters/captions/transcripts, and rights review remaining across image/video material.

This is the clearest gap against modern museum digital expectations. A public installation can tolerate a curated wall-only offline package, but a state-of-the-art kiosk should have deterministic local media, poster frames, captions/transcripts, rights status, and a cache/update plan for every public playback path.

Primary files: `public/data/media-report.json`, `scripts/validate-media.js`, `scripts/validate-offline-package.js`.

Recommended remediation:

- Define a public-media readiness threshold distinct from staff lead inventory.
- Localize every video/poster used in WATCH, or hide non-local WATCH affordances until ready.
- Add captions/transcripts as release blockers for public video playback.
- Treat rights status as a first-class media gate in staff portal and build validation.

### P1: Touch Target Comfort Is Below Best Practice In Some Public States

The browser audit found no visible targets below 24 CSS px, which is good for WCAG 2.2 minimum target sizing. It did find several visible targets below the more comfortable 44 CSS px / 9mm public-touch range:

- Portrait focus actions: 42px high.
- Close / Return controls: 34px high.
- City question trigger: 34px high.
- Legacy jump controls: 34px high.
- TRACES muted portrait targets: 108 visible targets below 44px width in sampled trace states.

This is acceptable as a dense expert-like wall composition, but it is not yet best-in-class for public touchscreens used by older adults, visitors with tremor, visitors using knuckles/styluses, or children reaching across a large screen.

Primary files: `src/styles/final-exhibit/living-hall.css`, `src/styles/final-exhibit/hall-surface.css`, `src/features/living-hall/LivingHallView.tsx`.

Recommended remediation:

- Raise primary person/action/close/return controls to at least 44px height.
- For trace-field portrait buttons, either enlarge invisible hit areas to 44px minimum or make only emphasized portraits interactive and route muted portraits through a larger equivalent control.
- Preserve the visual density while separating visual frame size from touch hitbox size.

### P1: Video Accessibility Is Blocked By Missing Captions And Transcripts

The app has strong structural accessibility patterns, but strict media validation shows missing captions and transcripts across video assets. This matters more than decorative accessibility issues because WATCH is a core interpretive path and Smithsonian-style exhibition accessibility expects multiple modes of access.

Recommended remediation:

- Require caption and transcript availability before a video is marked public-ready.
- Show transcript status and fallback copy in the public WATCH panel when media is unavailable.
- Add tests for WATCH states with approved captioned media.

### P2: Offline Architecture Is Packaged, But Not PWA-Grade

The app has offline-aware error copy and the static `dist` package validates. The browser audit found `navigator.serviceWorker` supported but no active registration and no controlled page. Source search found service-worker diagnostics in admin but no service-worker registration.

For a locked-down local kiosk, a static package can be sufficient. For state-of-the-art web/phone continuity, staff portal resilience, or browser-launched installation recovery, a service worker plus cache strategy would align better with modern offline web architecture.

Recommended remediation:

- Add a versioned service worker for `dist` and `dist-portal` assets, with cache-first immutable assets and network-first JSON where appropriate.
- Expose cache/version health in the existing admin diagnostics.
- Keep kiosk asset updates explicit; avoid silent stale media in public installations.

### P2: Internal Cultural Graph Is Strong, But Not Interoperable Yet

The runtime bundle contains 443 entities and 1869 entity relationships with zero validation errors. That is a serious internal knowledge graph for a custom exhibit. The gap is that it remains app-specific: explicit public relationships are still 0, there is no Linked Art / CIDOC export, and media/images are not published as IIIF Presentation/Image resources.

Compared with current cultural-heritage data practice, CIHOF is doing the right thing conceptually by modeling people, places, themes, source leads, and provenance safeguards. It is not yet state-of-the-art for exchange, discoverability, or reuse outside this application.

Recommended remediation:

- Add a read-only export layer mapping people, places, organizations, events, source assertions, and relationship provenance to Linked Art/CIDOC-compatible JSON-LD.
- Treat uncertain/inferred relationships as attributed assertions, not public facts.
- Generate IIIF Presentation manifests for approved person media, or at minimum a compatible manifest-like structure with rights and attribution.

### P2: Visitor Continuity Is Good Per Person, But Not Yet Personal Collection-Level

The QR continuation panel is clear and functional for carrying one record to the website. State-of-the-art museum interactives often go further: they let visitors collect multiple objects/people, revisit a visit session later, or transfer a path from gallery to phone.

Recommended remediation:

- Add optional session-level collection: “saved people / traces from this visit.”
- Generate a single QR for the session path, not only individual profile URLs.
- Keep it anonymous and local unless the institution deliberately chooses account-based continuity.

### P2: Automated Accessibility Coverage Should Be Broadened

The app uses semantic buttons, ARIA labels, `aria-live`, focus-visible styling, reduced motion, idle recovery, and keyboard/hotkey paths. Playwright verifies many flows. There is not yet an automated axe-style accessibility gate or contrast/touch-target CI check.

Recommended remediation:

- Add automated accessibility scans for kiosk and portal key states.
- Add a Playwright target-size assertion for public controls.
- Add contrast checks for subdued trace text and muted labels against the warm field.

### P3: Performance Is Healthy, But Not Instrumented As Web Vitals

The production kiosk bundle is modest for an exhibit app: JS ~327.6 kB raw / 103.3 kB gzip, CSS ~276.7 kB raw / 39.6 kB gzip. Portal JS is ~375.0 kB raw / 109.2 kB gzip. Browser audit found no failed requests or external requests in sampled kiosk states.

The missing piece is measurement: there is no Lighthouse/Core Web Vitals CI budget. For a local kiosk this is less urgent than media and touch ergonomics, but it matters for the public portal and QR continuation experience.

Recommended remediation:

- Add Lighthouse CI or equivalent bundle/performance budgets.
- Capture LCP/INP/CLS for portal and phone-sized QR routes.
- Keep kiosk animation/frame timing measured on the actual touchscreen hardware.

## State-of-the-Art Comparison

### Museum Interaction And Visit Continuity

Cooper Hewitt’s interactive Pen/table ecosystem remains a useful reference pattern: large touch tables, high-resolution collection browsing, related objects by theme/motif, and a take-home visit continuation flow. CIHOF aligns with the collection-table model through persistent portraits, trace relationships, class chronology, and QR continuation. CIHOF is behind the leading pattern on multi-object visit memory and visitor-created/visitor-curated paths.

### Exhibition Accessibility

Smithsonian accessible exhibition guidance frames accessibility as a core exhibition design method, not a compliance layer. CIHOF aligns through reduced motion, semantic controls, multiple exploration modes, clear idle recovery, and staff settings. The shortfalls are physical touch sizing, media captions/transcripts, and the need for real touchscreen testing with diverse visitors.

### Web Accessibility

WCAG 2.2 added target size and dragging movement criteria. CIHOF clears the 24px minimum in the sampled browser states, provides non-drag legacy controls in addition to swipe, and handles reduced motion. For a public touchscreen, the better target is closer to 44px / 9mm; several public controls remain below that comfort threshold.

### Cultural Data Quality And Interoperability

Europeana, CIDOC CRM, Linked Art, and IIIF point toward high-quality metadata, rights statements, persistent identifiers, event/place/person modeling, and reusable image/presentation APIs. CIHOF has a good internal entity/relationship model and staff curation guardrails, but it does not yet expose a standards-aligned interchange layer or IIIF-style approved media manifests.

### Offline And Resilience

MDN’s PWA/offline guidance treats service workers as the basis for browser-grade offline and background operation. CIHOF’s static offline package passes for wall use, and sampled kiosk states loaded without network/external requests. The absence of a service worker and the 1204 remote media references keep it below state-of-the-art for resilient public web/portal deployment.

### Performance

web.dev Core Web Vitals focus on LCP, INP, and CLS. CIHOF’s bundle size and local production-preview behavior look healthy, but there is no Core Web Vitals/Lighthouse budget in CI. The application is likely performant enough on modern kiosk hardware; the missing state-of-the-art piece is continuous measurement.

## Recommended Roadmap

### Immediate

- Gate public WATCH on local media, captions/transcripts, posters, and rights readiness.
- Increase public controls and invisible hitboxes to 44px where possible.
- Add automated target-size and accessibility checks to Playwright.
- Preserve the current visual direction; do not reintroduce decorative archive graphics.

### Next

- Add service-worker/cache architecture with admin-visible cache health.
- Add Linked Art/CIDOC-compatible export for people, places, events, source assertions, and relationship provenance.
- Add IIIF-compatible manifests or manifest-like exports for approved person media.
- Add session-level QR continuation for saved people/traces.

### Physical Touchscreen Pass

- Validate reach, fatigue, swipe resistance, and target comfort on the actual museum screen.
- Test trace readability at expected viewing distance and with multiple simultaneous visitors nearby.
- Test reduced-motion and high-label-scale kiosk settings with older adults and low-vision users.

## Source Benchmarks

- W3C/WAI WCAG 2.2: https://www.w3.org/TR/wcag/
- W3C/WAI WCAG 2.2 new target size and dragging criteria: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- W3C/WAI target size understanding: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C/WAI reduced motion technique: https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html
- W3C mobile touch target guidance: https://www.w3.org/TR/mobile-accessibility-mapping/
- Smithsonian Guidelines for Accessible Exhibition Design: https://www.wbdg.org/ffc/smithsonian-guidelines-for-accessible-exhibition-design?from_agency=si&from_library=smithsonian-criteria
- Cooper Hewitt interactive visitor experience: https://www.cooperhewitt.org/new-experience/
- Cooper Hewitt Pen usage: https://www.cooperhewitt.org/exhibitions/using-the-pen/
- Europeana Publishing Framework: https://pro.europeana.eu/index.php/post/publishing-framework
- Europeana Publishing Guide: https://europeana.atlassian.net/wiki/spaces/EF/pages/2059763713/EPF%2B-%2BPublishing%2Bguide
- CIDOC CRM: https://cidoc-crm.org/
- Linked Art data model: https://linked.art/model/
- Linked Art 1.0 release: https://linked.art/about/1.0/
- IIIF API specifications: https://iiif.io/api/
- IIIF Image API 3.0: https://iiif.io/api/image/3.0/
- IIIF Presentation API 3.0: https://iiif.io/api/presentation/3.0/
- MDN Service Worker API: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- MDN offline/background PWA operation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- web.dev Core Web Vitals thresholds: https://web.dev/articles/defining-core-web-vitals-thresholds
