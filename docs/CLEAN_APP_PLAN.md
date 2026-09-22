# Clean App Plan

**Target end state: two surfaces.** A kiosk app with admin settings, and a staff portal for editing the data. Nothing else ships. GitHub Pages is strictly a quick testing ground — a place to eyeball work in a browser, never a product surface.

This is not a migration plan. **The rewrite already exists.** It was built on the `rewrite` branch on 2026-09-21 and merged to `main` the same day. What never happened is the second half: the old app was never retired. So this document is about *finishing* the clean app and deleting the old one, not about incrementally evolving the old one into something better.

If you are picking this up cold, read §1 and §2, then skip to §6.

---

## 1. Where things actually stand

Three front ends live on `main` right now. Only the oldest one ships.

**The old app** is the repository root: `index.html` → `src/app/main.tsx` (visitor) and `portal.html` → `src/app/portal-main.tsx` (staff). Vite + React, ~25,000 lines under `src/`. It builds to three targets via `CIHOF_BUILD_TARGET` (`public` → `dist/`, `kiosk` → `dist/`, `portal` → `dist-portal/`). The GitHub Pages workflow builds `npm run build:public` and deploys it. This is the only thing currently published anywhere.

**The new exhibit** is `apps/exhibit/` (`@cihof/exhibit`) — "the installed exhibit. A long-running, offline-capable touch surface." ~1,700 lines. People and Years lenses, a record panel, film playback, a share panel, session timeout, a service worker that precaches from a release manifest, and `Recovery.tsx` for rolling back to a previous release. Built with `npm run build --workspace @cihof/exhibit`, which runs `scripts/publish.mjs` (writes the runtime bundle and cleared portraits), then `vite build`, then `scripts/release.mjs` (hashes every file into `release.json` and stamps the service worker).

**The new companion** is `apps/web/` (`@cihof/web`) — an Astro static site, four source files, 111 pages, no JavaScript. Its only purpose is to be the page a visitor lands on after scanning a QR code at the wall. Under a two-surface end state its fate depends on one open decision (§5).

**The shared model** is `packages/content/` (domain model and publication rules — no framework, no DOM, no build step) and `packages/pipeline/` (reads canonical sources under `data/`, emits published artifacts). These are the foundation of the clean app and the best code in the repository. The pipeline reads `data/*.json` **directly**; it does not depend on `scripts/prepare-data.js` output.

CI already tests all of this — the workflow runs the exhibit's unit tests and browser suite, the companion's browser suite, and both package test suites. It just never builds or deploys any of it.

### What the old app still holds that the new one does not

- **The staff portal.** No equivalent exists anywhere in `apps/` or `packages/`.
- **Kiosk admin settings** (`?admin=1`). No equivalent in `apps/exhibit`.
- **The Links/Connections lens.** Not a code gap — a content gap. See below.
- **The Places lens.** Same.
- **Standards exports** — Linked Art, CIDOC-CRM, IIIF collection plus 111 per-person manifests — produced by `scripts/prepare-data.js`. The new pipeline has no equivalent.
- **The entity model, story sections, story lenses, physical wall positions, archive leads.** Also `prepare-data.js` only.

On Links: `packages/content/src/lenses.ts` sets the threshold at 15 *reviewed, documented* relationships. `packages/pipeline/tests/lens-gate.test.ts` asserts that today the collection offers `['people', 'years']` only, with zero relationships and zero places. The old app's Links scene is built from ~2,041 entity relationships that include shared induction year; the new model refuses that on purpose — two people honoured the same year "have a context in common, not a relationship." Links returns when curators approve 15 relationships with evidence **and** someone writes the `Links.tsx` component. `App.tsx` already has the label; there is no view.

---

## 2. The two things genuinely missing

### Kiosk admin settings — a partial port

