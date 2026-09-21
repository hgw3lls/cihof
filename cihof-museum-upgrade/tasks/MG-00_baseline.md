# MG-00 — Establish the baseline and actual product boundary

**Goal:** Make subsequent changes evidence-based and reversible.

**Inspect:** README, existing agent instructions, `src/app/main.tsx`, the active exhibit directory, settings/configuration, `package.json`, `vite.config.ts`, the tests and deployment workflow. Follow the public-data generation and approval pipeline far enough to identify where publication eligibility is enforced.

**Work:** Record current commit, runtime routes, feature flags actually consumed by the active app, artifact types, canonical versus generated data, and current content counts. Map legacy features/configuration that exist in source but are not active. Run the public build and existing visitor tests first; run portal checks separately. Do not “repair” a baseline failure until it is recorded.

Capture People neutral/selected/searched/no-results, full record, Links neutral/selected, Years neutral/selected, pending-media behavior, QR, light/dark, and keyboard-focus states. Use the existing 390×844, 768×1024, 1920×1080, and 3840×2160 coverage; add installed-device measurements when available. Record viewport, DPR, browser, OS scaling when known, commit, and data version. Screenshots are not substitutes for action tests.

**Acceptance:** A developer can reproduce the baseline from documented commands; every failed or blocked check is visible; restricted outputs are unmistakably identified; no production content or permission is changed; source risks from the audit are either reproduced, refined, or left honestly unverified.

**Prompt:**

```text
Execute MG-00 only. Establish the current baseline and publication
boundaries before modifying functionality. Add a concise baseline
report and practical AGENTS.md guidance. Keep production content
unchanged and do not deploy. Report actual checks and blockers.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
