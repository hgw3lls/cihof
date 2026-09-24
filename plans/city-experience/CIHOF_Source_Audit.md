# CIHOF source audit

**Recorded:** 2026-09-21
**Branch:** `sota` at `d97afd32b967a5b6e62ad6075b133979e8468b0a`, plus the uncommitted CE-00/CE-01/CE-02 tree
**Method:** direct reading of the repository source, the built public artifact in `dist/`, and executed checks

## Why this document exists

[CIHOF_Current_State_Audit.md](CIHOF_Current_State_Audit.md) states that it
"deliberately excludes the deployment archive, application source, portraits,
biographies, and fonts." It was written from the deployed artifact and a static
inventory. It is accurate within that scope, and that scope excludes every
finding below.

The plan built on that audit therefore assumes things about the code that the
code does not do. Four of the findings here are requirements the plan already
names in [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) and assigns to a stage, but
which the current implementation actively contradicts rather than merely
lacking. A stage that treats them as new work will under-scope them.

Severity below is about the installed exhibit: an unattended, public-facing
terminal. It is not a claim about remote exploitability.

---

## S01 — The publication boundary is build-time only, and a persistent runtime path goes around it

**Severity: high. Touches P01, P03, P05, P08. Assigned to no stage.**

Every publication guarantee in this project is enforced in `vite.config.ts` at
build time: `filterStorySectionsForTarget`, `filterPlacesForTarget`,
`isEntityPublishedForTarget`, `visitorInductee`, and the media gates. CE-01
strengthened all of them and verified the result. That work is sound.

At runtime, `loadRuntimeDataBundle()` in `src/data/runtimeDataBundle.ts:34`
reads a localStorage override **before** it reads the served artifact:

```ts
export async function loadRuntimeDataBundle(): Promise<RuntimeDataBundle> {
  const override = readRuntimeDataBundleOverride();
  if (override) return override;
```

The override is a whole runtime bundle stored under
`cihof.runtime-data-bundle.override.v1`. Its only validation is
`normalizeRuntimeDataBundle`, which accepts any object carrying an `inductees`
array (`runtimeDataBundle.ts:101-104`). It does not check `schemaVersion`
against the current one, does not check `contentRevision`, and does not re-apply
any publication rule. Whatever it contains becomes the exhibit.

It also:

- **persists indefinitely.** `clearRuntimeDataBundleOverride` is called from
  exactly one place, `AdminDataPanel.tsx:126`. Start Over does not clear it, the
  idle reset does not clear it, and a browser restart does not clear it.
- **is invisible outside the admin panel.** `hasRuntimeDataBundleOverride` has
  no caller anywhere in `src/` except the admin panel itself. A visitor, and a
  staff member who does not open that panel, cannot tell that the exhibit is
  serving unpublished content.
- **is reachable behind a client-side flag.** `readAdminSession` is
  `sessionStorage.getItem('cihof.admin-data.session.v1') === '1'`
  (`AdminDataPanel.tsx:286-289`). `readAdminPasscode` consults
  `localStorage['cihof.admin-passcode.v1']` before the bundled value
  (`AdminDataPanel.tsx:291-295`).

This is the intended staff import feature, and staff need it. The finding is
not that the feature exists; it is that the trust boundary around it is a
browser storage key on an unattended public terminal, the result outranks the
reviewed artifact, it survives every reset the product offers, and nothing
revalidates or surfaces it.

P08 ("Withdrawal removes visible claim/control and public payload") cannot be
satisfied while this path exists: a withdrawn record can be reinstated on a
kiosk and stay there indefinitely, and no build, deploy, or validator will
detect it.

## S02 — `contentRevision` is generated but never read

**Severity: high. Touches P08, P09, O04, O05. Assigned to no stage.**

CE-01 added a deterministic content revision to the runtime bundle and verified
it:
`b81f21754dac02d1d10de0a78dcd7419d6975430d463254e88000ad7bafa4fd8`.

`grep -rn "contentRevision" src/` returns **nothing**. No runtime code reads it.
Consequences:

- Caches are not keyed to it, so a cached payload from a previous release is
  indistinguishable from the current one.
