# Decisions

Numbered `E01…`. Where a City Experience decision is adopted unchanged it is
cited, not restated.

## E01 — Adopt the CE architecture position unchanged

CE D01, D02 and D03 stand: evolve the active `ArchiveExhibit`, one shell with
People / Places / Connections / Time, one typed state owner. React, TypeScript,
Vite, the runtime loaders and the separate staff portal stay. No server, no
accounts, no graph database, no router. This remains a static artifact.

## E02 — Adopt CE D05, D07 and D08; they are load-bearing

D05 (preserve base eligibility, gate enrichment), D07 (no inferred historical
expansion) and D08 (detail state may layer) are correct and this plan does not
soften them. D07 in particular governs EV-05 and EV-06: a name match is a review
queue, never a relationship.

## E03 — Sequence by content readiness, not by feature

This is where the plan diverges. Interpretive surfaces are built when reviewed
content clears a stated threshold. Below it, the lens is not shipped and the
tracker says why. An empty lens is not a deliverable, even when its emptiness is
honest.

**Why:** the exhibit publishes 0 relationships, 0 stories, 0 places and 0
archive leads today. Six surfaces built now would render empty for every
visitor.

## E04 — The live site outranks new features

The artifact is deployed to the public. Integrity defects in it are fixed before
anything is added. This moves offline and release work from last (CE-10, CE-11)
to third (EV-03).

## E05 — A browser storage key is not an authentication boundary

The staff import feature is kept. Its result no longer outranks the reviewed
artifact without passing the same publication selectors, it is visible while
active, and it is reversible without the passcode form. Nothing in any record
describes `sessionStorage` or `localStorage` as authentication.

## E06 — Generated text is labelled as generated

`honoredForSummary`, `documentedContextLine` and `storyHighlights` are pipeline
output, not authored source. A visitor must be able to tell them from the
biography. This is P06 applied to text the project generated itself.

**Open:** whether the correct outcome is labelling, rewriting, or withdrawal is
a curatorial decision. EV-04 prepares all three and applies the one chosen.

## E07 — The suite asserts that it ran

A run that collects zero tests fails loudly. Recorded as a decision rather than
a task because it constrains how every later stage reports evidence: no stage
may cite a suite result without a collected count.

## E08 — Thresholds are set by the content team, not by engineering

The numbers in [PLAN.md](PLAN.md#4-content-thresholds-for-ev-08) are proposals.
Engineering implements the gate; the content team sets the number; the tracker
records who set it and when.

## E09 — Legacy rollback code needs a scenario or a retirement date

~7,000 lines are retained as rollback surface with no documented scenario in
which they are what gets restored. EV-09 either states that scenario or retires
them. Until then they stay, because removing them is not this plan's business.

---

## Open questions, for people other than engineers

| # | Question | Who decides | Blocks |
|---|---|---|---|
| Q1 | Are `honoredForSummary` and `documentedContextLine` acceptable as visitor-facing text, or do they need rewriting or withdrawal? | Curators | EV-04 scope |
| Q2 | What are the content thresholds for Places, stories, comparison and time? | Content team | EV-08 |
| Q3 | Must the installation run without a network, and for how long? | Installation team | EV-03 scope |
| Q4 | Does an active staff import survive Start Over on an unattended terminal? | Content and installation leads together | EV-02 |
| Q5 | Can the 37 records whose `storyHighlights` differ from `bioText` be traced to a decision? | Curators | EV-04, EV-05 |
| Q6 | Is a portrait-and-biography release acceptable as v1 if the review queues move slowly? | Institution | Whether EV-06 onward run at all |

No stage may answer one of these by implementing it.
