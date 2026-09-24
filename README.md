# CIHOF

The Cleveland International Hall of Fame exhibit: an offline touch kiosk built on a reviewed data model. A new staff portal for editing that data comes next (see Roadmap).

## Layout

| Path | What it is |
| --- | --- |
| `data/` | Canonical sources: the actual product. `data/review-sheets/` holds the curator sheets. |
| `public/media/` | Media store (portraits, film captions, posters, transcripts). Video files are local-only and gitignored. |
| `packages/content/` | Domain model and publication rules. No framework, no DOM. |
| `packages/pipeline/` | Reads `data/`, emits the published bundle. |
| `apps/exhibit/` | The kiosk. React and Vite, offline service worker, release manifest, recovery panel. |
| `apps/web/` | Static companion pages for the QR take-home. Kept until the QR decision is made (roadmap). |
| `scripts/` | Data maintenance: apply curator decisions, reports, media validation, film-asset check. |
| `plans/` | Archive of every plan, audit and report. Start at `plans/README.md`. |

## Run

Use Node 22 (`.nvmrc`).

```sh
npm ci
npm run dev            # kiosk, local dev (kiosk target)
npm test               # content, pipeline and exhibit unit tests
npm run test:browser   # exhibit browser suite (Playwright)
npm run typecheck
```

## Build targets

```sh
npm run build:kiosk    # apps/exhibit/dist with all 93 films. Never publish.
npm run build:public   # no films; also runs the artifact assertion
```

All 93 films are approved for the kiosk and for the public web on none of them. That refusal is deliberate. `apps/exhibit` reads `CIHOF_TARGET`, which is required under CI; an unknown value is always an error. GitHub Pages publishes only the public build, and only after `assert:public` has inspected the built bytes. Set `CIHOF_SITE_URL` only for a durable public address, never for a preview.

## Keeping data current

```sh
npm run crosswalk:check && npm run review:links:check && npm run review:places:check
npm run links:apply | places:apply | curate:apply | media:apply
npm run media:validate && npm run curate:report   # reports go to reports/ (ignored)
npm run media:assert                             # every film asset is tracked
```

Change canonical sources, never generated output. Never invent historical claims, relationships, dates or portraits, and never change an approval state without an authorized editorial decision.

## Roadmap

The full plan is in [`plans/docs/CLEAN_APP_PLAN.md`](plans/docs/CLEAN_APP_PLAN.md). Remaining work, in order:

1. **Kiosk admin settings**: passcode-gated idle timeout, warning, motion, touch cue and hotkey. First settle whether runtime settings may only lengthen timings (§5.2).
2. **Review-record write path** in `packages/content`: `decisionReference`, `contentVersion` and evidence per claim (§3).
3. **New staff portal** on that model. Port the old `scripts/portal-runner.js` from `main`, keeping its dry-run, hash-match and clean-tree gates, and include the review queue and diagnostics.
4. **QR take-home decision** (§5.1): host `apps/web` durably, or drop Share.
5. **Standards exports** (Linked Art, CIDOC-CRM, IIIF) were produced by the removed `prepare-data.js`. Confirm nobody external consumes them (§5.3), or rebuild them in the pipeline.

The old visitor app and old portal remain on `main` for reference until the new portal has run through one real editorial cycle.