The old `AdminDataPanel.tsx` (333 lines) is a four-tab modal: Data (export/import a local bundle), Settings (`AdminSettingsControls.tsx`, 306 lines), Review (`AdminReviewQueue.tsx`, 413 lines), Diagnostics (`AdminDiagnosticsControls.tsx`, 306 lines). Settings persist to `localStorage` under `cihof.kiosk-settings.v1` and broadcast a `cihof:kiosk-settings-changed` event so the running app picks up changes live. There is a passcode form, a Lock button, and a configurable admin hotkey.

What to bring across is less than it looks:

- **Port the pattern, not the code.** The modal shell, passcode/lock, localStorage persistence and change-event approach all transfer. The components do not — they are built against the old app's visual system.
- **Most settings fields should be deleted.** `portraitScale`, `fieldInsetVmin`, `attractRegroupMs`, `showVocabulary`, `showRecordLayer` belong to the Living Hall visuals, which do not exist in `apps/exhibit`. What survives is roughly: idle timeout, idle warning, motion intensity, touch cue, admin hotkey, passcode.
- **Review queue and diagnostics belong in the portal, not the kiosk.** A curator with a laptop is a better home for a review queue than a wall display someone has to crouch in front of. Moving them also shrinks kiosk admin to something finishable.
- **Import/export needs rethinking, not porting.** `apps/exhibit` already has `release.json` + service-worker precache + rollback as its content delivery mechanism. A second "import a data file" path competes with it and can put a display into a state `release.json` does not describe.

`apps/exhibit` already has the public-stub pattern that keeps admin out of a public artifact (`Recovery.public-stub.tsx`, mirroring the old `AdminDataPanel.public-stub.tsx`). Reuse it.

**One design conflict must be settled before writing any of this.** See §5.

### The staff portal — a rewrite, blocked on something that does not exist

The old portal is better engineered than it looks from outside, and understanding it changes the build-vs-port math.

`portal.html` → `PortalApp.tsx` → `ReviewDashboardView.tsx` is a **UI over `scripts/portal-runner.js`** — a token-authed localhost HTTP server (default `127.0.0.1:5174`) with write access to the repository. It is not a hosted CMS. It is a local editorial tool attached to a git working tree.

Endpoints: `GET /api/health`, `/api/scripts`, `/api/jobs`, `/api/jobs/:id`, `/api/story-lenses`, `/api/relationships`; `POST /api/run`, `/api/story-lenses`, `/api/relationships`, `/api/apply-decisions`.

It writes in three ways:

1. **Direct file writes.** `POST /api/story-lenses` writes `data/cihof_story_lenses.json` and mirrors to `public/data/story-lenses.json`. `POST /api/relationships` does the same for `data/cihof_relationships.json`.
2. **Script execution.** `POST /api/run` spawns whitelisted npm scripts as child processes — `prepare:data`, `curate:report`, `media:validate`, `validate:entities`, `validate:kiosk`, `validate:media-clearance`, `validate:offline`, `audit:data`, `build`, `build:kiosk`, `curate:metadata`, `media:manifest`, `media:localize`, `import:2026` — queued, logged to `.portal/jobs/`, pollable.
3. **The decisions pipeline** (`POST /api/apply-decisions`), which is the part worth protecting. A curator's edits become a CSV written to `.portal/decisions/`, then run through `curate:apply` / `media:apply`. Applying for real is gated three ways: a successful **dry run** must have happened in this session; the **CSV hash must match** that dry run; and the **git tree must be clean**. Then it chains apply → `prepare:data` → `curate:report` → `media:validate` → `validate:entities` → `build`.

In-progress edits live in browser `localStorage` (`cihof.portal.reviewDrafts.v1`, `cihof.portal.relationshipDrafts.v1`) and are not authoritative until applied.

So a curator's real loop is: **edit in browser → drafts in localStorage → export decisions CSV → dry run → apply → regenerate → commit.** Every editorial change lands as a reviewable git diff on canonical `data/*.json`.

