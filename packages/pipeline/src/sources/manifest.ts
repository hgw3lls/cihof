import { readFileSync } from 'node:fs';

/**
 * The kiosk manifest is the roster of record: 111 rows, one per inductee.
 *
 * It is a canonical source, not a generated artifact, and is never rewritten by
 * this pipeline.
 */
export type RosterRow = {
  readonly name: string;
  readonly classYear: string;
  readonly region: string;
  readonly profileUrl: string;
  readonly inductedBy: string;
  readonly primaryImageUrl: string;
  readonly imageUrls: readonly string[];
  readonly localImagePaths: readonly string[];
  readonly bioText: string;
};

const manifestUrl = new URL('../../../../data/cihof_kiosk_manifest.csv', import.meta.url);

export function readRoster(): RosterRow[] {
  return parseCsv(readFileSync(manifestUrl, 'utf8')).map((row) => ({
    // The first column carries a UTF-8 BOM in the source file.
    name: (row['name'] ?? row['﻿name'] ?? '').trim(),
    classYear: (row['class_year'] ?? '').trim(),
    region: (row['region'] ?? '').trim(),
    profileUrl: (row['profile_url'] ?? '').trim(),
    inductedBy: (row['inducted_by'] ?? '').trim(),
    primaryImageUrl: (row['primary_image_url'] ?? '').trim(),
    imageUrls: splitList(row['image_urls']),
    localImagePaths: splitList(row['local_image_paths']),
    bioText: row['bio_text'] ?? '',
  }));
}

export function readRosterNames(): Array<{ name: string; classYear: string }> {
  return readRoster().map(({ name, classYear }) => ({ name, classYear }));
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(/[|,]/).map((item) => item.trim()).filter(Boolean);
}

/** Minimal RFC 4180 reader: quoted fields, escaped quotes, embedded newlines. */
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; } else { quoted = false; }
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (char === '\r') continue;
    field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const header = rows.shift() ?? [];
  return rows
    .filter((cells) => cells.some((cell) => cell.trim().length > 0))
    .map((cells) => Object.fromEntries(header.map((key, position) => [key, cells[position] ?? ''])));
}
