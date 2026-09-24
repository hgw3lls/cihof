# EV-01 — Make the regression suite trustworthy

**Depends on:** EV-00
**Cases:** E-A1, T19

## Goal

A test run that does not actually run fails loudly, and the suite is free of
the flake that makes its results arguable.

## Why here

First, because every later claim in this plan depends on a suite result.
`npm run test:kiosk` exited 1 having collected **zero** tests while two live
regressions sat behind the silence, and the output looked like an ordinary
failure. See [AUDIT.md](../AUDIT.md) §2.7.

## Already done

The import that broke collection is fixed and verified: `interpretiveModel.ts`
no longer reaches `buildInfo`, and the suite collects 82 tests, 81 passing. The
*guard* that would have caught it does not exist yet. That is this stage.

## File targets

- `playwright.config.ts`
- `package.json`
- `tests/links-relationships.spec.ts`
- CI workflow, if a test job is added

## Work

Assert a minimum collected count, maintained alongside the suite, so a
collection error or an over-narrow filter fails rather than reporting nothing.
Prefer a mechanism the runner supports directly over a wrapper script.

Fix the order-dependent focus flake in
`tests/links-relationships.spec.ts:221`. It passes in isolation and fails after
a preceding spec; diagnose the shared state rather than adding a retry. The
connection-list toggle focuses `#linkRelationListTitle` on a
`requestAnimationFrame` after opening, which is the place to look.

Record whether the suite should run in CI at all. It currently does not; the
Pages workflow builds and deploys without running a test.

## Acceptance

E-A1 and T19 pass. A deliberately broken import fails the run with a message
that names the cause. The flake passes 10 consecutive full-suite runs. The
collected count appears in the stage record.

## Completion

`completions/EV-01.md`; update the tracker. Stop for review.