**Verdict:** `portal-runner.js` ports nearly as-is — the job queue, dry-run gate, hash match, clean-tree gate and token auth are model-agnostic mechanism. The React UI (`src/features/review-dashboard/`, 6,521 lines) is a rewrite: it is shaped around the old flat `Inductee` record and field-level approval granularity.

**And it is blocked.** `@cihof/content` defines *validation* — `isPublished`, `isApproved`, `isAttributable`, `isDocumented`, `allowsTarget`, `facetable` — but there is **no write path**. Nothing anywhere constructs a review record, assigns a `decisionReference`, or migrates an old field decision into a new claim decision. That has to be designed before the portal UI is worth starting.

---

## 3. The write-path design problem

This is step one of the portal, and it is invention rather than migration. Stating it precisely so it can be worked on.

The old model is **per-person, per-field approval**: a row per inductee, columns of field decisions, applied by `curate:apply` / `media:apply`.

The new model is **per-claim review with evidence**. From `packages/content/src/publication.ts`:

```ts
export type Review = {
  status: 'draft' | 'needs-review' | 'approved' | 'withheld';
  decisionReference?: string;  // required for approval
  contentVersion?: string;     // required for approval
  reviewedAt?: string;
  note?: string;
};

export type Publication = { publicWeb: boolean; kiosk: boolean; staffOnly?: boolean };
```

and `isApproved` refuses a bare approval:

> *"A bare `status: 'approved'` is not enough: without a decision reference the approval cannot be traced to a person, and without a content version it cannot be told which wording it covered."*

Three things the old portal has no concept of:

**`decisionReference`.** Every approval must name the decision that authorised it. The old CSV records a value, not a provenance. Open question: what *is* a decision reference — a row in a decisions log, a meeting minute id, a portal-generated id tied to a named curator and timestamp? Whatever it is, it has to be creatable in the portal and durable in git.

**`contentVersion`.** An approval covers a specific wording. If the text changes afterwards, the approval no longer applies. Open question: how is a content version derived — a hash of the field value, the `contentRevision` from the runtime bundle, or something coarser? The pipeline already computes a content revision (`revisionOf()` in `packages/pipeline/src/build/emit.ts`) derived from content only, never build time, so there is a precedent to follow.

**Evidence per claim.** `packages/content/src/connection.ts` requires `evidence[]` for anything `documented`. The shape from `packages/pipeline/tests/lens-gate.test.ts`:

```ts
evidence: [{ id: 'fixture-ev-0', title: 'Fixture collection record', kind: 'collection-record' }]
```

This is why Links shows zero today — not missing data, but data that has never been through a review that attaches evidence. Making evidence capture the normal path is a UX problem more than a code problem. If the portal makes it painful, relationships never get approved and Links never returns.

Two decisions to make while designing this:

- **Granularity.** The new model wants review at the claim level; the old portal reviews at the field level. A decisions CSV can carry claim rows, but that is a schema change, not a column rename.
- **Keep `publicWeb` / `kiosk` separate.** It will be tempting to collapse them to one flag now that there is no public site. Don't. Film rights differ by target, `data/media_manifest.json` is built around the distinction, `lens-gate.test.ts` explicitly proves a kiosk approval does not open a lens on the public target, and the whole clearance safety story in §6 depends on the two being independent.

Deliverable for this step: a new module in `packages/content/` (say `decision.ts`) that constructs and validates review records, with tests, plus a written note on migration — which existing approvals can be carried forward and which need re-review.

---

## 4. What to preserve from the old app, and why

**`scripts/portal-runner.js` — above all.** It encodes an editorial workflow that would be expensive to rediscover: dry run first, hash match, clean tree, every change a git diff. Port the mechanism; re-point the script whitelist and the two direct-write endpoints at pipeline equivalents.

**The parity oracle.** `packages/pipeline/tests/parity.test.ts` compares the rewrite field-by-field against `public/data/cihof-runtime-data.json` for all 111 people — *"A from-scratch generator can silently drop a curatorial decision, and nothing about the output would look wrong."* That reference file is a `prepare-data.js` artifact, committed to the repo. If `prepare-data` goes away or stops being regenerated, the test quietly starts comparing against stale output and stops meaning anything. **Snapshot it as a fixture first** (§6 step 1).

