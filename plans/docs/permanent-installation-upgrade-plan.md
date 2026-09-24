# Permanent Museum Installation Upgrade Plan

## Purpose

Upgrade the CIHOF Explorer from a functional prototype into a permanent museum installation that can run unattended on public hardware for years, with predictable maintenance, accessible visitor use, local media, and a locked-down runtime.

This plan assumes the current app remains a React/Vite static experience, but the delivery target changes from a web demo to an exhibit appliance.

## Installation-Ready Definition

The installation is ready when all of these are true:

- The app runs fully offline on target museum hardware.
- All visitor-facing media is locally bundled, licensed, captioned where applicable, and validated before release.
- The kiosk cannot navigate visitors outside the exhibit experience.
- Idle reset, crash recovery, power recovery, and staff diagnostics are proven on the real hardware.
- The UI and physical mount are reviewed against WCAG 2.2 AA intent and ADA reach/clearance requirements.
- Curatorial content has a recorded approval state.
- Staff can update, roll back, and troubleshoot the exhibit without developer intervention.
- A 72-hour burn-in test completes without blank screens, memory leaks, unhandled errors, or media failures.

## Current Baseline

The current project already has a strong application base:

- Static Vite + React + TypeScript app.
- One persistent public Hall surface with `PORTRAITS`, `TRACES`, and `LEGACIES` arrangement lenses.
- Persistent keyed portrait frames that stay mounted across arrangement changes.
- Focused person behavior anchored to a portrait frame instead of a full-screen public destination.
- Anchored `LIFE + WORK`, `WATCH INDUCTION`, and `TAKE IT WITH YOU` actions.
- TRACES arrangement for documented/curated relationships, story-lens concepts, and guarded geography references.
- LEGACIES horizontal chronological arrangement by induction class.
- Hidden visitor admin for operational data import/export, settings, access settings, and diagnostics.
- Separate staff portal at `portal.html` for curation and review workflows.
- URL-persisted Hall state for lens, focused person, timeline year, trace/place focus, kiosk mode, and admin access.
- Legacy public URLs mapped into the current Hall model.
- Data generation from `data/cihof_kiosk_manifest.csv` plus curated metadata, media, relationship, story, entity, physical-wall, and source-curation files.
- Generated `public/data/cihof-runtime-data.json` as the preferred runtime bundle, with split runtime files retained as fallbacks.
- 111 inductees from 2010-2026.
- 111 primary image paths and 0 missing primary images.
- 450 generated entities and 1,890 generated entity relationships.
- 64 profiles with video links, represented as 93 video items in media data.
- Kiosk mode, idle reset/attract behavior, media stop on reset, viewport lock, content protection, and runtime error handling.
- Browser acceptance tests for the persistent Hall, portrait frame system, hidden admin settings, portal readiness, and kiosk smoke behavior.

The main gaps are content approval, explicit curated relationship promotion, media approval/localization, installation operations, hardware lockdown, accessibility validation, and long-duration reliability testing.

## Standards And Benchmarks

Use these as practical acceptance references:

- WCAG 2.2, target Level AA for the software UI: https://www.w3.org/TR/WCAG22/
- W3C media accessibility requirements for captions, transcripts, and media controls: https://www.w3.org/TR/media-accessibility-reqs/
- ADA 2010 Standards for physical placement, clear floor space, reach ranges, and operable parts: https://www.ada.gov/law-and-regs/design-standards/2010-stds/
- U.S. Access Board ICT standards as a procurement benchmark for kiosks and software, even when not legally required: https://www.access-board.gov/ict/
- NIST Cybersecurity Framework 2.0 for operating risk management: https://www.nist.gov/cyberframework
- Microsoft Edge kiosk mode guidance if Windows is selected as the runtime platform: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode

## Upgrade Tracks

### 1. Exhibit Hardware And Runtime

Goal: make the app behave like a museum appliance, not a browser tab.

Recommended work:

- Select and document the target hardware: display size, resolution, touchscreen technology, PC/mini-PC, OS, mount, enclosure, speakers/headphones, network policy, and power behavior.
- Choose a supported kiosk runtime:
  - Windows 11 Pro/IoT with Edge assigned access, or
  - ChromeOS managed web kiosk, or
  - a managed Linux/Chromium kiosk image if museum IT supports it.
- Run the built app from a local static server or packaged local runtime, not from GitHub Pages.
- Add OS autologin into a restricted kiosk account.
- Launch directly into full-screen exhibit mode after power loss or reboot.
- Block downloads, printing, new tabs, address bar editing, browser settings, devtools, and external app launching.
- Allowlist only the local app origin and explicitly block all other URLs in kiosk mode.
- Disable sleep, display dimming during open hours, system notifications, update prompts, and browser prompts.
- Add scheduled after-hours reboot.
- Add watchdog recovery if the browser, local server, or display process exits.
- Document a staff-only exit gesture or hardware procedure.

