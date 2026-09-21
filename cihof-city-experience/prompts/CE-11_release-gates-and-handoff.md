# CE-11 — Gate the exact release artifact and hand it to staff

**Depends on:** CE-00, CE-01, CE-02, CE-03, CE-04, CE-05, CE-06, CE-07, CE-08, CE-09, CE-10  
**Status:** Not started; this is a proposed implementation task.

## Goal

Ensure that the artifact deployed or installed is the one validated, with explicit content, access and operational responsibilities.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `.github/workflows/pages.yml`
- `package.json`
- `playwright.config.ts`
- `playwright.portal.config.ts`
- `scripts/launch-readiness-report.js`
- `scripts/validate-offline-package.js`
- `cihof-museum-upgrade/tasks/MG-08_release-and-handoff.md`
- `playwright.artifact.config.ts (proposed)`

## Work

Read MG-08 and the actual existing CI. Keep fixture tests that build accelerated-timing previews separate from a new smoke suite for an immutable production artifact. The smoke suite must not rebuild, replace data, or inject fixture session settings into what it certifies. Record build SHA, content version, target and artifact hash.

Add publication-schema, reference-integrity, fixture-exclusion and target-boundary validation to the predeployment path. Preserve Node 22 and lockfile policy. Build the public target explicitly; never upload the default/kiosk output by accident. Portal remains separate. Existing pending-media clearance failures must not be “fixed” by approving holdings or block an otherwise valid no-film release without policy justification.

Run the relevant current tests and new city-experience/production-artifact tests, capturing exit results. Prevent Pages deployment when required software/artifact gates fail. Do not claim CI can decide historical truth, rights permission, real-hardware reach or screen-reader sign-off; these need explicit release records.

Generate editorial coverage, build/asset integrity, known limitations, accessibility and installation checklists. Every published new claim or media item must reference an authorized decision. Track missing enrichment as coverage, not an obligation to pad stories. Record the approved optional feature flags and routes enabled for launch.

Prepare staff instructions for startup, daily check, offline readiness, review/publish workflow, safe update, missing media handling, diagnostics and rollback. Make rollback practical for the actual installation; do not stop at a theoretical Git revert. Preserve archived MG evidence and update its status only where applicable conditions have actually been fulfilled.

Create the proposed release diff and handoff. Do not push, merge, deploy, change permissions, sign off on behalf of curators or installers, or publish the result unless the user explicitly requests that separate operation.

## Acceptance

O10–O11 plus all applicable visitor/publication tests have artifact-linked evidence. Deployment depends on required gates. Editorial, physical, access and rights approvals are explicit; unresolved items remain visible. Staff can identify, provision, update and roll back the authorized release.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-11.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-11_release-gates-and-handoff.md.

Implement CE-11 only: exact-artifact validation, deployment gates and staff handoff, satisfying applicable MG-08 requirements. Produce a reviewable release candidate with evidence, not an automatic production deployment.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```
