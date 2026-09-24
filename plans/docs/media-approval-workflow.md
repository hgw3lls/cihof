# Film approval workflow

The canonical archive contains 93 local film records, but the visitor chronology is driven by people and exposes a film only after every required review is complete. No film is approved by the interface redesign.

1. Open `docs/media-approval-sheet.csv`. Each row is one film; `video_index` is 1-based. Use the source URL to match your approval documents to the film.
2. Enter `true` only where you have a documented approval for `video_rights_approved`, `captions_approved`, and `transcript_approved`. Set `video_kiosk_approved` to `true` only when onsite installation use is authorized. Set `video_public_web_approved` to `true` only when public web distribution is separately authorized. A blank scope remains unresolved and is never treated as approval. Record reviewer/date/evidence in `media_notes`.
3. Run `npm run media:apply -- --input=docs/media-approval-sheet.csv --dry-run`. Resolve every error before applying.
4. Run `npm run media:apply -- --input=docs/media-approval-sheet.csv`, then build the intended target. `npm run build:public` copies only assets explicitly approved for public web distribution. `npm run build:kiosk` packages only assets approved for onsite kiosk use. Both targets remove pending film records and local acquisition details from their visitor runtime manifests; canonical review data remains in `data/media_manifest.json` and the staff portal. `npm run validate:media-clearance` becomes clean only when every listed film has completed the existing kiosk-readiness review.

The blank sheet can be regenerated from the current manifest with `npm run media:approval-sheet -- --output=docs/media-approval-sheet.csv`; regeneration replaces edits, so do this only before entering decisions.
