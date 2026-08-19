# CIHOF Staff Portal Runner

The Staff Portal can run project scripts when a local runner is active on the admin machine.

This is intentionally **local only**. The deployed GitHub Pages site cannot execute scripts by itself.

## Start The Portal

In one terminal:

```sh
npm run dev -- --host 127.0.0.1
```

In a second terminal:

```sh
npm run portal:server
```

Open:

```text
http://127.0.0.1:5173/?view=review&review=1
```

## What The Runner Can Do

The runner exposes only whitelisted project commands:

- `prepare:data`
- `curate:report`
- `media:validate`
- `validate:entities`
- `validate:kiosk`
- `audit:data`
- `build`
- `build:kiosk`
- `curate:metadata`
- `media:manifest`
- `media:localize`
- `import:2026`

The portal can also send its local draft CSV directly to the runner for:

- curation decision dry run
- media decision dry run
- real curation/media apply
- report regeneration after a real apply

The portal can write curator-edited JSON directly to the repo for:

- Story Lens prompt configuration in `data/cihof_story_lenses.json`
- Approved relationship records in `data/cihof_relationships.json`

Relationship decisions marked hidden or needs research remain local/exportable review drafts. Only approved relationship drafts are saved into the visitor-facing relationship metadata.

## Safety Model

- The runner binds to `127.0.0.1` by default.
- Browser requests are accepted only from `localhost` or `127.0.0.1`.
- The runner does not accept arbitrary shell commands.
- Real portal applies require confirmation in the browser.
- Real apply writes backups through the existing apply scripts.
- Story Lens and relationship saves validate the payload before writing source and runtime JSON.
- The runner keeps recent job output in memory only.

## Environment Overrides

```sh
CIHOF_PORTAL_PORT=5184 npm run portal:server
CIHOF_PORTAL_HOST=127.0.0.1 npm run portal:server
```

If the port is changed, update `portalRunnerBaseUrl` in `src/features/review-dashboard/ReviewDashboardView.tsx`.
