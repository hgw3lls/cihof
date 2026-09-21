# EV-09 — Gate the artifact and hand it over

**Depends on:** all prior stages that shipped
**Cases:** O10, O11, and the full matrix for whatever is in the release

## Goal

A specific, hash-identified artifact is tested as-is and handed to staff with
what they need to run, diagnose and roll it back.

## Why here

Last, and deliberately inheriting rather than closing MG-08's open sign-offs.

## Work

Smoke-test the exact output without rebuilding it and without injecting test
timing settings. Record the hash, the content revision and the build target.

Write the operator handoff: which release is running, how to tell, how to
provision, how to recover, how to restore the last known-good package. Answer
open question Q6 explicitly — whether this release is portrait-and-biography
only, and say so in the handoff rather than implying more.

Resolve decision E09: either state the scenario in which the ~7,000 lines of
retained legacy code is what gets restored, or retire it. O11 describes an
artifact-level rollback, not a different React tree.

Carry forward, without closing: external QR destination mobile reflow, physical
reach and installation access, assistive-technology and independent nonvisual
access, pinned Node 22 verification, curatorial and visual review, and pending
media holdings. Each closes only on evidence from the responsible role.

## Acceptance

O10 and O11 pass. Every case applicable to what actually shipped passes, with
collected counts recorded. No sign-off is marked closed by association with this
stage.

## Completion

`completions/EV-09.md`; update the tracker; hand over. **No push, merge,
deployment or permission change is authorized by this plan at any stage.**
