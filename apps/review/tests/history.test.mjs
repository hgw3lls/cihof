import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { history, parseRecord, sheetRows } from '../server/history.mjs';

const root = resolve(import.meta.dirname, '../../..');
const record = (subject, body, files) => `abc1234\x1f2026-10-01T10:00:00+00:00\x1fJane Laptop\x1f${subject}\x1f${body}\x1d\n${files}\n`;

test('a review saved in the app names its kind, count, reference and reviewer', () => {
  const entry = parseRecord(record(
    'review: what people did at places, 3 decisions (place-roles-review-2026-10-01)',
    'Decided in the staff review app by Jane Smith.\n\nReviewed-by: Jane Smith\n',
    'A\tdata/curation-decisions/place-decisions-2026-10-01.csv\nM\tdata/cihof_place_associations.json',
  ));
  assert.deepEqual(
    [entry.kind, entry.count, entry.reference, entry.who, entry.fromApp, entry.sheets],
    ['what people did at places', 3, 'place-roles-review-2026-10-01', 'Jane Smith', true, ['data/curation-decisions/place-decisions-2026-10-01.csv']],
  );
});

test('a decision a developer applied is told apart from the developer\'s other changes', () => {
  const applied = parseRecord(record('Apply the rights sheet', '', 'A\tdata/curation-decisions/media-decisions-x.csv'));
  const other = parseRecord(record('Regenerate the sheets', '', 'M\tdata/review-sheets/places-review-sheet.csv'));
  assert.equal(applied.kind, 'decision applied by the developer');
  assert.equal(applied.who, 'Jane Laptop', 'with no Reviewed-by, the author');
  assert.equal(other.kind, 'developer change');
});

test('the history of this project reads, each entry with a date, a person and a kind', () => {
  const entries = history(root, 50);
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(!Number.isNaN(Date.parse(entry.date)) && entry.who && entry.kind, entry.commit);
  }
});

test('only archived sheets can be read, and nothing outside them', () => {
  assert.equal(sheetRows(root, 'data/cihof_places.json'), null);
  assert.equal(sheetRows(root, 'data/curation-decisions/../cihof_places.json'), null);
  assert.equal(sheetRows(root, '../../etc/passwd'), null);
  const readme = sheetRows(root, 'data/curation-decisions/README.md');
  assert.equal(readme?.kind, 'text');
});
