# Visitor Content First-Pass Report

Generated: 2026-09-12T20:05:06.011Z

## What This Pass Does

This pass promotes CIHOF-owned/source-profile biography material into visitor-facing copy fields for all 111 profiles. It treats the CIHOF profile text as the baseline source of truth for first-pass content management.

It updates:

- approved profile summaries
- documented context lines
- honored-for summaries
- Life + Work overview copy
- first-pass nationality/heritage tags when present in the current CIHOF-derived metadata
- curator notes that keep media rights and archival permissions separate

It does not approve:

- YouTube/video rights
- captions, transcripts, or audio description
- image rights
- WRHS archival display permissions
- final profile approval

## Coverage

- Decision rows: 111
- Rows with first-pass nationality/heritage tags: 109
- Life + Work word counts: min 65, average 104, max 118

## Class Coverage

- 2010: 13
- 2011: 9
- 2012: 8
- 2013: 7
- 2014: 8
- 2015: 7
- 2016: 7
- 2017: 6
- 2018: 6
- 2019: 6
- 2020: 6
- 2022: 4
- 2023: 6
- 2024: 6
- 2025: 6
- 2026: 6

## Output

- Decisions CSV: `/Users/hgw3lls/Desktop/CIHOF/cihof-main/data/curation-decisions/cihof-first-pass-content.csv`
- Apply with: `npm run curate:apply -- --input=/Users/hgw3lls/Desktop/CIHOF/cihof-main/data/curation-decisions/cihof-first-pass-content.csv --no-backup`
- Rebuild with: `npm run build`

## Review Notes

These decisions intentionally clear the first-pass text/content backlog while leaving legal, accessibility, and archival review visible. Profiles should still receive human curator review before being marked fully approved.