**`npm run media:assert`** (`scripts/assert-film-assets.mjs`). With no public site, the kiosk is the only place films appear, so the guard against untracked captions matters more, not less. The failure it prevents is silent: a film's captions stay untracked, a fresh checkout builds without them, and the film never appears on the wall with no error anywhere.

**Canonical `data/*.json`.** Read by both pipelines. This is the actual product.

**The scripts the portal runner calls:** `curate:apply`, `media:apply`, `curate:report`, `media:validate`, `validate:entities`, plus `scripts/data-utils.js`, `scripts/entity-model.js`, `scripts/relationship-metadata.js`.

**`scripts/prepare-data.js`** stays until the portal rewrite is proven. It is 1,373 lines writing ~20 outputs and it feeds the old portal's reports as well as the parity oracle.

---

## 5. Open decisions — these are yours, not engineering's

### 5.1 The QR take-home

`apps/exhibit/src/app/Share.tsx` draws a QR code from `continuationUrl()` in `packages/content/src/continuation.ts`. With no site configured it degrades cleanly: *"No public site is configured for this build, so there is nothing to link to. The full record is on this display."* It cannot be pointed at the portal — `continuation.ts` refuses any path matching `/portal`, `/admin`, `/review`, `/staff`.

It validates https, rejects unreachable hosts (`localhost`, `127.*`, `10.*`, `192.168.*`, `172.16–31.*`, `::1`, `*.local`), and rejects staff routes. It does **not** validate durability. A GitHub Pages preview URL would pass every check — and pointing wall codes at a preview means printing a URL you intend to break into strangers' browser history. The file says as much: *"A code on a wall is scanned by a stranger's phone and cannot be corrected once it is printed into someone's browser history."*

So Pages does not answer this. Three options:

- **Drop Share.** Remove the button and `Share.tsx`; `continuation.ts` becomes dead code. Visitors lose the take-home.
- **Keep `apps/web` on a durable public host** — the institution's own domain (`astro.config.mjs` already defaults `site` to `https://clevelandinternationalhalloffame.com`). Four source files, 111 static pages, no JavaScript, one build command. Cheap to keep, and it is exactly the job the config says it exists to do.
- **Leave it dark.** Not recommended — the button still renders and opens a modal explaining there is nothing to share.

**Rule regardless of choice: set `CIHOF_SITE_URL` only for a durable public address. Never for a preview build.**

### 5.2 Kiosk timing floor vs. runtime settings

`apps/exhibit/src/app/config.ts`:

> *"Short timings are only honoured when the build says it is a test build, and a test build says so on screen. A production build floors them instead, so a 1.6-second idle cannot ship to a wall by way of a stray environment variable."*

A runtime settings panel writing `localStorage` reopens exactly the door that comment closes. A workable answer: runtime settings may only *lengthen* timings, the production floor stays enforced in `config.ts` regardless of what storage says, and the panel is passcode-gated. But it needs deciding before the panel is written, or it gets written twice.

### 5.3 Do the standards exports have external consumers?

`prepare-data.js` emits Linked Art, CIDOC-CRM, and IIIF (a collection plus 111 per-person manifests). These are museum-sector interchange formats. If a consortium, aggregator, or grant deliverable consumes them, deleting them is an external breakage that will not show up in CI. Someone needs to confirm this outside the repository before §7 removes them.

---

## 6. The work, in order

Each step is intended to be one PR.

**1 — Freeze the parity oracle.** Copy `public/data/cihof-runtime-data.json` to a committed fixture (e.g. `packages/pipeline/tests/fixtures/published-runtime-data.json`) and re-point `parity.test.ts` at it. Cheapest possible de-risking; do it before touching anything else.

