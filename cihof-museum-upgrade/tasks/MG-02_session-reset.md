# MG-02 — Authoritative reset and accessible sessions

**Goal:** A clean next-visitor experience without interrupting someone who is still reading or watching.

**Primary files:** Visitor shell/session module, `YearsScene.tsx`, `QRCodePanel.tsx`, installation settings/configuration, tests.

**Changes:** Implement one `resetSession(reason)` contract. It clears selected ID, person history, scene, People and Links queries, future filters, all scene positions, open record, QR, active media, and transient visitor URL state. Stop media and cancel pending work that belongs to the previous session. Clear state through explicit ownership, not `localStorage.clear()`. Preserve approved data, staff configuration, and intentional persistent theme behavior. Reset must work even when it does not change the current scene.

Add an obvious, consistently reachable Start over control. Keep “back to previous person,” “close record,” and “start over” semantically distinct.

Separate public-companion and physical-kiosk timing policy. Do not impose a museum inactivity reset on an ordinary reading website by default. For the kiosk, provide an accessible warning and extension/adjustment path. Proposed warning duration: 30 seconds; preserve the visitor's exact state on extension. Support at least ten extensions when implementing WCAG's extension option. Do not just connect the existing shorter warning setting without checking it. [S6]

Notify the session controller while a video is genuinely playing/progressing. A stalled video must not keep the exhibit permanently occupied. Ensure visible transcript reading, QR use, keyboard access, and touch-scroll activity receive appropriate treatment. Use one policy rather than competing, unexplained QR and page timers. Avoid a trap where a full-screen warning intercepts the very action needed to extend.

**Tests:** Fake-clock tests for reset and extension; active playback longer than the idle interval; paused/stalled/ended video; no-results search; repeated reset; same-scene reset; QR warning; post-reset URL; settings persistence; session remount/unmount cleanup.

**Acceptance:** Reset state equals the agreed fresh-visitor baseline; readers get a usable continuation mechanism; active media does not unexpectedly disappear; timers do not leak or multiply; public-companion mode does not inherit kiosk timing accidentally.

**Prompt:**

```text
Execute MG-02 only. Implement a single full-session reset and
accessible, mode-aware inactivity policy. Cover searches, scrolling,
media, QR, URL state, and focus while preserving installation
settings. Add deterministic timer tests. Do not add tracking or
change content approvals.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
