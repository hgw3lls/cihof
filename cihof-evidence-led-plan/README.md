# CIHOF: an evidence-led upgrade plan

**Written:** 2026-09-21
**Repository:** `hgw3lls/cihof`, branch `sota`, HEAD `d97afd32b967a5b6e62ad6075b133979e8468b0a`
**Method:** direct reading of the application source, the built public artifact, and the published dataset, plus executed checks

This is a third plan, written after auditing the code and the data rather than
the deployment. It does not replace the completed MG work, and it keeps the
parts of the City Experience package that hold up. It disagrees with that
package about **what to build first**, and the disagreement is evidence-based.

## The short version

The exhibit already publishes a substantial per-person record: 111 people, all
with a rights-approved portrait, a full biography, three derived summaries, an
inductor, and four story highlights. What it publishes **zero** of is exactly
what the City Experience plan proposes to build six new surfaces for —
relationships, stories, places, archive leads, film.

That is not because the material does not exist. It is because nothing has been
routed through the review contracts CE-01 correctly built. `inductedBy` is
populated for 111 of 111 people and `relationships.json` is `[]`.

So the binding constraint is a **review and migration pipeline**, not more
interpretive surfaces. A Places lens, a comparison panel and a trails system
built today would render empty for every visitor, and their emptiness would be
honest.

Meanwhile the thing that is already deployed to the public has four integrity
defects that no stage owns, and its regression suite spent an unknown period
reporting nothing while collecting zero tests.

## How this plan differs

| | City Experience | This plan |
|---|---|---|
| First work | New interpretive surfaces (CE-03–CE-08) | Restore the safety net, then runtime integrity |
| Offline / release | Last (CE-10, CE-11) | Third, because the site is already live |
| Generated text | Not addressed | Labelled and corrected before anything is built on it |
| Interpretive surfaces | Six stages, fixed order | Gated on approved-content thresholds, cheapest-first |
| Content review | A parallel track that does not gate code | The critical path |

## Read in this order

1. [AUDIT.md](AUDIT.md) — what ships, what the code does, what the data holds. Every claim carries its evidence.
2. [PLAN.md](PLAN.md) — the thesis, the sequencing argument, and the architecture position.
3. [DECISIONS.md](DECISIONS.md) — decisions, including which City Experience decisions are adopted and which are not.
4. [ACCEPTANCE.md](ACCEPTANCE.md) — what must be true, and what is deliberately inherited from the CE matrix rather than restated.
5. [TRACKER.md](TRACKER.md), then one stage at a time from `stages/`.

## What this plan inherits rather than rewrites

These hold up and are cited, not duplicated:

- `cihof-city-experience/DATA_CONTRACTS.md` — the typed content contracts. CE-01 implemented them and the implementation verifies.
- `cihof-city-experience/ACCEPTANCE_TESTS.md` — the T/P/A/O matrix, including the source-audit addendum.
- `cihof-city-experience/EDITORIAL_HANDOFF.md` — the editorial interface.
- `cihof-city-experience/AGENTS_ADDENDUM.md` — the execution rules. They are good rules and this plan does not relax them.
- The MG tracker and its open sign-off items. Nothing here closes them.

## What this plan does not do

It does not authorize a deployment, a content approval, a rights decision, or a
physical installation sign-off. It does not propose a server, accounts, a graph
database, or a framework change. It does not invent historical content, and it
does not treat a legacy field as a reviewed claim.