Deliverables:

- `docs/hardware-runtime-runbook.md`
- Locked kiosk account profile.
- Startup script or managed kiosk policy.
- Target hardware bill of materials.
- Power-loss recovery test record.

### 2. Offline Media Package

Goal: remove reliance on external WordPress image URLs, YouTube iframes, and public internet.

Recommended work:

- Download and approve all primary images into `public/media/images/`.
- Download or transcode approved video files into `public/media/videos/`.
- Add poster images for every video.
- Add captions, transcripts, and optional audio descriptions for video assets.
- Add image alt text and rights metadata.
- Add a media manifest with file paths, checksums, dimensions, duration, codec, caption path, transcript path, source URL, rights holder, and approval status.
- Update data prep to prefer local media paths over external URLs.
- Add a `build:kiosk` mode that fails if any visitor-facing media points to an external URL.
- Tighten kiosk CSP so `img-src`, `media-src`, and `frame-src` do not permit arbitrary external sources.
- Keep external profile URLs only as non-visitor source metadata or staff diagnostics.

Deliverables:

- `data/media_manifest.json`
- `public/media/images/*`
- `public/media/videos/*`
- `public/media/captions/*`
- `public/media/transcripts/*`
- `npm run validate:media`
- `npm run build:kiosk`

Acceptance checks:

- App works with network unplugged.
- All images load from local paths or show approved fallbacks.
- All videos have poster, captions, and transcript metadata.
- Kiosk build fails on unresolved media, missing captions, broken paths, or external visitor URLs.

### 3. Data Governance And Curatorial Workflow

Goal: make content updates safe, reviewable, and reversible.

Recommended work:

- Add a curated metadata file separate from scraped/imported data:
  - display name overrides
  - pronunciation
  - alt text
  - approved summary
  - approved themes
  - featured/attract priority
  - story-lens and trace membership
  - media rights status
  - content approval status
  - review notes
- Add schema validation for raw CSV, curated metadata, media manifest, generated inductees, story lenses, story sections, relationship records, entity relationships, and physical wall positions.
- Fail the build on duplicate IDs, unresolved relationship IDs, unresolved story lens references, empty required display fields, missing local media in kiosk mode, or unapproved content.
- Preserve a generated content report for curators and staff.
- Add a simple update runbook: edit source, validate, preview, approve, release.

Deliverables:

- `data/cihof_curated_metadata.json`
- JSON schemas or TypeScript validation module.
- `npm run validate:data`
- `public/data/content-report.json`
- `docs/content-update-runbook.md`

Acceptance checks:

- Every visitor-facing profile has approval status.
- Every manually curated field can override generated data without modifying scraper output.
- Build output is deterministic.
- Curators can review a generated report before release.

### 4. Touch And Accessibility Upgrade

Goal: make the exhibit usable by visitors with different heights, mobility, vision, hearing, and cognitive needs.

Recommended software work:

- Treat WCAG 2.2 AA as the baseline for color contrast, focus behavior, keyboard access, target size, motion, resize/reflow, headings, labels, and error states.
- Add a persistent Reset control that remains reachable from every Hall lens, focused person state, anchored action panel, lightbox, and media state.
- Move key kiosk actions into a lower or side action rail for mounted touchscreen reach.
- Keep primary touch targets at least 56 px, and secondary targets at least 44 px.
- Add an accessibility mode with larger text, reduced motion, higher contrast, and simplified navigation.
- Ensure portrait focus, TRACES relationship selection, LEGACIES horizontal navigation, media controls, and QR close behavior are usable by touch, keyboard, and assistive technology.
- Provide captions and transcripts for media.
- Add captions/transcript controls that are not hidden behind native browser controls alone.
- Avoid hover-only affordances.
- Add real alt text for approved images instead of empty decorative alt everywhere.
- Review the production content-protection behavior because copy/selection blocking can interfere with assistive technology.

Recommended physical review:

- Confirm clear floor space at the kiosk.
- Confirm touch areas and any physical controls are within ADA reach ranges.
- Confirm glare, viewing angle, audio level, and wheelchair approach on the actual floor.
- If top-mounted controls are unreachable, provide equivalent lower controls in the UI.

Deliverables:

- Accessibility checklist and exception log.
- Automated axe or equivalent audit in CI.
- Manual keyboard and screen-reader test notes.
- Physical mount/accessibility signoff.

Acceptance checks:

- No critical automated accessibility violations.
- All core flows work without a mouse.
- Videos have captions and transcripts.
- Visitor can always return home or reset without staff help.
- Physical placement is reviewed before final mount.

