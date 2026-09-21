# EV-00 — Adopt this plan and fix the baseline in place

**Depends on:** none

## Goal

Establish what HEAD and the working tree actually contain, record this plan's
relationship to the MG and CE work, and change nothing else.

## Why here

Cheap, and every later stage cites it.

## Already done

`cihof-city-experience/BASELINE_CURRENT.md` and `completions/CE-00.md` were
refreshed on 2026-09-21 against the current tree and are accurate. This stage
adopts them by reference rather than repeating the measurement. What it adds is
this plan's own boundary statement.

## Work

Record: the SHA, the dirty-tree boundary by stage, the MG crosswalk, and which
CE stages are complete (CE-00, CE-01), in progress (CE-02) and superseded by
this plan's sequencing (CE-03 through CE-11 remain valid as *destinations*; their
order does not).

State plainly that this plan does not close any MG sign-off, does not
re-open CE-01, and does not authorize a deployment.

Do not reset or discard newer work. Do not change a code path.

## Acceptance

The boundary, the crosswalk and the supersession statement are explicit and
checkable. No code path changed.

## Completion

`completions/EV-00.md` from the template; update [TRACKER.md](../TRACKER.md).
Stop for review.
