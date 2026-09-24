# CIHOF repository guidance

## Surfaces

- The kiosk is `apps/exhibit` (`@cihof/exhibit`). It is the only visitor surface.
- A new staff portal is planned and does not exist yet. The old one is in git history at `c8f749c`, the last commit before the clean-up (`portal.html`, `src/features/review-dashboard/`, `scripts/portal-runner.js`), for reference only.
- `apps/web` is the static QR companion, kept pending the QR decision in `plans/docs/CLEAN_APP_PLAN.md` §5.1.
- `plans/` is an archive. Paths inside it describe the old layout. Do not implement from it without checking the current code.

## Content and data

- Canonical sources live under `data/`; curator sheets under `data/review-sheets/`; media under `public/media/`. The pipeline (`packages/pipeline`) reads them directly.
- `data/external-research/` is collected, unreviewed material from outside sources. Nothing reads it into the exhibit; a curator promotes facts from it into authored sources.
- Change canonical sources or generator logic, never generated output.
- Never invent historical claims, relationships, dates, identity fields, portraits, or quotations. Do not change rights, caption, transcript, relationship, or publication approval states without an authorized editorial decision.
- Keep generated entity relationships, explicit curated relationships, and shared induction-class context distinct. Two people inducted the same year share a context, not a relationship.
- Keep `publicWeb` and `kiosk` publication flags separate.

## Build boundaries

- Use Node 22 as pinned by `.nvmrc`.
- `apps/exhibit` reads `CIHOF_TARGET` (`public` or `kiosk`). It is required under CI; an unrecognised value is always an error; absent locally it defaults to `kiosk` and says so.
- `npm run build:kiosk` carries all 93 films. Never publish it. The same goes for `npm run package:kiosk`, which writes that build with its server to `release/` (git-ignored) for a display.
- `npm run build:public` carries no films and runs `assert:public`, which inspects the built artifact. A failure means do not publish; it never means loosen the check.
- `CIHOF_PREVIEW=all` (`dev:preview`, `build:preview`) shows unreviewed places and proposed ties, marked, for an editor. It changes no review state, is refused under CI and for the public target, and must never be published. Showing something in preview is not approving it.
- Set `CIHOF_SITE_URL` only for a durable public address, never for a preview.
- Do not push, publish, deploy, change permissions, or mark content approved without an explicit instruction for that operation.

## Verified workflow

```sh
npm ci
npm run typecheck
npm test
npm run crosswalk:check && npm run review:links:check && npm run review:places:check && npm run review:ties:check
npm run media:assert
npm run test:browser
npm run test:web
npm run build:public
```

Browser checks do not certify the physical installation. Keep reach, mounting, assistive-technology, endurance, curatorial, and rights checks explicit until authorized people perform them.
