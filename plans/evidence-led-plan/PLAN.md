# The plan

**Basis:** [AUDIT.md](AUDIT.md). Every claim here traces to a measured finding there.

## 1. Objective

Unchanged from the City Experience plan, and worth restating because this plan
does not disagree with the destination:

> A visitor should be able to begin without knowing an inductee's name. A
> recognizable neighborhood, community, institution, contribution, or period
> should lead to a person, an explained action, evidence, and an intelligible
> connection to another story.

What changes is the route.

## 2. The thesis

**Interpretive surfaces are not the constraint. Reviewed content is.**

The exhibit publishes 0 relationships, 0 stories, 0 places and 0 archive leads
while `inductedBy` is populated for 111 of 111 people and 444 story-highlight
sentences sit in the record. CE-01 built the destination contracts correctly and
they correctly refuse everything unreviewed. Nothing built the road.

Six new surfaces — Places, contribution stories, evidence panels, comparison,
historical activity, trails — would therefore ship empty. Their emptiness would
be honest, which is the project's standard, and useless, which is not the point
of an exhibit.

So this plan:

1. Makes the safety net real, because two live regressions hid behind a suite
   that collected zero tests.
2. Fixes the integrity of the thing that is **already deployed to the public**,
   because it is deployed now and the defects are in the boundary this project
   exists to defend.
3. Labels and corrects generated text, because building interpretation on top of
   an unlabelled template is how a museum publishes a claim it did not make.
4. Builds the review pipeline, because it is the critical path to every
   remaining surface.
5. Builds surfaces in order of **content readiness per unit of effort**, gated on
   thresholds, not in a fixed feature order.

## 3. Sequencing, and why

| Stage | Why here |
|---|---|
| **EV-00** Adopt and baseline | Cheap. Establishes the boundary and this plan's relationship to MG and CE. |
| **EV-01** Make the suite trustworthy | First, because every later claim depends on it. A suite that collects zero tests is indistinguishable from a passing one. |
| **EV-02** Runtime content integrity | Second, because the site is live and the publication boundary currently holds only until someone writes a localStorage key. |
| **EV-03** Offline and release integrity | Third, not last. The kiosk is meant to run without a network and currently cannot open an unvisited deep link offline. A release that cannot roll back is not a release. |
| **EV-04** Honest text | Before interpretation, not after. 88/111 records carry a visible copy defect and three visitor-facing fields are unlabelled templates. |
| **EV-05** The review pipeline | The critical path. Everything after this is gated on its throughput. |
| **EV-06** Relationships | First interpretive surface, because EV-05 hands it a bounded, sourced queue and the Links scene already exists and currently says "0 DOCUMENTED RELATIONSHIPS". |
| **EV-07** Galleries | Cheapest real content win: 65 people, rights already approved, images already shipped, no surface. |
| **EV-08** Places, stories, comparison, time | Deferred behind explicit content thresholds. Each is built when, and only when, enough reviewed records exist to make it worth a visitor's attention. |
| **EV-09** Release gates and handoff | Last, and it inherits MG-08's open sign-offs rather than closing them. |

The reversal against CE is stages 2, 3 and 4. CE puts offline and release at the
end (CE-10, CE-11) after six feature stages. That ordering suits a product that
is not yet live. This one is live, on GitHub Pages, today.

## 4. Content thresholds for EV-08

A surface is built when its content clears a threshold, and not before. The
numbers are proposals for the content team to set, not engineering decisions:

| Surface | Proposed threshold |
|---|---|
| Places | ≥ 8 of the 14 place seeds reviewed, with role and evidence per association |
| Contribution stories | ≥ 20 people with at least one approved, sourced beat |
| Comparison | ≥ 40 people with two or more comparable reviewed facts |
| Historical activity | ≥ 30 people with an approved activity date range distinct from induction |

Below the threshold, the lens is not shipped and the plan says so. Above it, the
stage runs. This is the mechanism that keeps engineering honest about emptiness
instead of shipping a lens and calling its empty state a feature.

## 5. Architecture position

Unchanged from CE, and this plan explicitly endorses it: keep React, TypeScript,
Vite, the current runtime loaders, canonical data preparation, the public /
kiosk / portal split and the separate staff portal. The visitor root stays
`src/features/archive-exhibit/ArchiveExhibit.tsx`. No server, no accounts, no
graph database, no WebGL engine, no router. It is a static artifact and it must
stay one.

Two additions this plan does make:

- **A runtime content-integrity module.** Publication is currently enforced only
  at build time. The same pure selectors must gate anything that reaches the
  bundle loader at runtime, including a staff import.
- **A review pipeline in the existing portal.** Not a new application. The
  portal already has a review dashboard; the migration queues belong there.

## 6. Where the City Experience package is still the source of truth

- `DATA_CONTRACTS.md` — the typed contracts. Implemented and verified.
- `ACCEPTANCE_TESTS.md` and its source-audit addendum — the T/P/A/O matrix.
- `EDITORIAL_HANDOFF.md` — the editorial interface.
- `AGENTS_ADDENDUM.md` — the execution rules, unrelaxed.
- CE-01's implementation, which this plan builds on rather than revisits.

## 7. What would falsify this plan

Stated so it can be argued with:

- If the content team says the review queues in EV-05 cannot be worked in a
  useful timeframe, then EV-06 through EV-08 have no input and the plan should
  stop after EV-04 and ship a portrait-and-biography release.
- If a curator decides `honoredForSummary` and `documentedContextLine` are
  acceptable as-is, EV-04 shrinks to the 88 broken lines and the labelling work
  falls away.
- If the installation is not going to run without a network, EV-03 drops to
  release integrity only and the offline work is deferred.

Each of those is a decision for someone other than an engineer, and each is
recorded as an open question in [DECISIONS.md](DECISIONS.md) rather than assumed.
