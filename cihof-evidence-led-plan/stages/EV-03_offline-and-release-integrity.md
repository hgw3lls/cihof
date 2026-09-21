# EV-03 — Offline operation and a release that can be rolled back

**Depends on:** EV-02
**Cases:** O01–O08, O11, O12, O13, O14

## Goal

A provisioned device opens offline, including a person it has never visited; a
new release activates deliberately; and the previous release survives long
enough to return to.

## Why here

Third, not last. The kiosk is meant to run without a network and currently
cannot open an unvisited deep link offline. CE-10 placed this after six feature
stages, which suits a product that is not yet live. This one is live.

## Scope correction

This is a **replacement** of `public/sw.js`, not an extension. Two acceptance
cases are currently implemented backwards, not merely missing — see
[AUDIT.md](../AUDIT.md) §2.4:

- `skipWaiting()` + `clients.claim()` hijack a session in progress. **O05
  requires the opposite.**
- `activate` deletes every prior cache, so **O04** has nothing to fall back to.
- There is no precache, so O01–O03 have nothing to build on.
- `networkFirst` awaits `cache.put` inside its `try`, discarding a response that
  already arrived when the write fails. That is **O06** as a live defect.

Do not cite `npm run validate:offline` as offline evidence. It checks that asset
references resolve inside `dist/` and never loads anything with the network off
(§2.5). Rename it to what it measures, or make it earn the name.

## File targets

- `public/sw.js`
- `src/app/serviceWorkerRegistration.ts`
- `scripts/validate-offline-package.js`
- `scripts/prepare-data.js`, `vite.config.ts` for a generated release manifest

## Work

Generate a versioned release manifest with per-asset checksums at build time,
keyed to the content revision EV-02 made readable. Precache from it. Report
provisioning status honestly, including an interrupted provision.

Replace the activation model: a new worker waits, and takes over at an agreed
idle, reset or restart point, coordinated from the registration side. Keep the
previous release until the new one has activated successfully.

Handle storage failure so a cache-write error never blanks a response the page
already received.

Answer open question Q3 first: whether the installation must run without a
network, and for how long. If the answer is no, this stage reduces to release
versioning and rollback, and that reduction is recorded.

## Acceptance

Listed cases pass, exercised with the network actually off and with a forced
cache-write failure — not by assuming success. Rollback is demonstrated: staff
identify the running release, inspect what is missing, and restore the last
known-good package.

## Completion

`completions/EV-03.md`; update the tracker. Stop for review.
