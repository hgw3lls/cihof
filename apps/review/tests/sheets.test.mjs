import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRows } from '../../../packages/pipeline/src/build/review.ts';
import { biosCsv, decisionReference, draftCounts, placeTiesCsv, placesCsv, signedNote, tiesCsv } from '../server/sheets.mjs';

const draft = {
  reviewer: 'Jane Smith',
  ties: {
    't1': { decision: 'relationship', kind: 'mentored', direction: 'b-to-a', label: 'mentored A, "closely"', inverseLabel: 'was mentored by B' },
    't2': { decision: 'context', label: 'Both at the 2017 ceremony', kind: 'mentored' },
    't3': { decision: 'reject', label: 'left over', note: 'Different person' },
  },
  places: { 'place:a': { approve: true }, 'place:b': { approve: false } },
  placeTies: { 'place:a|person-2020': { role: 'worked' } },
  bios: { 'p-2010': { correctedText: 'Line one,\nline two.' }, 'q-2011': { useSourceText: true } },
};

const rows = (csv) => {
  const [header, ...body] = parseRows(csv);
  return body.map((cells) => Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ''])));
};

test('each review has a reference in the house convention', () => {
  assert.equal(decisionReference('ties', '2026-10-01'), 'connections-review-2026-10-01');
  assert.equal(decisionReference('bios', '2026-10-01'), 'biographies-review-2026-10-01');
  assert.throws(() => decisionReference('ties', 'today'));
});

test('every decision names the reviewer', () => {
  assert.equal(signedNote('', 'Jane Smith'), 'Reviewed by Jane Smith in the staff review app.');
  assert.equal(signedNote('Checked the programme.', 'Jane Smith'), 'Checked the programme. Reviewed by Jane Smith in the staff review app.');
});

test('the ties sheet carries only what each decision needs', () => {
  const [relationship, context, rejection] = rows(tiesCsv(draft, '2026-10-01'));
  assert.deepEqual(relationship, {
    tieId: 't1', decision: 'relationship', kind: 'mentored', direction: 'b-to-a',
    label: 'mentored A, "closely"', inverseLabel: 'was mentored by B',
    decisionReference: 'connections-review-2026-10-01', note: 'Reviewed by Jane Smith in the staff review app.',
  });
  assert.equal(context.kind, '', 'a context is not a kind of relationship');
  assert.equal(context.direction, '');
  assert.equal(rejection.label, '', 'a rejection publishes no wording');
  assert.match(rejection.note, /^Different person\. Reviewed by Jane Smith/);
});

test('only approvals reach the places sheet; "not yet" stays a draft', () => {
  assert.deepEqual(rows(placesCsv(draft, '2026-10-01')).map((row) => row.placeId), ['place:a']);
  assert.deepEqual(rows(placeTiesCsv(draft, '2026-10-01'))[0], {
    placeId: 'place:a', person: 'person-2020', role: 'worked',
    decisionReference: 'place-roles-review-2026-10-01', note: 'Reviewed by Jane Smith in the staff review app.',
  });
});

test('a corrected biography survives commas and line breaks', () => {
  const [corrected, restored] = rows(biosCsv(draft, '2026-10-01'));
  assert.equal(corrected.correctedText, 'Line one,\nline two.');
  assert.equal(corrected.useSourceText, '');
  assert.equal(restored.useSourceText, 'yes');
  assert.equal(restored.correctedText, '');
});

test('the counts say what will be saved', () => {
  assert.deepEqual(draftCounts(draft), { ties: 3, places: 1, placeTies: 1, bios: 2 });
});
