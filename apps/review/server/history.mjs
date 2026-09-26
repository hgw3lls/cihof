import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

/**
 * Who decided what, and when, read from the project's history: every commit
 * that changed the data, with the signed sheet it archived when there is one.
 * Read-only. The history is the record; this only lays it out.
 */

const RECORD = '\x1e';
const FIELD = '\x1f';
const HEADER_END = '\x1d';

export function history(root, limit = 400) {
  let output = '';
  try {
    output = execFileSync('git', [
      'log', `-n${limit}`, '--date=iso-strict',
      `--format=${RECORD}%h${FIELD}%aI${FIELD}%an${FIELD}%s${FIELD}%b${HEADER_END}`,
      '--name-status', '--', 'data',
    ], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return [];
  }
  return output.split(RECORD).filter((record) => record.trim()).map(parseRecord);
}

export function parseRecord(record) {
  const [header, files = ''] = record.split(HEADER_END);
  const [commit, date, author, subject, body = ''] = header.split(FIELD);
  const reviewedBy = /^Reviewed-by:\s*(.+)$/m.exec(body)?.[1]?.trim() ?? null;
  // "review: places, 3 decisions (places-review-2026-10-01)", as save.mjs writes it.
  const text = subject ?? '';
  const review = text.startsWith('review: ')
    ? {
      kind: text.slice(8).split(/,| \(/)[0].trim(),
      count: /, (\d+) decisions?\b/.exec(text)?.[1] ?? null,
      reference: /\(([^)]+)\)\s*$/.exec(text)?.[1] ?? null,
    }
    : null;
  const sheets = files.split('\n')
    .map((line) => line.trim().split('\t'))
    .filter(([status, path]) => status === 'A' && path?.startsWith('data/curation-decisions/') && /\.(csv|md)$/.test(path))
    .map(([, path]) => path);
  return {
    commit,
    date,
    who: reviewedBy ?? author,
    // A decision saved in this app, or a change made by a developer with the tools.
    kind: review ? review.kind : sheets.length > 0 ? 'decision applied by the developer' : 'developer change',
    fromApp: Boolean(review),
    count: review?.count ? Number(review.count) : null,
    reference: review?.reference ?? null,
    subject,
    sheets,
  };
}

/** The rows of an archived sheet, for reading. Only files under data/curation-decisions/. */
export function sheetRows(root, path) {
  const base = join(root, 'data', 'curation-decisions');
  const target = normalize(join(root, String(path ?? '')));
  if (!target.startsWith(base + sep) || !existsSync(target)) return null;
  const text = readFileSync(target, 'utf8');
  if (!target.endsWith('.csv')) return { kind: 'text', text: text.slice(0, 20000) };
  const [header = [], ...rows] = parseCsv(text);
  return { kind: 'table', header, rows: rows.slice(0, 200), total: rows.length };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      value += char;
    }
  }
  if (value || row.length) { row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); }
  return rows;
}
