# MG-04 — Truthful, visible relationship explanations

**Goal:** The visitor can understand why two people are connected and inspect the evidence.

**Primary files:** `archiveModel.ts`, `LinksScene.tsx`, layout/styles, canonical/public relationship adapters and validators identified in MG-00.

**Changes:** Trace `inducted_by_candidate` and `related_to` through canonical sources, curation decisions, generated runtime data, and visitor rendering. Record whether provisional rows are already excluded upstream. Enforce explicit publication eligibility without assuming an apparent type name alone proves or disproves approval.

Preserve typed direction, relation identity, source references, review status, and meaningful forward/reverse descriptions. Retain multiple documented relationships between a pair where appropriate; do not lose their meaning through person-only deduplication. Separate shared-class context from a documented relationship. Label it “Honored in the same year” or similarly precise wording.

Display the relevant explanation visibly when a connection is explored. Keep selection predictable: a compact explanation panel can accompany re-centering, or a visible relation control can open it. Avoid making the visitor guess whether a tap selects, opens, or moves. Provide an equivalent accessible list of the selected person's relationships with the same text, sources, and actions.

Use wording and line treatment together; never encode meaning only in color. Do not shrink dense graph nodes below usable targets to fit the screen. Offer scrolling, filters, or a list with an explicit count rather than silently omitting relationships. Distinguish loading/error from “no documented connections.”

**Tests:** Directional relation viewed from either endpoint; two relation types for one pair; provisional/unapproved relation; approved sourced relation; same-class-only link; unknown class dates; no relationships; failed relationship load; repeated re-centering; keyboard list equivalence; responsive layout with long labels.

**Acceptance:** Every published edge has an intelligible explanation and provenance or is clearly identified as shared context; provisional publication behavior is documented and tested; visible and assistive experiences express the same relationship; no inferred friendship or migration claim is introduced.

**Prompt:**

```text
Execute MG-04 only. Make Links visibly explainable and evidence-aware.
Trace upstream approval handling before changing it. Preserve relation
type/direction and sources; distinguish shared induction year from
personal relationships. Add an equivalent accessible relation list
and regression tests. Do not invent or auto-approve links.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
