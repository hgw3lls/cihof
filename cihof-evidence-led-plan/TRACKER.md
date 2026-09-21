# Evidence-led plan tracker

All EV stages begin **Not started** unless noted. Status values: Not started,
In progress, Blocked, Below threshold, Ready for review, Complete.

Code readiness, content-publication readiness, exact-artifact checks and
physical installation approval are tracked separately and never inferred from
one another.

| Stage | Scope | Depends on | Gate | Status |
|---|---|---|---|---|
| [EV-00](stages/EV-00_adopt-and-baseline.md) | Adopt this plan; fix the baseline in place | — | — | Complete ([record](completions/EV-00.md)) |
| [EV-01](stages/EV-01_trustworthy-suite.md) | A run that does not run, fails | EV-00 | — | Ready for review ([record](completions/EV-01.md)); 10/10 consecutive full-suite runs, 82 collected |
| [EV-02](stages/EV-02_runtime-content-integrity.md) | The content boundary holds at runtime | EV-01 | — | Not started |
| [EV-03](stages/EV-03_offline-and-release-integrity.md) | Offline operation and a rollback-able release | EV-02 | Q3 | Not started; service-worker **replacement**, not extension |
| [EV-04](stages/EV-04_honest-text.md) | Say which words the pipeline wrote | EV-01 | Q1, Q5 | Not started |
| [EV-05](stages/EV-05_review-pipeline.md) | Legacy fields → reviewed records | EV-02, EV-04 | — | Not started; **critical path** |
| [EV-06](stages/EV-06_relationships.md) | Documented relationships in the constellation | EV-05 | ≥ 15 approved `inducted_by` | Below threshold (0) |
| [EV-07](stages/EV-07_galleries.md) | Reach the images already approved | EV-02 | none — content exists | Not started |
| [EV-08](stages/EV-08_gated-surfaces.md) | Places, stories, comparison, time | EV-05, EV-06 | Q2 per surface | Below threshold (0 on all four) |
| [EV-09](stages/EV-09_release-and-handoff.md) | Gate the artifact; hand it over | all shipped stages | — | Not started |

## Review throughput

EV-06 through EV-08 are gated on these. EV-05 makes them real numbers; until
then they are queue sizes measured from the published record.

| Queue | Size | Approved | Threshold |
|---|---|---|---|
| `inducted_by`, both in collection | 24 | 0 | 15 |
| `inducted_by`, external inductor | 87 | 0 | policy decision, not a count |
| Story beat candidates | 444 sentences / 111 people | 0 | 20 people |
| Place seeds | 14 | 0 | 8 |
| Vocabulary labels | 53 | 0 | — |
| Archive leads | 11 | 0 | — |

## Relationship to the other plans

**MG** (`cihof-museum-upgrade/`): MG-00–04 Complete, MG-05/06 Ready for review,
MG-07/08 Not started. Nothing here closes an MG sign-off. The open items —
external QR reflow, physical reach, assistive technology, pinned Node 22,
curatorial review, pending media — carry into EV-09.

**CE** (`cihof-city-experience/`): CE-00 and CE-01 are Complete and this plan
builds on them rather than revisiting them. CE-02 is in progress in the working
tree, with its three known defects fixed and verified. CE-03 through CE-11
remain valid as *destinations*; EV-08 cites their prompts as the design source
for each surface. Their **order** is superseded by decision E03. CE-12, added
during the source audit, is folded into EV-02.

## Open questions

Six are recorded in [DECISIONS.md](DECISIONS.md#open-questions-for-people-other-than-engineers).
Q1 and Q5 gate EV-04, Q2 gates EV-08, Q3 gates EV-03 scope, Q4 is answered
inside EV-02, and Q6 gates whether EV-06 onward run at all. No stage may answer
one of these by implementing it.

## Standing baseline note

As of 2026-09-21 the visitor suite collects 82 tests and passes 82, verified
over 10 consecutive full-suite runs. The order-dependent focus flake in
`tests/links-relationships.spec.ts:221` was a product defect and is fixed.
Before that date the suite collected **zero** tests and reported it as an
ordinary failure. Every stage record must state its collected count.
