# Film approval workflow

The visitor timeline lists 93 local film records, but playback is withheld until each film's rights, caption, and transcript reviews are entered. No film is approved by the interface redesign.

1. Open `docs/media-approval-sheet.csv`. Each row is one film; `video_index` is 1-based. Use the source URL to match your approval documents to the film.
2. Enter `true` only where you have a documented approval for `video_rights_approved`, `captions_approved`, and `transcript_approved`. Set `video_kiosk_approved` to `true` only after all three are approved. Record reviewer/date/evidence in `media_notes`.
3. Run `npm run media:apply -- --input=docs/media-approval-sheet.csv --dry-run`. Resolve every error before applying.
4. Run `npm run media:apply -- --input=docs/media-approval-sheet.csv`, then `npm run build:public`. The public build copies only approved films, posters, captions, and transcripts. `npm run validate:media-clearance` becomes clean only when every listed film has been reviewed and approved; partial approvals can still be published without exposing pending films. The full offline kiosk build remains separate.

The blank sheet can be regenerated from the current manifest with `npm run media:approval-sheet -- --output=docs/media-approval-sheet.csv`; regeneration replaces edits, so do this only before entering decisions.
