# Deployment

GitHub Pages publishes a **preview of the installed exhibit**, built for the public target. It is a testing ground — somewhere to open the exhibit in a browser and look at it — not a product surface and not an address to give a visitor.

The two real surfaces are the installed exhibit on the wall and the staff portal, and neither is deployed by this workflow. See `docs/CLEAN_APP_PLAN.md`.

## Preview URL

```text
https://hgw3lls.github.io/cihof/
```

The exhibit's Vite base and its release manifest both default to `/cihof/`, which matches.

## What the workflow does

Every push to `main` runs `.github/workflows/pages.yml`. Pull requests run the tests without building or deploying.

The `test` job runs the typechecks, the suite-integrity counts, the `@cihof/content` and `@cihof/pipeline` unit suites, `crosswalk:check`, `media:assert`, the exhibit's unit and browser suites, the companion site's browser suite, and the visitor, staff and portal suites. `build` has `needs: test`, so none of this is optional.

The `build` job then:

1. Checks out and installs with `npm ci`, using Node from `.nvmrc`.
2. Builds the exhibit for the public target:
   `CIHOF_TARGET=public CIHOF_BASE_PATH=/cihof/ npm run build --workspace @cihof/exhibit`
3. Runs `npm run assert:public --workspace @cihof/exhibit` against the built output.
4. Uploads `apps/exhibit/dist`.

`deploy` publishes that artifact to Pages.

## Why the artifact is checked before it ships

All 93 films are approved for the kiosk — rights, captions and transcripts approved, every path present — and approved for the public web on **none** of them. That refusal is deliberate.

So the difference between a publishable artifact and a breach of an editorial decision is one boolean per record, and a misconfigured build produces the wrong one in silence. Two consequences worth holding onto:

- **A kiosk artifact on a public URL is not a leak of unreviewed material.** Everything in it has been reviewed. It overrides a decision somebody made on purpose.
- **"No video in the artifact" proves nothing.** Every film also carries a YouTube id, so a kiosk build serves 93 embedded players without a megabyte of video leaving the repository.

`assert:public` is the only check in this repository that examines the bytes being uploaded rather than the sources they came from. `media:validate`, `media:assert` and `validate:kiosk` all validate inputs, and a misconfigured build passes every one of them. It asserts the bundle declares the public target, that no person carries a film, that every holding the manifest names is held specifically by the public-web decision, that no video file is present, and that no embedded player host appears in the built bytes.

## Variables

| Variable | Set in CI | Notes |
| --- | --- | --- |
| `CIHOF_TARGET` | `public` | Required under CI. Unrecognised values always error; absent defaults to `kiosk` only outside CI. |
| `CIHOF_BASE_PATH` | `/cihof/` | Vite base and release-manifest prefix. |
| `CIHOF_SITE_URL` | **unset, deliberately** | Names the public site the share panel's QR codes point at. A preview is a moving address, and a code printed into a stranger's browser history cannot be corrected. With it unset the panel reports there is nothing to link to. |

Note that the root app uses `CIHOF_BUILD_TARGET` and the exhibit uses `CIHOF_TARGET`. Setting the wrong one does nothing and raises no error.

## Local commands

```sh
npm install
npm run dev --workspace @cihof/exhibit                       # kiosk by default, with a warning
CIHOF_TARGET=public npm run build --workspace @cihof/exhibit
npm run assert:public --workspace @cihof/exhibit
```

Films only exist at the kiosk target, so a Pages preview will never show them. Preview films locally.

If the local shell cannot find Node 22 on this Mac:

```sh
PATH=/usr/local/opt/node@22/bin:$PATH npm run build --workspace @cihof/exhibit
```

## GitHub Pages setting

Confirm once under `Settings -> Pages`:

```text
Build and deployment -> Source -> GitHub Actions
```

## Known wrinkle

The exhibit registers a service worker that precaches from `release.json` at scope `/cihof/`. On a shared `github.io` origin it persists between preview deploys and will serve you a cached earlier release. Hard-reload or unregister when a preview looks stale.