- There is no revocation or update policy to hang off it, which P08 requires.
- The staff override in S01 cannot be checked against it.
- It cannot be displayed to staff, so O11's "identify release version" has no
  content-side counterpart.

The revision is currently write-only metadata. It is the natural key for most of
the fixes below, which is why this is listed as a finding rather than a nicety.

## S03 — The runtime bundle's offline fallback is unreachable code

**Severity: high. Touches O02, O03, O06.**

`localDataCache.ts` refuses to store any entry over `maxEntryBytes = 1_500_000`
and silently returns. The built runtime bundle is:

```
dist/data/cihof-runtime-data.json    3,150,834 bytes
dist/data/inductees.json             1,281,337 bytes
```

So `writeCachedJson(bundleCacheKey, bundle)` in `runtimeDataBundle.ts:48`
**always** takes the oversize branch. The matching read at
`runtimeDataBundle.ts:55`, which exists to serve the bundle when the network
fails, can therefore never return anything. The primary data path has no
working local fallback, and the failure is silent — it logs at `debug`.

`inductees.json` at 1.28 MB is within the cap but at 85% of it. A modest content
addition crosses the threshold and silently removes the legacy fallback too,
with no test and no validator covering either case.

The only reason the exhibit survives a network loss today is the service
worker's opportunistic `networkFirst` data cache, which holds only what a
visitor already fetched. See S04.

## S04 — The service worker contradicts CE-10 rather than merely falling short of it

**Severity: high. Touches O01–O07. Assigned to CE-10, which is scoped as new work.**

`public/sw.js` is 87 lines of opportunistic caching. Read against the stage's
own acceptance cases:

| Case | Requirement | Actual behavior |
|---|---|---|
| O05 | "New release activates at agreed idle/reset/restart point; active session not hijacked by immediate worker takeover" | `install` calls `self.skipWaiting()` and `activate` calls `self.clients.claim()` (`sw.js:8,18`). A new release takes over the running session at the first opportunity. This is the opposite of the requirement, not an omission. |
| O04 | "Interrupted download, bad checksum or server error leaves last working release available" | `activate` deletes every `cihof-runtime-` cache that is not the current version (`sw.js:13-16`). The previous release is destroyed at activation, so there is nothing to fall back to. |
| O01, O02, O03 | Manifest completeness, checksums, restart offline including an unvisited deep link | There is no precache and no manifest. Nothing is cached until a visitor happens to request it, so an unvisited person deep link fails offline. |
| O06 | "Quota/cache-write failures … do not blank a successful online response" | `networkFirst` awaits `cache.put` **inside** its `try` (`sw.js:57-59`). A quota failure on the put is caught by the same `catch`, which then falls through to `cache.match`; if nothing is cached, it rethrows — discarding a response that had already arrived successfully. This is a live defect matching the case verbatim. |

`registerServiceWorker` (`src/app/serviceWorkerRegistration.ts`) registers and
does nothing else: no `updatefound` handling, no waiting-worker coordination, no
`registration.update()`. There is no code anywhere to implement the "agreed
activation point" O05 asks for.