**2 — Repurpose Pages as a testing ground.** Replace the `build`/`deploy` jobs in `.github/workflows/pages.yml`:

```sh
CIHOF_TARGET=public npm run build --workspace @cihof/exhibit
# upload apps/exhibit/dist
```

Two fixes are mandatory in the same PR.

*Fail closed.* `apps/exhibit/scripts/publish.mjs` currently reads:

```js
const target = process.env.CIHOF_TARGET === 'public' ? 'public' : 'kiosk';
```

Anything that is not exactly `'public'` falls through to **kiosk**. For a job whose output is published, defaulting to the restricted target is backwards. Make the publish job fail if `CIHOF_TARGET` is unset. Note also that the old app uses `CIHOF_BUILD_TARGET` and the exhibit uses `CIHOF_TARGET` — setting the wrong one does nothing and raises no error.

*Assert the artifact, not the inputs.* Add a required step between build and deploy that:

- parses `apps/exhibit/dist/data/exhibit.json` and asserts `bundle.target === 'public'`
- asserts `bundle.people.every(p => p.films.length === 0)`
- asserts `bundle.filmReport.held === 93`
- walks `dist/` and fails on any `.mp4` / `.webm` / `.mov`
- greps the built JS for `youtube-nocookie.com` and fails if present

**Why this is a risky step, stated plainly.** All 93 films are now `approvedForKiosk: true` with rights, captions and transcripts approved, and `approvedForPublicWeb: true` on **zero** of them. Verified against `filmShortfalls`: kiosk publishes 93/93 in both delivery modes; public publishes 0/93, blocked solely by the `target` flag. Every prerequisite passes except one boolean. Publishing a kiosk artifact is therefore not "leaking unreviewed material" — it is overriding an explicit editorial refusal made deliberately on 93 records. And because all 93 carry a `youtubeVideoId`, a kiosk-target build with `CIHOF_FILM_DELIVERY=youtube` publishes 93 embedded players with no MP4 anywhere: *"no video payload in the artifact" is not the same as "safe to publish."*

The public exhibit build is structurally safe for two independent reasons — `publishableFilms` returns zero at the public target regardless of delivery mode, and `packages/pipeline/src/build/assets.ts` exports only `publishPortraits`, so no code path in the exhibit build copies video at all. The assertions above exist to catch a misconfiguration, not to do the filtering.

Note: `validate:media-clearance`, `validate:kiosk`, `validate:offline` and `validate:entities` do **not** run in CI at all today, and adding them would not catch this — they validate inputs for internal consistency, not the artifact for target compliance. No such check exists in the repository; step 2 creates the first one.

Also expect service-worker staleness on a shared `github.io` origin. The exhibit precaches from `release.json` at scope `/cihof/`, so a previous preview will serve you cached content. Hard-reload or unregister when previewing.

**3 — Document the exhibit release.** `apps/exhibit` has a real release mechanism — `release.mjs` hashes every built file into `release.json` and stamps the service worker, so an identical rebuild produces an identical revision and a display can distinguish "new release" from "same release, served again." Nothing describes how that release reaches the wall. Add a CI job producing `apps/exhibit/dist` + `release.json` as a workflow artifact, with `CIHOF_BASE_PATH` set, and write the provisioning steps down. This is where "ship" stops meaning someone's laptop.

**4 — Extend the build-boundary rules in `AGENTS.md`.** Its current rules name only `build:public` / `build:kiosk` / `build:portal` — the *old* app's targets. Someone reading it carefully and then running an exhibit build is outside the documented rules entirely. Add `CIHOF_TARGET`, and correct the `README.md` line claiming the kiosk build contains media "even when review is pending." That is now false and misleading in the dangerous direction: the films are fully reviewed and under an explicit public-web refusal, which calls for more care, not less.

**5 — Settle the timing-floor policy (§5.2), then build kiosk admin.** Passcode, lock, the surviving settings fields, localStorage persistence with the change event, public-stub swap. Leave review queue and diagnostics out — they go in the portal.

