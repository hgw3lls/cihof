# MG-01 — Inclusive collection and stable visitor context

**Goal:** Every eligible honoree is reachable; selecting and reading do not destabilize browsing.

**Primary files:** `ArchiveExhibit.tsx`, `archiveModel.ts`, active styles, existing visitor tests. Inspect the existing person-publication policy before changing collection construction.

**Changes:** Replace portrait-based collection filtering with canonical publication eligibility. Keep a real, accessible fallback for missing images, failed loads, and undersized assets. Do not request an empty URL or fabricate a portrait. Ensure IDs resolve identically in People, Links, Years, and deep links.

Keep a selected person's result position stable. Prefer an “In focus” treatment rather than removing the active result from the grid. Preserve the prior query/filter and scroll position on record close. Restore focus to the originating control; use a sensible surviving fallback when a data update removes that control. Keep the initial collection unselected and avoid a silently privileged default person.

Move shared session state into a small reducer/hook only where it clarifies invariants. Suggested new module names are `exhibitSession.ts` and `useExhibitSession.ts`; use existing equivalents if already present. Do not add a state library simply for this task.

**Tests:** Include an eligible person without an image, a broken image, an unusually long name, a selected search result, a record opened far down a list, and a deep link to a no-image person. Test mouse/touch/keyboard selection and return. Replace the old “selected tile disappears” assertion with the intentionally revised stable-context contract.

**Acceptance:** No person is excluded solely for missing media; return preserves browsing context; focus remains meaningful; all three scenes resolve the same eligible IDs; the change does not alter actual editorial publication statuses.

**Prompt:**

```text
Execute MG-01 only. Decouple person eligibility from portrait/media
availability and preserve grid position, browsing context, and focus
through selection and record return. Add regression fixtures and
update tests whose old behavior deliberately changes. No redesign,
content generation, rights changes, or framework migration.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
