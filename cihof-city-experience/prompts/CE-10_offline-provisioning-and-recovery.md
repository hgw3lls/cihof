# CE-10 — Make offline operation a versioned, recoverable package

**Depends on:** CE-01, CE-02, CE-03, CE-04, CE-05, CE-06, CE-07, CE-08, CE-09  
**Status:** Not started; this is a proposed implementation task.

## Goal

Replace reliance on opportunistic browsing caches with deliberate provisioning, coherent updates and tested recovery.

## Before changing code

Read the actual root/applicable AGENTS instructions, `cihof-city-experience/AGENTS_ADDENDUM.md`, the full plan, DATA_CONTRACTS, ACCEPTANCE_TESTS and prior stage completion records. Inspect HEAD and working-tree changes. Preserve current public/kiosk/portal boundaries and completed MG behavior.

## File targets

These identify the existing integration points and proposed additions. Inspect for reusable modules before creating a proposed path.

- `public/sw.js`
- `vite.config.ts`
- `src/app/buildInfo.ts`
- `src/data/runtimeDataBundle.ts`
- `scripts/validate-offline-package.js`
- `src/features/admin/AdminDataPanel.tsx`
- `cihof-museum-upgrade/tasks/MG-07_offline-and-recovery.md`

## Work

Read the existing MG-07 scope and current worker before changing them. Generate a target-aware manifest with build SHA, content revision, schema version, required shell/data/portrait files and explicit optional media packs. Hash required assets and validate references after visitor filtering. Do not provision unapproved film holdings or staff metadata just because they exist locally.

Stage a new version completely before activation. Keep a known-good version until the replacement is verified; activate at a safe idle/reset/restart boundary, not through unconditional immediate takeover. Ensure shell, runtime data and media use coherent versioning and account for mutable media paths. Design withdrawal/revocation policy explicitly, including offline limitations.

Provide canonical document fallback for `/cihof/` and query-based deep links. Catch cache/quota failures so successful online responses do not become blank screens. Report required versus optional provisioning state, failed hashes and recovery options in operational diagnostics. Do not clear unrelated application caches or leak staff content through a fallback route.

Support a complete local kiosk package and an approved launcher/server workflow. Do not promise `file://` service-worker behavior or first-ever offline access to the public site. Test provision → disconnect → browser restart → unvisited deep link → required content. Optional unprovisioned media must be described honestly.

Where future cleared audio/video is exercised, handle complete media responses and range requests deliberately. Use the existing media eligibility gates. Test interrupted updates, storage limits, missing assets, incompatible schema and rollback. A library can be adopted only with a justified decision, not as a substitute for the tests.

Write a recovery runbook and MG-07-compatible completion evidence. Keep physical power-cycle/endurance verification separate from browser simulation. Do not close MG-07 until its actual conditions are met.

## Acceptance

O01–O09 and O11 pass in applicable environments or are explicitly blocked. A provisioned release works offline after restart; interrupted updates do not mix versions or destroy the last known-good package; required-asset readiness and public/kiosk scope are verifiable.

Run a justified set of existing and new checks. Record commands actually run, results, SHA/content revision, source changes, screenshots/traces if produced, and anything blocked. No test pass grants curator, rights or installation approval.

## Completion

Write `cihof-city-experience/completions/CE-10.md` using the template, update the CE tracker and explain the next-stage boundary. Stop at the end of this stage. No push, merge, deployment or permission change is authorized.

## Paste into Codex

```text
Read the root and applicable AGENTS.md instructions, then
cihof-city-experience/README_START_HERE.md,
cihof-city-experience/AGENTS_ADDENDUM.md,
cihof-city-experience/CIHOF_Full_Codex_Plan.md, and
cihof-city-experience/prompts/CE-10_offline-provisioning-and-recovery.md.

Implement CE-10 only, fulfilling the applicable MG-07 scope. Add a target-aware versioned manifest, safe provisioning/activation, navigation fallback, storage recovery and rollback tests. Do not equate a registered service worker with an offline-ready exhibit.

Preserve unrelated work and report current-baseline drift. Use canonical data
and existing modules, not a framework rewrite. No invented historical content,
identity inference, approval changes, push, merge or deployment. Save the stage
completion record and actual evidence, update the tracker, then stop for review.
```

---

## Scope correction, 2026-09-21

Added from [CIHOF_Source_Audit.md](../CIHOF_Source_Audit.md) finding S04. This
stage reads as an extension of the existing offline support. It is a
replacement, and two of its acceptance cases are currently implemented
backwards rather than merely missing.

`public/sw.js` is 87 lines of opportunistic caching:

- `install` calls `self.skipWaiting()` and `activate` calls `self.clients.claim()`,
  so a new release takes over a session in progress. **O05 requires the
  opposite.** Undo this before building the agreed activation point.
- `activate` deletes every prior `cihof-runtime-` cache, so there is nothing to
  fall back to. **O04 requires the last working release to survive.**
- There is no precache and no manifest, so O01, O02 and O03 have nothing to
  build on. An unvisited person deep link fails offline today.
- `networkFirst` awaits `cache.put` inside its `try`, so a quota failure
  discards a response that already arrived. That is **O06** as a live defect.

`src/app/serviceWorkerRegistration.ts` registers the worker and nothing else:
no `updatefound` handling, no waiting-worker coordination, no `update()` call.
The agreed activation point has no implementation to extend.

Do not cite `npm run validate:offline` as offline evidence for this stage. It
checks that asset references resolve inside `dist/`; it does not read `sw.js`,
model the cache, compute checksums, or load anything with the network off. See
audit finding S05, which also proposes renaming it.

**This stage now depends on CE-12** as well as its listed dependencies. A
versioned, recoverable package needs a content revision the application reads,
and CE-12 is where that starts.
