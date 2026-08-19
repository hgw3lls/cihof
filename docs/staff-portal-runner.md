# CIHOF Staff Portal Runner

The Staff Portal can run project scripts when a local runner is active on the admin machine.

This is intentionally **local only**. The deployed GitHub Pages site cannot execute scripts by itself.

## Start The Portal

In one terminal:

```sh
npm run dev:portal -- --host 127.0.0.1
```

In a second terminal:

```sh
npm run portal:server
```

The runner prints a one-time token when it starts. Paste that token into the Staff Portal's Runner token field and choose **Reconnect**.

Open:

```text
http://127.0.0.1:5173/portal.html
```

The public visitor entry is `index.html`. The staff portal entry is `portal.html`.

For static builds:

```sh
npm run build:public
npm run build:portal
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
- Runner API requests require a portal token by default, including local requests.
- If `CIHOF_PORTAL_TOKEN` is not set, the runner generates a new one-time token at startup and prints it in the terminal.
- The runner does not accept arbitrary shell commands.
- Real portal applies require confirmation in the browser.
- Real apply writes backups through the existing apply scripts.
- Story Lens and relationship saves validate the payload before writing source and runtime JSON.
- The runner stores recent job output under `.portal/jobs/`.
- The portal token is not forwarded to child `npm` scripts and is redacted from stored output if it appears.

## Persistent Logs

Runner job logs are local, ignored by git, and kept in:

```text
.portal/jobs/
```

Each log is a JSON file containing the job label, status, steps, output, timestamps, and the portal-visible log path. The runner keeps the newest 80 job logs by default.

## Status Panel

The Staff Portal runner panel shows:

- repo root
- current branch
- latest commit
- upstream sync state
- dirty working tree state
- recent uncommitted changes
- last successful validation job
- last successful build job

The validation/build status is based on persisted runner job logs, so it survives runner restarts as long as `.portal/jobs/` is preserved.

## Environment Overrides

```sh
CIHOF_PORTAL_PORT=5184 npm run portal:server
CIHOF_PORTAL_HOST=127.0.0.1 npm run portal:server
CIHOF_PORTAL_TOKEN="use-a-long-random-token" npm run portal:server
CIHOF_PORTAL_REQUIRE_TOKEN=0 npm run portal:server
CIHOF_PORTAL_MAX_JOB_LOGS=120 npm run portal:server
```

Use `CIHOF_PORTAL_REQUIRE_TOKEN=0` only for temporary local troubleshooting.

If the port is changed, update `portalRunnerBaseUrl` in `src/features/review-dashboard/ReviewDashboardView.tsx`.
