# YouTube Media Acquisition Plan

This project has many YouTube references from the CIHOF site and source harvest. They are useful acquisition leads, but they are not automatically visitor-ready.

## Guardrail

Do not download or publish YouTube media for kiosk/offline use until CIHOF has confirmed rights or permission for local archival use. Downloaded video also still needs captions, transcripts, poster/thumbnail review, and media-manifest approval before `approvedForKiosk` can become true.

## Generate The Inventory

```bash
npm run media:youtube-plan
```

This writes:

- `data/media-acquisition/youtube-download-plan.json`
- `data/media-acquisition/youtube-download-commands.sh`

The JSON plan combines:

- `data/media_manifest.json`
- `data/original-site-harvest/pre-curation/cihof-pre-curation-packet.json`

The command file comments out records that still need rights review.

## Rights Allowlist

Create a rights allowlist after CIHOF confirms which videos may be locally archived:

```json
[
  "PpXIVZKq49U",
  "bishop-anthony-pilla-2015:KMVo49Zi-94"
]
```

Then regenerate:

```bash
npm run media:youtube-plan -- --rights-allowlist=data/media-acquisition/youtube-rights-allowlist.json
```

## Download Confirmed Media

Only after rights are confirmed:

```bash
node scripts/plan-youtube-media-acquisition.js \
  --rights-allowlist=data/media-acquisition/youtube-rights-allowlist.json \
  --execute \
  --rights-confirmed
```

The script uses `yt-dlp` and writes files under `public/media/videos/<person-id>/`.

## After Download

Run media validation and update the media manifest only after files, captions, transcripts, and rights notes are present:

```bash
npm run media:validate
npm run build
```

Do not set `approvedForKiosk` until the media has passed rights and accessibility review.
