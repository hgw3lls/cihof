# CE-12 — Make the published content boundary hold at runtime

**Depends on:** CE-01
**Status:** Not started; this is a proposed implementation task.
**Added:** 2026-09-21, from [CIHOF_Source_Audit.md](../CIHOF_Source_Audit.md) findings S01, S02, S03 and S06.

## Goal

Make the reviewed artifact the only content a visitor can be shown, make the
content revision something the running application actually knows, and give
staff an import path that is deliberate, visible and reversible.

## Why this stage exists

CE-01 established publication rules and enforced them in the build. It closed
correctly and its output was verified. But the running application reads a
localStorage bundle override **before** the served artifact, accepts anything
carrying an `inductees` array, keeps it across every reset the product offers,
and shows no sign of it outside the admin panel. Separately, the deterministic
`contentRevision` CE-01 generates is read nowhere in `src/`, and the runtime
bundle's local fallback is dead code because the payload is twice the cache
limit it is checked against.

CE-01 is build-time. CE-10 is packaging and delivery. Nothing owns the middle,
and P08 cannot pass without it. CE-10 depends on this stage because a versioned,
recoverable offline package needs a content revision that something reads.

## Before changing code

Read the actual root/applicable AGENTS instructions,
`cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS,
ACCEPTANCE_TESTS including the source-audit addendum, `CIHOF_Source_Audit.md`,
and prior stage completion records. Inspect HEAD and working-tree changes.
Preserve current public/kiosk/portal boundaries and completed MG behavior.

Treat the staff import feature as a requirement to keep, not a defect to
remove. Staff need to load a reviewed bundle without a rebuild. The boundary
around it is what changes.

## File targets

These identify the existing integration points. Inspect for reusable modules
before creating a proposed path.

- `src/data/runtimeDataBundle.ts`
- `src/data/localDataCache.ts`
- `src/data/publicationPolicy.ts`
- `src/features/admin/AdminDataPanel.tsx`
- `src/features/archive-exhibit/ArchiveExhibit.tsx`
- `src/features/archive-exhibit/state/useExhibitController.ts`
- `vite.config.ts`
- `scripts/prepare-data.js`
- `src/config/installationConfig.ts`

## Work

**Read the content revision.** Surface `contentContract.contentRevision` and
`schemaVersion` through the runtime bundle loader as typed values. Every cache
entry, override and diagnostic display keys on the revision. A payload whose
schema version is not the one this build expects is refused, not coerced.

**Validate an override instead of trusting it.** An imported bundle passes the
same pure publication selectors the build uses before it can be shown. Reuse
`publicationPolicy.ts`; do not write a second set of rules. Refuse an import
that carries no revision, carries an unexpected schema version, or fails
reference validation, and say which. An accepted import records what it is and
when it was applied.

**Make an active override visible and reversible.** While an override is in
effect, the exhibit shows a persistent staff-readable indicator that names the
imported revision. Clearing it is available without reaching the passcode form.
Decide and record whether Start Over clears it: an override that survives an
idle reset on an unattended terminal is a content decision, not a convenience,
and D09 records the choice.

**Repair the local fallback.** The runtime bundle is larger than the
`localDataCache` limit, so its fallback never stores and never reads. Either
raise the path to a storage mechanism sized for the payload, or remove the dead
branch and stop implying a fallback that cannot happen. Whichever is chosen, a
test asserts the actual behavior at the real payload size, and an oversize
payload is a loud failure rather than a `debug` log.

**Keep staff tooling out of the public artifact.** Gate the admin surface on the
build target so the public build does not ship it. Record whether the kiosk
build's passcode may remain a compile-time `VITE_` value, given that it is a
literal string in the shipped bundle, and what replaces it if not. Do not treat
a browser storage key as an authentication boundary in the record.

**Do not** invent a server, an account system, or a network authority. This is a
static artifact and must remain one.

## Acceptance

P01, P03, P05 and P08 pass, together with the source-audit cases P10, P11 and
P12. An unpublished record cannot be reinstated through an import and left
undetected. An override of the wrong schema version or missing revision is
refused with a reason. The public build contains no admin surface. The local
fallback either works at the real payload size or no longer claims to exist.
Existing visitor and portal suites still pass, and the suite still collects a
plausible test count.

Run a justified set of existing and new checks. Record commands actually run,
results, SHA/content revision, source changes, screenshots/traces if produced,
and anything blocked. No test pass grants curator, rights or installation
approval.

## Completion

Write `cihof-city-experience/completions/CE-12.md` using the template, update
the CE tracker, record the Start Over decision as D09, and explain the
next-stage boundary for CE-10. Stop at the end of this stage. No push, merge,
deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Source_Audit.md, and
cihof-city-experience/prompts/CE-12_runtime-integrity-and-override-boundary.md.

Implement CE-12 only: read the content revision at runtime, validate an imported
bundle through the existing publication selectors, make an active override
visible and reversible, repair or remove the dead local fallback, and keep the
admin surface out of the public build.

Keep the staff import feature. Do not introduce a server, accounts, or a network
authority; this is a static artifact. Preserve unrelated work and report
current-baseline drift. No invented historical content, identity inference,
approval changes, push, merge or deployment. Save the stage completion record
and actual evidence, update the tracker, then stop for review.
```