**6 — Design the review-record write path (§3).** New module in `packages/content/`, with tests, plus a written migration note. **Do this before any portal UI.** *Risky: this is invention, it is on the critical path for the portal, and if one step slips it is this one.*

**7 — Re-point `portal-runner.js`** at pipeline scripts, keeping the dry-run / hash-match / clean-tree gates intact. Verify the gates still hold against the new apply path. *Risky: the gates are the safety property; a port that loosens them is worse than no port.*

**8 — Build the new portal UI** against the step-6 model. Include the review queue and diagnostics here, ported from `AdminReviewQueue.tsx` and `AdminDiagnosticsControls.tsx`. *Risky: evidence capture is the make-or-break UX problem. If approving a relationship is tedious, nothing gets approved and Links never returns.*

**9 — Resolve the QR decision (§5.1)** and either keep `apps/web` on a durable host or remove it and `Share.tsx`.

**10 — Delete the old app (§7).**

**11 — Rewrite `AGENTS.md`, `DEPLOYMENT.md`, `README.md`** to describe two surfaces. `DEPLOYMENT.md` is already wrong today — it claims the workflow runs `npm run build` and `npm run audit:data`, when it runs `npm run build:public` and has no audit step.

### Day-to-day loop while doing this

```sh
npm ci                                                    # root, installs all workspaces

npm run dev       --workspace @cihof/exhibit              # prebuild + vite
npm run test      --workspace @cihof/exhibit              # node --test, unit
npx playwright test -c apps/exhibit/playwright.config.ts  # browser suite

npm test --workspace @cihof/content
npm test --workspace @cihof/pipeline
npm run crosswalk:check                                   # curator sheets current
npm run media:assert                                      # film assets tracked
```

Ignore for this loop: `npm run dev`, `build`, `build:public`, `build:kiosk`, `test:kiosk`, `test:staff`, every `mg0*:capture`, `baseline:capture`, `typecheck:app`. Keep using the data-side scripts — `media:*`, `curate:*`, `content:*`, `source:*` — since they maintain the canonical `data/` files both pipelines read.

Preview films locally only. They exist solely at the kiosk target, which must not be published, so a Pages preview will never show them.

---

## 7. What gets deleted, and when

Nothing is deleted until the thing replacing it is proven. The order matters more than the list.

**After step 2** (Pages repurposed): the `build:public` target and its workflow jobs stop being a product path. Leave the script in place; it costs nothing and `prepare-data` still feeds the parity oracle and the old portal.

**After step 5** (kiosk admin done): `src/features/archive-exhibit/`, `src/features/living-hall/`, `src/features/inductee-detail/`, `src/features/admin/`, `index.html`, `src/app/main.tsx`, and the final-exhibit styles become dead. They can go, but there is little benefit in removing them before step 8 — the old visitor app is also the only working reference for behaviour the new one may still need to match.

**After step 8** (portal proven, running against the new model for at least one real editorial cycle): `portal.html`, `src/app/portal-main.tsx`, `src/features/review-dashboard/`, `playwright.portal.config.ts`, `playwright.staff.config.ts`, `tests/portal-*.spec.ts`, `tests/staff-admin.spec.ts`, `tests/admin-access-settings.spec.ts`, and the root `vite.config.ts` / `tsconfig.json` / `dist-portal` machinery.

Then `scripts/prepare-data.js` and its ~20 outputs — **only if §5.3 confirms the standards exports have no external consumers**, and **only after** step 1's fixture has replaced it as the parity oracle.

**After step 9:** `apps/web/` and `packages/content/src/continuation.ts`, if the QR decision is to drop Share.

**Never delete:** `data/*.json`, `packages/content/`, `packages/pipeline/`, `scripts/assert-film-assets.mjs`, and whatever `portal-runner.js` becomes.

The root app goes last. Until the portal is proven, it is the only tool curators have for editing the collection, and deleting it early trades a tidy repository for a broken institution.
