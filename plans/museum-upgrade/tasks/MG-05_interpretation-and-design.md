# MG-05 — Interpretive hierarchy, approved text, and visual refinement

**Goal:** Preserve the design's character while making its meaning easier to grasp.

**Primary files:** Visitor shell/RecordView, active styles, People search/view model, canonical content schema/adapters and staff preview where necessary.

**Changes:** Add a concise, curator-reviewable invitation to the neutral state within the existing layout. Do not introduce a blocking introductory splash screen. The neutral sidebar must do more than repeat collection counts; selected state should foreground the person and their approved contribution.

Reorganize the full record into progressive layers: contribution; complete biography; optional approved Cleveland context; evidence/record notes. Preserve full source text. Remove runtime name-prefixing and heuristic editorial “repair.” Use approved paragraph structure or a documented review migration; do not silently paraphrase biographies.

Support contribution-area, induction-year, and suitable community browsing within People, using existing approved vocabulary. Treat identity, heritage, place, and migration facts as distinct fields. Keep ordinary search, but do not require a physical or onscreen keyboard to begin.

Add a minimal schema/view for approved Cleveland context and linked archival material only after inspecting existing structures. New fields may include a source reference, credit, rights scope, descriptive text, relationship to the person, and review state. Unknown fields remain empty or in staff review; the public UI must not expose fictitious placeholder objects.

Refine the existing typography, spacing, portrait crop/focal-point policy, and reading rhythm. Use sentence case for prose and descriptive controls where it improves comprehension; retain uppercase where it belongs in the identity system. Start long-form line height around 1.4–1.6 and measure actual layout rather than applying indiscriminately. Review both themes and all states. Consolidate active selectors and tokens instead of appending another override layer. Do not remove shared portal/support styles without checking their consumers.

**Tests/review:** Approved text renders unchanged; absent source/context fields have honest fallbacks; long names and long biographies; filter combinations; accent/diacritic normalization in search without changing displayed names; portrait focal points; neutral/selected/reading hierarchy; regression screenshots with real fonts loaded.

**Acceptance:** A first-time visitor has a clear invitation; short and deep reading both work; every new interpretive claim awaits authorized review; no source text is “fixed” during rendering; visual changes remain recognizably CIHOF rather than a generic redesign.

**Prompt:**

```text
Execute MG-05 only. Improve interpretation and reading hierarchy
inside the existing editorial design. Preserve approved biographies,
remove runtime prose repair, add curator-controlled entry copy and
optional sourced Cleveland context, and support non-typing discovery.
Consolidate active CSS carefully. Do not fabricate content or rebrand.
```

---

This brief is extracted from the master [Codex upgrade plan](../CIHOF_Codex_Upgrade_Plan.md). Read its non-negotiable constraints, execution order, shared test matrix, and completion requirements before implementation. The master plan is authoritative; this brief does not authorize deployment or completion of any other stage. Source references are retained in the [full audit](../CIHOF_Museum_Grade_Audit.md).
