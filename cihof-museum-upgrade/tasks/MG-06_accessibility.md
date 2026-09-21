# MG-06 — Accessibility, reachable operation, and continuation

**Goal:** Complete visitor journeys with keyboard, touch, and appropriate assistive technology.

**Primary files:** Active shell/scenes, QR wrapper/component, shared dialog/focus utilities, styles, tests, installation documentation.

**Changes:** Implement a correct modal contract for QR and any new dialogs: labelled purpose, initial focus, contained tab sequence, inert background, Escape when appropriate, and focus restoration to a surviving trigger. Do not apply `aria-modal` unless the behavior is truly modal. Fix focus restoration for record close, selection changes, and scene transitions. [S4]

Audit all essential controls, target spacing, focus visibility, contrast, reflow, zoom, motion preferences, and screen-reader naming. Adopt WCAG 2.2 AA as the intended software baseline, with larger practical kiosk targets; do not equate AA's CSS minimum with the best physical target size. Provide non-drag alternatives and make instructions visible without hover. [S2–S3]

Prototype a reachable control arrangement appropriate to the installed wall/shelf system. All essential functions must have a reachable equivalent. Record physical screen dimensions, mounted height, operating-system scaling, input-device placement, approach/clearance, and seated/standing use. Browser viewport tests do not certify these conditions. Resolve the independent path for blind visitors with the institution; an optional phone is not the sole fallback. [S5]

Verify the QR's actual encoded URL is a stable public continuation route, not localhost, a private address, staff portal, or a URL containing admin/session parameters. Verify it loads the same person on a phone with usable reading layout. Preserve kiosk access to the complete core story; QR should not conceal content exclusively behind a phone.

**Tests:** Full Tab/Shift+Tab cycles; screen-reader spot checks and accessible-tree inspection; reduced motion; 200% text/zoom and narrow reflow with justified graph alternatives; both themes; QR URL decoding and round-trip; stale/invalid person URL; Escape and return focus; no invisible focus under overlays. Add automated accessibility checks as one layer, not as the entire proof.

**Acceptance:** All main journeys work without touch or precise dragging; modal semantics match behavior; extension/reset controls are usable; companion links resolve correctly; physical and assistive checks have documented results or remain explicit release blockers.

**Prompt:**

```text
Execute MG-06 only. Complete keyboard, focus, modal, reflow, target,
motion, and QR-continuation behavior. Use automated checks plus manual
journeys, and separate software results from physical installation
checks. Preserve kiosk access without requiring a visitor's phone.
Do not claim accessibility certification from a scan alone.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
