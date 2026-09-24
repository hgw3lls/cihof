# CIHOF: from portrait archive to an explorable city
## Source-grounded audit and staged Codex implementation package

Prepared September 20, 2026, America/Detroit.

**Audited repository:** `hgw3lls/cihof`  
**Audited commit:** `d97afd32b967a5b6e62ad6075b133979e8468b0a`  
**Deployment:** successful GitHub Pages run `35547145326`, artifact `10615874564`.  
The commit was authored September 20 at 8:15:44 p.m. EDT; its UTC timestamp is September 21 at 00:15:44.

This is a plan and static audit, not an implemented upgrade. No repository files, branches, approvals, or deployments were changed. No browser or hardware test is reported as passed by this audit.

## The decision

Keep the current React/TypeScript exhibit, selected-person continuity, source records, publication safeguards, staff portal, and completed MG improvements. Add a coordinated interpretation layer: meaningful collection regrouping, Cleveland places, sourced contribution stories, two-person comparison, and historical activity alongside the existing induction chronology.

Do not rebuild the application. Do not fill an empty network with invented relationships. The spectacle should be an understandable change in how the collection is organized.

## Read in this order

1. [Current-state audit](CIHOF_Current_State_Audit.md): what exists, what is missing, and what could not be tested.
1b. [Source audit](CIHOF_Source_Audit.md): what the code actually does. The current-state audit deliberately excluded application source, so this covers findings that plan could not see, including four acceptance cases the implementation currently contradicts.
2. [Full Codex plan](CIHOF_Full_Codex_Plan.md): target experience, architecture, delivery order, and release conditions.
3. [Data contracts](DATA_CONTRACTS.md), [acceptance tests](ACCEPTANCE_TESTS.md), and [editorial handoff](EDITORIAL_HANDOFF.md).
4. [Task tracker](TASK_TRACKER.md), then one numbered prompt at a time under `prompts/`.

The package includes the [actual deployment inventory](evidence/deployment_inventory.json), a [reproducible static inventory script](tools/inspect_deployment.py), and [source register](SOURCES.md). It deliberately excludes the deployment archive, application source, portraits, biographies, and fonts.

## Put this package in the repository

Extract the folder as `cihof-city-experience/` beside the existing `cihof-museum-upgrade/`. Preserve the existing root `AGENTS.md`. The new CE stages extend the MG work rather than replacing its completion records.

## Initial Codex prompt

```text
Work in the existing hgw3lls/cihof repository.

Read the root AGENTS.md and any applicable nested instructions. Then read:
cihof-city-experience/README_START_HERE.md
cihof-city-experience/CIHOF_Current_State_Audit.md
cihof-city-experience/CIHOF_Full_Codex_Plan.md
cihof-city-experience/AGENTS_ADDENDUM.md
cihof-city-experience/prompts/CE-00_baseline-and-adoption.md

Execute CE-00 only. The audit baseline is commit
 d97afd32b967a5b6e62ad6075b133979e8468b0a.
Inspect HEAD and working-tree changes before using those findings.
Preserve the active ArchiveExhibit entry, canonical person IDs, the separate
staff portal, completed MG work, and all publication/rights safeguards.
Do not implement in the legacy Living Hall or App.tsx.

Create the baseline/adoption evidence and update the CE tracker. Report existing
failures separately from regressions and external sign-off. Do not fabricate
content, grant approval, push, merge, or deploy. Stop after CE-00 for review.
```

For later stages, use the exact prompt in that stage's file. Do not issue “implement everything” as one unattended task. The code can progress with explicitly synthetic test fixtures while real historical material remains in the editorial queue; those fixtures must never ship.

## What the first visitor prototype should demonstrate

A visitor changes how portraits are grouped, recognizes a Cleveland place, meets an associated person, follows a specific contribution to its evidence, and discovers an explained connection to another life. The experience returns them to the same selection and context, rather than restarting the collection.
