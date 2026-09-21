# City-experience task tracker

All CE stages are implementation tasks and begin as **Not started**. The accompanying static audit is completed within its stated scope; that does not complete CE-00's checks in the actual implementation environment.

| Stage | Scope | Dependencies | Status |
|---|---|---|---|
| [CE-00](prompts/CE-00_baseline-and-adoption.md) | Refresh the baseline and adopt the extension deliberately | None | Complete, refreshed 2026-09-21 ([record](completions/CE-00.md), [baseline](BASELINE_CURRENT.md)) |
| [CE-01](prompts/CE-01_content-contracts-and-publication.md) | Make content semantics and publication rules explicit | CE-00 | Complete ([record](completions/CE-01.md)) |
| [CE-02](prompts/CE-02_shared-state-and-navigation.md) | Unify selection, filters, history and session state | CE-01 | In progress; code in the working tree, no completion record, 2 regressions and a non-collecting visitor suite open |
| [CE-03](prompts/CE-03_portrait-regrouping-and-discovery.md) | Create the signature collection-regrouping interaction | CE-02 | Not started |
| [CE-04](prompts/CE-04_contribution-stories-and-evidence.md) | Turn a selected person into a sourced, layered encounter | CE-01, CE-02, CE-03 | Not started |
| [CE-05](prompts/CE-05_cleveland-places.md) | Make Cleveland places a real entry into the collection | CE-01, CE-02, CE-03, CE-04 | Not started |
| [CE-06](prompts/CE-06_connections-and-comparison.md) | Explain relationships and place two lives in dialogue | CE-01, CE-02, CE-03, CE-04, CE-05 | Not started |
| [CE-07](prompts/CE-07_historical-activity.md) | Add historical time without confusing it with induction | CE-01, CE-02, CE-03, CE-04, CE-05, CE-06 | Not started |
| [CE-08](prompts/CE-08_walk-up-trails-and-continuation.md) | Complete the walk-up invitation and public continuation | CE-02, CE-03, CE-04, CE-05, CE-06, CE-07 | Not started |
| [CE-09](prompts/CE-09_access-and-performance.md) | Review access, installed-display interaction and measured performance | CE-03, CE-04, CE-05, CE-06, CE-07, CE-08 | Not started |
| [CE-10](prompts/CE-10_offline-provisioning-and-recovery.md) | Make offline operation a versioned, recoverable package | CE-01–CE-09, **CE-12** | Not started; re-scoped 2026-09-21 as a service-worker replacement, not an extension. See the [scope correction](prompts/CE-10_offline-provisioning-and-recovery.md#scope-correction-2026-09-21). |
| [CE-11](prompts/CE-11_release-gates-and-handoff.md) | Gate the exact release artifact and hand it to staff | CE-00, CE-01, CE-02, CE-03, CE-04, CE-05, CE-06, CE-07, CE-08, CE-09, CE-10 | Not started |
| [CE-12](prompts/CE-12_runtime-integrity-and-override-boundary.md) | Make the published content boundary hold at runtime | CE-01 | Not started; added 2026-09-21 from the [source audit](CIHOF_Source_Audit.md). CE-10 depends on it. |

## Current baseline warning

`npm run test:kiosk` exits 1 having collected zero tests. The visitor
regression suite is therefore not providing coverage for any stage until CE-02
restores it. The last measured result, excluding the spec that breaks
collection, is 70 passed and 2 failed of 72. See
[BASELINE_CURRENT.md](BASELINE_CURRENT.md).

## Existing MG work

At the pinned audit SHA, the MG tracker records MG-00–04 Complete, MG-05/06 Ready for review, and MG-07/08 Not started. Preserve its history. CE-10 supplies the applicable MG-07 work; CE-11 supplies the applicable MG-08 work. Do not close their external sign-offs by association with a new CE stage.

Statuses: Not started, In progress, Blocked, Ready for review, Complete. Add an actual completion/evidence link when updating a row. Separate code readiness, content publication readiness, exact-artifact checks and physical installation approval. The content team may review material in parallel, but it does not authorize subsequent coding stages or a production deployment.