### 5. Kiosk Session Behavior

Goal: make unattended public use recover cleanly from every visitor path.

Recommended work:

- Replace immediate idle attract reset with a staged flow:
  - idle warning
  - countdown
  - reset
  - attract loop
- Add `?kiosk=1&attract=1` launch state.
- Ensure reset clears:
  - focused person
  - active Hall lens back to `PORTRAITS`
  - active trace/thread/place context
  - LEGACIES horizontal position
  - lightbox
  - anchored person action panel
  - QR continuation layer
  - scroll positions
  - active video or iframe state
  - transient accessibility mode only if museum wants session-level preferences
- Make attract behavior reorganize the persistent Hall without routing to a separate attract page.
- Add a staff-only diagnostics panel with app version, data version, media package status, browser info, uptime, last error, and reset count.
- Add a hidden maintenance route that is blocked in visitor mode unless staff unlocks it.

Deliverables:

- Kiosk session state module.
- Diagnostics screen.
- Idle/reset tests.

Acceptance checks:

- Idle reset works from every Hall lens and anchored action state.
- Reset stops all media.
- No stale focused person, trace context, legacy pan, lightbox, media, or QR state survives reset.
- Attract mode never traps the user.

### 6. Reliability, Monitoring, And Recovery

Goal: catch failures before visitors do, and recover automatically when possible.

Recommended work:

- Add a local error logger for unhandled exceptions, failed media loads, failed data loads, and reset events.
- Add a health endpoint or local status file updated while the app is alive.
- Add watchdog process that restarts the app if health checks stop.
- Add version metadata to each build:
  - app version
  - git commit or release ID
  - data generated timestamp
  - media manifest checksum
  - build target
- Add staff export of diagnostics to USB or local network share if museum IT permits.
- Run long-duration soak tests on the exact hardware.
- Track memory growth, CPU, GPU, browser crashes, video playback failures, and touch input issues.

Deliverables:

- `public/version.json`
- Local logging strategy.
- Watchdog script or kiosk policy.
- `docs/support-runbook.md`
- `docs/release-runbook.md`

Acceptance checks:

- 72-hour burn-in passes.
- Browser restarts after forced crash.
- App relaunches after power loss.
- Staff can find current version and last failure without opening developer tools.

### 7. Security And Network Posture

Goal: reduce the attack surface of a public touchscreen.

Recommended work:

- Prefer no public internet dependency for the visitor experience.
- Use a dedicated restricted OS account.
- Remove admin access from the exhibit account.
- Restrict USB behavior according to museum IT policy.
- Configure browser or OS URL allow/block lists.
- Disable browser downloads, print dialogs, save dialogs, external protocol launches, and file browsing.
- Patch OS/browser on a planned museum schedule, not during open hours.
- Store no visitor personal data.
- Avoid analytics that can identify visitors.
- Use local logs with no visitor identifiers.
- Keep the source repository and release signing controlled.

Deliverables:

- Threat model and control checklist.
- Patch/update policy.
- Network allowlist.
- Kiosk account configuration.

Acceptance checks:

- Visitor cannot escape to OS shell, browser settings, arbitrary web pages, downloads, or file picker.
- External URLs are blocked in visitor mode.
- Reboot returns to the exhibit automatically.

### 8. Build, Release, And Rollback

Goal: make releases boring and reversible.

Recommended work:

- Add explicit build targets:
  - `npm run build:web` for any non-kiosk preview.
  - `npm run build:kiosk` for permanent install.
  - `npm run validate:kiosk` for data, media, security, accessibility, and route checks.
- Make Vite base path configurable instead of hardcoding production to `/cihof/`.
- Produce a versioned release artifact, such as `cihof-exhibit-YYYY.MM.DD.zip`.
- Include app, local media, config, version metadata, release notes, and validation report in each release.
- Keep the previous release on the kiosk for rollback.
- Restore or replace the current GitHub Pages workflow if public preview is needed; the current workflow intentionally deploys a placeholder page.

Deliverables:

- Release artifact script.
- Release checklist.
- Rollback procedure.
- Staging kiosk or staging browser profile.

Acceptance checks:

- Staff can install a release from documented steps.
- Staff can roll back to previous release in under 10 minutes.
- Kiosk build is reproducible from tagged source.

## Implementation Phases

### Phase 0: Installation Discovery

Duration: 1 week

- Confirm hardware, OS, display size, resolution, mount height, network policy, audio policy, and update policy.
- Confirm whether the museum requires public web access, local-only install, or both.
- Confirm media rights and whether YouTube is allowed during final installation.
- Confirm accessibility and procurement requirements with museum stakeholders.

Exit criteria:

- Target runtime chosen.
- Hardware and physical assumptions documented.
- Kiosk build target agreed.

