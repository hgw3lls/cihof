# MG-03 — Complete induction chronology and dependable media

**Goal:** Years is valuable with zero approved films.

**Primary files:** `YearsScene.tsx`, `archiveModel.ts`, active styles, public media/build policy, relevant tests.

**Changes:** Build the chronology from all publication-eligible people grouped by induction class. Give each person an individually accessible entry. Films are optional child assets, not the source of person eligibility. Maintain touch scrolling, arrow buttons, year rail, keyboard navigation, and selection continuity.

Use clear induction-year language. Do not fabricate life-event dates from class years. Represent genuinely missing/unknown class dates honestly rather than connecting all unknown-date people as a cohort.

Avoid filling a major visitor scene with internal “awaiting approval” screens. Where a film is not publishable, provide the complete person experience without an apparent broken player; retain all detailed review state in the staff workflow. Do not remove pending source records or clearances from canonical data.

Retain the current rights/caption/transcript gates. Trace whether permission scope distinguishes public web use from onsite kiosk use; do not assume `approvedForKiosk` alone grants public distribution. Add an explicit compatible policy where needed, with an unresolved-review state rather than silently granting new rights.

Add media loading/error/retry states, safe handling of `video.play()` rejection, caption-load/transcript-load failures, and return to the associated record. Preserve full transcript text. Ensure video and transcript focus/visibility are correct in both tabs and mobile layouts. Media must cooperate with the session controller.

**Tests:** No films; all films pending; mixed approved/pending; person with no video; missing caption/transcript; real playable synthetic or clearly licensed test fixture; seek and replay; decode/network failure. Keep test-only approval changes out of canonical data and public production artifacts. Check successful decoding/time progression, not just existence of a `<video>` tag.

**Acceptance:** Every eligible person can be reached by year without media; no unauthorized payload becomes public; time labels are semantically correct; actual fixture playback/captions/transcript work; failure returns a usable person record rather than a dead end.

**Prompt:**

```text
Execute MG-03 only. Rework Years into a complete induction-class
chronology driven by eligible people, with approved films as optional
enhancements. Preserve all input methods and clearance gates. Add
real test-fixture playback and failure tests; never approve real
media merely to make the interface or tests look complete.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
