# CIHOF Design And Interface Audit

Generated: 2026-08-26

Scope: public Hall/kiosk interface, art direction, touch ergonomics, visual hierarchy, and visitor-facing interaction patterns. Data quality, curation approval, media rights, and staff workflow recommendations are intentionally out of scope.

## Direction

The strongest product direction is to keep the current exhibit metaphor: a persistent wall that can be recomposed as PORTRAITS, TRACES, and LEGACIES. The app should feel like an installation surface, not a website or an administrative dashboard. The design work should therefore improve clarity, scale, contrast, and touch affordance while preserving the archival wall language.

State-of-the-art museum touchscreen patterns point to a few practical principles:

- Show one clear primary action at a time, with deeper layers available on demand.
- Use large, grouped controls because a public screen is a physical interface, not a phone.
- Keep interpretation placement consistent so visitors learn the system quickly.
- Use contrast and readable label hierarchy as accessibility features, not just visual polish.
- Let the exhibit object, portrait, or story lead; the interface should support the encounter.

## Current Visual Findings

### P1: Idle Wall Was Too Low-Contrast

The idle PORTRAITS screen had the right spatial idea, but the wall title, touch cue, and status rail were too faint. The first-view signal felt more like background texture than an invitation to act.

Implemented first:

- Raised wall linework and status contrast.
- Strengthened the touch cue without adding instruction-heavy copy.
- Added a subtle sage/rust cast so the field does not read as a single beige plane.

### P1: Focused Portrait Card Was Overpowering And Occasionally Clipped

The focused info card behaved like a large document sheet. On long names it could become taller than the comfortable viewport and compete with the portrait.

Implemented first:

- Reduced headline wrapping and tightened vertical rhythm.
- Gave the selected portrait more optical authority through mat/frame emphasis.
- Made the focus card slightly more opaque so background metadata no longer ghosts through the label.
- Preserved full action access inside the visible card area.

### P1: Primary Actions Needed Larger, Clearer Touch Zones

The action list was legible but too flat for a public touchscreen. It needed to read as a grouped set of physical touch choices.

Implemented first:

- Converted focus actions into two-column touch zones.
- Kept FOLLOW THE TRACE as the dominant action.
- Gave SAVE TO VISIT its own sage treatment so it reads as a collection/hold action, not another reading mode.
- Kept visible focus outlines for keyboard and admin use.

### P1: Story/Media Header Collided With Ambient Status Labels

In Life + Work mode, the top status rail could visually collide with the story header. The result was a noisy top band.

Implemented first:

- Hide the status rail while a story, text, watch, or continuation panel is open.
- Reduced story-panel width and adjusted the return control so it stays inside the viewport.
- Slightly tightened story media/copy proportions.

### P2: TRACES Needed Better Foreground/Background Separation

Trace labels and chooser controls were visually competing with map linework and portrait clusters.

Implemented first:

- Added paper plates behind trace labels.
- Made the trace chooser a compact interpretation plate.
- Strengthened active trace mode states while keeping inactive linework ambient.

### P2: LEGACIES Timeline Needed Stronger Navigation Affordance

The timeline worked, but class labels, edge arrows, and the active year read too faintly.

Implemented first:

- Strengthened the class baseline and active class label.
- Increased edge-arrow visibility.
- Added a quieter readout surface so the selected class is easier to scan.

### P2: Bottom Dock Needed More Confidence

The dock was visually correct but slightly too airy. Its labels needed a firmer touch target treatment without becoming a dark toolbar.

Implemented first:

- Tightened dock width and spacing.
- Increased rule and active-state weight.
- Added stronger focus-visible treatment.

## Next Design Upgrades

1. Run a hardware pass on the actual touchscreen.
   Validate reach zones, glare, viewing distance, and whether the two-column focus actions are comfortable for standing visitors.

2. Add a high-contrast kiosk mode.
   Keep the same layout, but increase text/rule contrast and reduce ambient background portrait opacity for low-vision users or bright-gallery conditions.

3. Add a guided attract-state rhythm.
   Use subtle sequencing to spotlight a portrait, a trace, and a class path over time. Avoid adding a landing page or explanatory overlay.

4. Improve empty and unavailable states as designed exhibit labels.
   If a profile lacks media or story depth, the UI should still feel intentional rather than sparse.

5. Build a visual QA checklist into Playwright.
   Keep screenshot coverage for PORTRAITS idle, focused portrait, TRACES, follow-the-trace, LEGACIES, and Life + Work, and add assertions for clipping in focus cards and story headers.

6. Prototype one visitor-path layer.
   Extend the saved-visit idea visually: collected portraits should feel like a small path through the Hall, not just a list.

## Research Benchmarks

- W3C WCAG 2.2 target-size guidance: https://www.w3.org/TR/wcag/
- W3C understanding of Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Grafton Studio, UI/UX design for interactive museum touchscreens: https://graftonstudio.com/articles/ui-ux-design-for-interactive-museum-touchscreens/
- American Alliance of Museums / Walker Art Center accessibility case study: https://www.aam-us.org/2025/11/24/a-holistic-and-people-centered-approach-to-accessible-exhibition-design-walker-art-center-case-study/
