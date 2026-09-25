# Transcripts: the generator's note to staff removed

**Decision reference:** `transcripts-staff-note-removed-2026-09-25`
**Decided:** 25 September 2026, by the project owner, in the development session
that found it ("Strip the staff note…": "y").

## What was decided

Every one of the 93 film transcripts (`public/media/videos/*/*.transcript.txt`)
opened with four lines written by the tool that drew the transcripts from the
captions:

    Draft transcript generated from public/media/videos/<film>.en.vtt.
    Generated: 2026-09-14T…Z.
    Review required before kiosk approval.
    (a blank line)

The display showed those lines to visitors above every transcript. They are a
note to staff, not anything anyone said, and they were removed from all 93
files. Nothing else in any file changed: 372 lines deleted, none added.

## What it does not change

- The approval of 21 September (`transcriptStatus: approved` on all 93 films)
  still covers every spoken word, which are exactly as approved.
- Nothing a visitor reads about a person changed, so nothing is recorded in
  `data/cihof_reviewed_differences.json`.
- The caption files (`.en.vtt`) never carried the note and are untouched.

The noise in some captions and transcripts (music heard as "Heat", transcriber
tags) is a separate question, listed in `docs/film-transcript-check.md` and not
decided here.

## How it stays decided

`publishFilms` (`packages/pipeline/src/build/assets.ts`) stages transcripts
byte for byte and refuses any that opens with the note, so a transcript
regenerated the same way cannot bring it back to a visitor.