CE-10 should be re-read as *replace the service worker and its registration*,
not *extend them*. Its current wording ("Make offline operation a versioned,
recoverable package") does not signal that the existing behavior must be undone
first.

## S05 — `validate:offline` does not validate offline operation

**Severity: medium, and it is an evidence-integrity issue.**

`scripts/validate-offline-package.js` walks the built artifact and checks that
local asset references resolve to files inside `dist/`. That is a useful
reference-integrity check. It does not open `sw.js`, does not model the cache,
computes no checksums, and never exercises a network-off load — confirmed by
grep: no occurrence of `sw.js`, `serviceWorker`, `precache`, `checksum`, or
`integrity`.

It reports `CIHOF offline package validation passed`. The MG and CE completion
records cite that line as offline evidence. Given S03 and S04, the artifact it
passes is one whose bundle fallback is dead and whose worker precaches nothing.

The check is not wrong; its name and output overstate it, and downstream records
have inherited the overstatement. Either rename it to what it measures
(`validate:asset-references`) or make it earn the name. Until then, no record
should cite it as offline evidence.

## S06 — The admin surface ships in the public web artifact, ungated

**Severity: medium. Touches P05.**

`src/features/admin/` contains no reference to `buildInfo.buildTarget`. The
panel is in the deployed public bundle — `grep -c "Unlock" dist/assets/index-*.js`
returns 1 — and `?admin=1` opens it (`ArchiveExhibit.tsx:154`), as does a
five-tap gesture on the brand (`ArchiveExhibit.tsx:315-320`).

`.github/workflows/pages.yml` runs `npm run build:public` with no
`VITE_CIHOF_ADMIN_PASSCODE`, so on the deployed site `configuredPasscode` is
empty and the unlock form refuses with "Admin password is not configured for
this build." That default is the right one. But:

- The gate is `readAdminPasscode`, which prefers a **localStorage** value over
  the bundled one, and `readAdminSession`, which is a sessionStorage flag.
  Neither is a server-side check, because there is no server.
- Where a passcode *is* configured, `VITE_*` is substituted at compile time, so
  it is a literal string in the shipped JavaScript. The kiosk build's passcode is
  readable by anyone who can read the bundle.
- This is the same panel that reaches S01's override.

P05 asks that "Public, kiosk and portal outputs contain only intended
entry/data/assets." A staff tool that can replace the published dataset is
currently in the public output by default. The narrow fix is a build-target gate
that removes the panel from the public target entirely; the passcode question is
separate and belongs with S01.

## S07 — Confirmed CE-02 regressions

Recorded in full in [BASELINE_CURRENT.md](BASELINE_CURRENT.md) and fixed during
CE-02; repeated here so this audit stands alone.

- `LinksScene` was given the globally filtered people list while its search box
  wrote the shared query, so searching a name emptied that person's
  constellation (`tests/index-experience.spec.ts:159`).
- A single-valued `detail` union discarded an active film when a record opened
  over it, breaking the tested MG-03 film-to-record-and-back journey
  (`tests/years-media.spec.ts:163`). Recorded as decision D08.
- `npm run test:kiosk` exited 1 with **zero** tests collected, because a
  Vite-`define`-dependent import reached a Node-context spec. The entire visitor
  regression suite provided no coverage while this was true.

The third is the one worth generalizing: a single bad import silenced every test
and the command still looked like an ordinary failure. Nothing in the repository
asserts that the suite collected a plausible number of tests.

## S08 — Retained legacy code is genuinely inert, and its retention has no stated exit

**Severity: low, recorded for CE-11.**

Roughly 7,000 lines across `src/features/living-hall/`, `src/app/App.tsx`,
`src/features/inductee-detail/` and `src/data/traceModel.ts` are retained as
"legacy/rollback code" per the root `AGENTS.md`. They are correctly excluded
from the visitor bundle — `LivingHall`, `CityQuestion`, `InducteeDetail`,
`commandSearch`, `traceModel` and `connectionGraph` each appear **0** times in
`dist/assets/index-*.js`. Tree-shaking works and this costs visitors nothing.

It does cost every typecheck, every refactor and every reviewer. O11 asks staff
to "restore last known-good package", which is an artifact-level rollback, not a
different React tree. No document describes a scenario in which this code is the
thing restored. CE-11 should either state that scenario or retire the code.

---

## What this changes about the plan

1. **CE-10 is larger than it reads.** S04 is a replacement, not an extension,
   and O05/O04 are currently implemented backwards.
2. **A gap exists between CE-01 and CE-10 that no stage owns.** S01, S02, S03
   and S06 are all runtime content integrity. CE-01 was explicitly build-time
   and closed correctly; CE-10 is packaging and delivery. The proposed
   [CE-12](prompts/CE-12_runtime-integrity-and-override-boundary.md) stage
   covers the middle, and CE-10 depends on its outcome because a versioned
   offline package needs a content revision that something actually reads.
3. **Four acceptance cases cannot pass today for reasons the matrix does not
   state.** P08, O02, O05 and O06 are not merely unimplemented; the current code
   does the opposite. The additional cases proposed in the
   [acceptance addendum](ACCEPTANCE_TESTS.md#addendum-source-audit-cases) make
   the specific behaviors testable.
4. **One evidence source should stop being cited as it is.** See S05.

Nothing in this audit is a curatorial, rights, accessibility or installation
finding, and none of it authorizes a deployment.
