# MG-08 — Release gates, operations, and actual sign-off

**Goal:** Make “ready for the museum” an evidence-backed release decision.

**Primary files:** `.github/workflows/pages.yml`, relevant test configurations, validators/packaging, release and operator documentation.

**Changes:** Put repeatable checks before public deployment. Run browser/interaction tests against the public build artifact, not an unrelated development environment. Run staff portal checks separately and keep its payload out of the visitor artifact. Add data/relationship validation, rejected-media artifact checks, automated accessibility checks, and deliberate offline/recovery tests where they can run reliably in CI.

Inspect existing validator assumptions. The full-media-clearance command is expected to report pending materials at the audited snapshot; do not turn “every archived film must be approved” into an accidental prerequisite for publishing a perfectly valid text/portrait exhibit. The gate should strictly validate what is published while accurately reporting pending holdings.

Name and retain build artifacts so a restricted package cannot be confused with the Pages output. Record commit, data revision, approval revision, test results, screenshots, and intended target. Make deployment consume the tested artifact. A release should not rebuild different content after passing tests.

Create a concise staff runbook: startup/shutdown, ready/not-ready checks, safe restart, network loss, content publication, permissions, approved media addition, cache/release update, rollback, and escalation. No secrets in browser bundles, instructions, screenshots, or exported logs. Verify local import/auth/service boundaries without making unsupported security claims.

Set performance and endurance targets after baseline measurement. Suggested initial project targets: visible control feedback within 100 ms and warm scene changes within 300 ms on the selected hardware, measured under a documented test method; 72-hour unattended soak without an unrecovered failure; no monotonic resource growth across repeated representative journeys. These are proposed acceptance goals, not asserted current results or universal standards.

Conduct a formative visitor test with participants spanning age, reading pace, mobility/dexterity, and access needs. Ask them to find a person without typing, explain a relationship, navigate Years without a film, recover their place, and start a new session. Record confusion and task outcomes, not personal identifying data. Treat this as formative evaluation, not a statistically representative survey.

**Acceptance:** A failing required gate prevents deployment; the tested and deployed artifact are identical; staff can recover the installed system; physical/accessibility and curatorial reviews are completed or explicitly block gallery sign-off; no generated status report invents a passed test.

**Prompt:**

```text
Execute MG-08 only. Add release gates for the tested public artifact,
keep portal/restricted packages separate, and produce a practical
museum handoff and acceptance record. Preserve pending holdings
without publishing them or treating them all as approved. Do not
claim hardware, visitor, or accessibility tests were completed unless
they were actually run. Do not deploy without explicit authorization.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
