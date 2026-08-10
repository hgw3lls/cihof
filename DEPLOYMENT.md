# Deployment

This repository deploys the CIHOF Explorer through GitHub Actions and GitHub Pages.

## Production URL

The Vite production base path is `/cihof/`, so the GitHub Pages URL is expected to be:

```text
https://hgw3lls.github.io/cihof/
```

## Automatic deploys

Every push to `main` runs `.github/workflows/pages.yml`.

The workflow:

1. Checks out the repository.
2. Uses Node from `.nvmrc`.
3. Installs dependencies with `npm ci`.
4. Builds the static site with `npm run build`.
5. Runs the data audit with `npm run audit:data`.
6. Uploads `dist/` to GitHub Pages.

## Local commands

```sh
npm install
npm run dev
npm run build
```

If the local shell cannot find Node 22 on this Mac, use:

```sh
PATH=/usr/local/opt/node@22/bin:$PATH npm run build
```

## GitHub Pages setting

In GitHub, confirm this once under `Settings -> Pages`:

```text
Build and deployment -> Source -> GitHub Actions
```
