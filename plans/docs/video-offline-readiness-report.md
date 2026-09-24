# Video Offline Readiness Report

Generated: 2026-09-14

## Current State

- Canonical video folder: `public/media/videos`.
- Old manifest references to `public/videos`: `0`.
- Old local `public/videos` folder: removed after confirming its `280` files were represented under `public/media/videos`.
- Acquisition plan records: `633`.
- Acquisition plan unique YouTube IDs: `140`.
- Acquisition records with expected local files present: `633/633`.
- Downloads still needed by the acquisition plan: `0`.
- Manifest video items: `93` across `64` profiles.
- Manifest video items with a specific YouTube ID: `93/93`.
- Manifest video items with local file paths present: `93/93`.
- Manifest video items with poster files present: `93/93`.
- Manifest video items with caption files present: `93/93`.
- Manifest video items with transcript files present: `93/93`.
- Draft transcripts generated from existing caption sidecars: `59`.
- Local Whisper captions generated for missing-caption videos: `34`.
- Draft transcripts generated from local Whisper captions: `34`.
- Final transcript shape check: `0` malformed caption files and `0` malformed transcript files detected.
- Missing caption records checked against YouTube subtitles: `34/34` specific videos had no English caption track available.
- Channel-only manifest records still needing a specific video ID: `0`.
- Resolved channel-only record: Johnny K. Wu's CIHOF profile links `P34omi5XUiY` as the induction ceremony video and separately mentions `https://www.youtube.com/mdifilm` as his YouTube channel. The channel URL is retained only as a curator note/provenance reference, not playable media.
- Local transcription backend: `whisper.cpp` via `/usr/local/bin/whisper-cli`.
- Local Whisper model: `tools/whisper-models/ggml-small.en.bin` (ignored by Git; required locally to regenerate captions).

`public/media/videos` currently contains `2611` local files:

- `.mp4`: `633` visible paths, representing `168` unique underlying video files by inode.
- `.vtt`: `1148`.
- `.srt`: `34`.
- `.json`: `34`.
- `.webp`: `573`.
- `.jpg`: `60`.
- `.txt`: `127` transcript/review sidecars.
- Kiosk builds package the `372` manifest-listed media files: `93` videos, `93` posters, `93` captions, and `93` transcripts.
- Local acquisition/archive files that are not referenced by `data/media_manifest.json` remain in the working tree but are skipped by production builds.

## Validation

- `npm run media:video-sync`: pass; `0` downloads needed.
- `npm run media:video-captions -- --execute`: pass; created draft transcripts from the `59` existing caption files.
- `npm run media:video-captions -- --download-missing-captions --execute`: pass with content warnings; YouTube had no English caption tracks for the `34` specific missing-caption videos.
- `npm run media:video-transcribe -- --execute`: pass; generated local Whisper caption sidecars for the remaining `34` specific videos.
- `npm run media:video-captions -- --execute`: pass after Whisper; manifest now has `93/93` captions and transcripts.
- `npm run media:video-transcribe -- --id=i5FJexABnHI --overwrite --execute --beam-size=3 --best-of=3 --allow-fallback`: pass; repaired the one malformed greedy Whisper decode.
- `npm run media:video-captions -- --id=i5FJexABnHI --overwrite-transcripts --execute`: pass; regenerated the repaired canonical transcript.
- `npm run media:video-captions`: final dry run pass; `0` remaining caption/transcript gaps and `0` channel/non-video records.
- `npm run prepare:data`: pass.
- `npm run validate:offline`: pass; `0` runtime remote media references.
- `npm run validate:media-clearance`: expected fail; `93` strict video failures.
- `npm run launch:readiness:strict`: expected fail on non-video launch blockers and video review warning.
- `npm run build:public`: pass; latest build completed in seconds with hardlink-aware video packaging.

## Remaining Video Work For Full Offline Readiness

1. Review and approve rights.
   - `0/93` manifest video items have `rightsStatus: approved`.
   - Rights approval should stay manual; the scripts should not infer permission from local downloads.

2. Review captions/transcripts and set statuses.
   - The current transcripts are draft text generated from caption sidecars and remain marked `needs-review`.
   - `captionStatus` must be `approved` for kiosk-ready video.
   - `transcriptStatus` must be `approved` for kiosk-ready video.

3. Enable kiosk playback only after review.
   - Set `approvedForKiosk: true` only for videos that have approved rights, local file, poster, caption, transcript, and approved caption/transcript statuses.
   - Until then, videos should remain hidden from visitor-facing kiosk playback.

4. Keep using hardlink-aware packaging.
   - The source media folder uses hardlinks efficiently.
   - The build pipeline now hardlinks only manifest-listed kiosk videos/sidecars and excludes local videos from portal output.
