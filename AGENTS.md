# CIHOF repository guidance

## Surfaces

- The kiosk is `apps/exhibit` (`@cihof/exhibit`). It is the only visitor surface.
- `apps/review` (`@cihof/review`, `npm run review`) is the staff review app. It runs on one staff computer, answers only 127.0.0.1, fills in the same sheets a curator would and applies them with the same apply tools, then makes one local commit per kind of review with the reviewer's name. It never pushes, never decides anything the reviewer did not choose, and must never be exposed beyond that computer. The old portal is in git history at `c8f749c`, for reference only.
- `apps/web` is the static QR companion, kept pending the QR decision in `plans/docs/CLEAN_APP_PLAN.md` §5.1.
- `plans/` is an archive. Paths inside it describe the old layout. Do not implement from it without checking the current code.

## Content and data

- Canonical sources live under `data/`; curator sheets under `data/review-sheets/`; media under `public/media/`. The pipeline (`packages/pipeline`) reads them directly.
- `data/external-research/` is collected, unreviewed material from outside sources. Nothing reads it into the exhibit; a curator promotes facts from it into authored sources.
- Change canonical sources or generator logic, never generated output.
- Never invent historical claims, relationships, dates, identity fields, portraits, or quotations. Do not change rights, caption, transcript, relationship, or publication approval states without an authorized editorial decision.
- Keep generated entity relationships, explicit curated relationships, and shared induction-class context distinct. Two people inducted the same year share a context, not a relationship.
- Keep `publicWeb` and `kiosk` publication flags separate.
- A profile approval (`profileReview` on the curated record) covers the profile's content version: everything a visitor sees, portrait file included. It records that the museum stands behind the profile; it never decides whether a person is shown. Only `profiles:apply` writes it.
- `packages/pipeline/reference/published-runtime-data.json` is the frozen record the exhibit first published. Never re-snapshot it. Every visible difference from it is recorded in `data/cihof_reviewed_differences.json` with the decision that made it; the apply tools do this for the people their sheet changed. Never record a difference no decision made: that is a regression to fix.

## Build boundaries

- Use Node 22 as pinned by `.nvmrc`.
- `apps/exhibit` reads `CIHOF_TARGET` (`public` or `kiosk`). It is required under CI; an unrecognised value is always an error; absent locally it defaults to `kiosk` and says so.
- `npm run build:kiosk` carries all 93 films. Never publish it. The same goes for `npm run package:kiosk`, which writes that build with its server to `release/` (git-ignored) for a display, and for `npm run package:kiosk-app`, the desktop app built from it (`apps/kiosk-app`, outside the workspaces).
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
npm run test:review
npm run build:public
```

Browser checks do not certify the physical installation. Keep reach, mounting, assistive-technology, endurance, curatorial, and rights checks explicit until authorized people perform them.