### Phase 1: Data And Media Hardening

Duration: 2-3 weeks

- Add curated metadata.
- Add media manifest.
- Localize images and videos.
- Add captions/transcripts.
- Add schema validation.
- Add media and content reports.
- Update data prep to prefer local assets.

Exit criteria:

- Kiosk data build fails on missing or unapproved assets.
- Network unplug test passes for core app and media.

### Phase 2: Kiosk Runtime And Lockdown

Duration: 1-2 weeks

- Configure selected OS/browser kiosk mode.
- Add autostart, watchdog, scheduled reboot, and diagnostics.
- Make base path configurable.
- Add kiosk release artifact generation.
- Tighten CSP for kiosk build.

Exit criteria:

- Power loss relaunch works.
- Visitor cannot leave the app.
- Staff can enter and exit maintenance mode.

### Phase 3: Accessibility And Touch Refinement

Duration: 2 weeks

- Add persistent reachable controls.
- Add accessibility mode.
- Improve captions/transcripts and media controls.
- Validate keyboard, screen-reader, touch, contrast, motion, and text scaling.
- Review physical mount and reach.

Exit criteria:

- Accessibility checklist is signed off or exceptions are documented.
- All primary visitor flows work in target mounted position.

### Phase 4: Reliability And Burn-In

Duration: 1-2 weeks

- Add local logging/version metadata.
- Add Playwright kiosk smoke tests.
- Run 72-hour target-hardware burn-in.
- Fix crashes, memory growth, media failures, or layout failures.
- Validate rollback.

Exit criteria:

- 72-hour burn-in passes.
- Smoke tests pass.
- Release and support runbooks are complete.

### Phase 5: Museum Handoff

Duration: 1 week

- Install final release on target hardware.
- Train staff on reset, maintenance mode, updates, rollback, and support escalation.
- Deliver source, release artifact, runbooks, validation reports, and content approval reports.
- Record final hardware config and installed version.

Exit criteria:

- Museum staff can operate and recover the exhibit without developer intervention.
- Final acceptance checklist is signed.

## Acceptance Test Matrix

| Area | Acceptance Gate |
| --- | --- |
| Offline operation | App, data, images, videos, captions, and transcripts work with network disconnected. |
| Kiosk lockdown | Visitor cannot open arbitrary URLs, browser settings, downloads, print dialogs, devtools, OS shell, or external apps. |
| Idle recovery | Idle warning, reset, and attract mode work from every Hall lens, focused person, anchored action, lightbox, and media state. |
| Media | Every approved video has local file, poster, captions, transcript, and working controls. |
| Data | Generated IDs are unique, relationship IDs resolve, story lens references resolve, and visitor-facing required fields are present. |
| Accessibility | WCAG 2.2 AA target is tested, core flows work by keyboard/touch, and physical reach/clearance is reviewed. |
| Reliability | 72-hour burn-in passes on target hardware. |
| Power recovery | Reboot or power restore returns to the exhibit without staff login. |
| Staff operations | Staff can view diagnostics, restart the app, update release, and roll back. |
| Content approval | Curatorial approval state exists for every visitor-facing profile and media item. |

## Highest-Priority Code Changes

1. Finish portal editing/apply workflow for curator-approved context, `HONORED FOR`, and Life + Work fields.
2. Promote documented source-derived relationship candidates into `data/cihof_relationships.json`.
3. Localize approved primary portraits and update `data/media_manifest.json` with kiosk-ready local paths.
4. Add captions, transcripts, poster images, rights status, and kiosk approval for playable media.
5. Tighten `validate:kiosk` so it blocks missing approved profile text, unresolved relationships, and missing local media for production releases.
6. Add an installation runbook for target hardware, browser lockdown, local server startup, recovery, rollback, and staff diagnostics.
7. Expand Playwright coverage for reduced motion, fast lens switching, offline loading, and admin import/export.
8. Refactor `LivingHallView.tsx` and `ReviewDashboardView.tsx` after curation workflow stabilizes.
9. Add accessibility-mode decisions and physical reach validation for the mounted screen.
10. Run a 72-hour burn-in on target hardware.

## Risks To Resolve Early

- External media dependency: current image and video references are not installation-safe until localized and licensed.
- Runtime ambiguity: GitHub Pages is not the right primary runtime for a permanent exhibit.
- Physical accessibility: software controls near the top of a tall touchscreen may be unreachable after mounting.
- Content governance: generated summaries/themes are useful, but permanent museum text needs curator approval.
- Browser-level content protection: JavaScript blocking of copy/devtools is not real kiosk security and may conflict with accessibility.
- Long-duration behavior: the current app has not yet been proven through multi-day burn-in on target hardware.
