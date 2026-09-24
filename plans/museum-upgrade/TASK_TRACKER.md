# Upgrade task tracker

**Current state:** MG-06 software implementation is ready for review. External mobile continuation, physical reach, and assistive-technology sign-off remain open. MG-07 has not started.

| Task | Scope | Depends on | Status | Evidence / review |
|---|---|---|---|---|
| [MG-00](tasks/MG-00_baseline.md) | Establish the baseline and actual product boundary | None | Complete | [Baseline report](../docs/museum-upgrade-baseline-2026-09-20.md); [completion record](completions/MG-00.md); local state atlas in `artifacts/mg00-baseline/` |
| [MG-01](tasks/MG-01_inclusive-collection.md) | Inclusive collection and stable visitor context | MG-00 | Complete | [Completion record](completions/MG-01.md); local visual review in `artifacts/mg01-review/`; visitor tests 17/17 |
| [MG-02](tasks/MG-02_session-reset.md) | Authoritative reset and accessible sessions | MG-01 | Complete | [Completion record](completions/MG-02.md); local visual review in `artifacts/mg02-review/`; visitor tests 22/22 |
| [MG-03](tasks/MG-03_years-and-media.md) | Complete induction chronology and dependable media | MG-01–02 | Complete | [Completion record](completions/MG-03.md); local visual review in `artifacts/mg03-review/`; visitor tests 28/28 |
| [MG-04](tasks/MG-04_relationship-evidence.md) | Truthful, visible relationship explanations | MG-01 | Complete | [Completion record](completions/MG-04.md); [publication workflow](../docs/relationship-publication-workflow.md); local visual review in `artifacts/mg04-review/`; visitor tests 37/37 |
| [MG-05](tasks/MG-05_interpretation-and-design.md) | Interpretive hierarchy, approved text, and visual refinement | MG-01, MG-03–04 | Ready for review | [Completion record](completions/MG-05.md); [content workflow](../docs/interpretive-content-workflow.md); local visual evidence in `artifacts/mg05-review/` |
| [MG-06](tasks/MG-06_accessibility.md) | Accessibility, reachable operation, and continuation | MG-02–05 | Ready for review | [Completion record](completions/MG-06.md); [installation review and blockers](../docs/accessibility-installation-review.md); 57 visitor tests, 18 final focused checks, 2 portal tests passed; local evidence in `artifacts/mg06-review/` |
| [MG-07](tasks/MG-07_offline-and-recovery.md) | Offline package, safe updates, and recovery | MG-00, MG-02–03 | Not started | — |
| [MG-08](tasks/MG-08_release-and-handoff.md) | Release gates, operations, and actual sign-off | MG-01–07 | Not started | — |

## Open Sign-Off Items

Post-review fixes (2026-09-20): the three MG-00--06 review findings are fixed.
Replay/backward-seek progress extends active kiosk sessions; Years restores the
browsed position on record return; Links preserves the explored connection.
The full visitor suite passed 61/61, including four new regression cases.
See [review fix record](completions/MG-00-06-review-fixes.md). This does not close
the sign-off items below or start MG-07/MG-08.

Carry these items into MG-07 handoff and MG-08 release review. Passing offline,
build, or automated accessibility tests does not close them. This is a review
checklist, not an already-implemented automated deployment gate.

| Item | Status / responsible role | Evidence needed to close |
|---|---|---|
| External QR destination mobile reflow | Open; institution's website owner | Fix the observed 700px document at a 390px client viewport, or authorize a tested public companion route; verify the same person's complete record on real phones. Only one remote profile was checked so far. |
| Physical reach and installation access | Open; installation team and accessibility reviewers | Record screen dimensions, mounting/control heights, OS scaling, input/shelf placement and approach/clearance; test seated and standing journeys. The lower-screen prototype is not sign-off. |
| Assistive technology and independent blind-visitor access | Open; institution and accessibility reviewers | VoiceOver/NVDA/TalkBack journeys on the supported setup, plus an agreed independent access path that does not require a visitor's phone. Automated scans are not a substitute. |
| Pinned Node 22 verification | Open; development/release operator | Resolve the missing Homebrew library or provision a working pinned runtime, then rerun required release checks. Current verification used Node 26.8.1. |
| Curatorial and visual review | Open; authorized curators | Review MG-05 invitation, vocabulary, summaries, source/context decisions, paragraph migrations and portrait crops. Do not infer approval from generated field names or passing tests. |
| Pending media holdings | 93 video clearances pending; authorized rights/content reviewers | Keep unapproved material excluded. Verify clearance and associated captions/transcripts/posters for any film actually published. Pending holdings alone need not block a valid text/portrait-only release. |

Detailed evidence and limitations: [MG-06 record](completions/MG-06.md),
[installation checklist](../docs/accessibility-installation-review.md), and
[MG-05 record](completions/MG-05.md). Do not mark installation or continuation
sign-off complete until the applicable evidence is recorded.

Use status values such as Not started, In progress, Blocked, Ready for review, or Complete. Use Complete only after the master plan’s acceptance conditions have been met. Document existing failures separately from regressions and unresolved external checks.

After each stage, save a record using [TASK_COMPLETION.md](templates/TASK_COMPLETION.md), review the diff and evidence, and update this tracker before beginning the next stage. No stage authorizes a push, merge, or production deployment.
