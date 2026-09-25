import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRows } from '../../../packages/pipeline/src/build/review.ts';
import { attractCsv, biosCsv, decisionReference, draftCounts, filmStartsCsv, placeTiesCsv, placesCsv, profilesCsv, signedNote, tiesCsv } from '../server/sheets.mjs';

const draft = {
  reviewer: 'Jane Smith',
  ties: {
    't1': { decision: 'relationship', kind: 'mentored', direction: 'b-to-a', label: 'mentored A, "closely"', inverseLabel: 'was mentored by B' },
    't2': { decision: 'context', label: 'Both at the 2017 ceremony', kind: 'mentored' },
    't3': { decision: 'reject', label: 'left over', note: 'Different person' },
  },
  places: { 'place:a': { approve: true, seenVersion: 'place-aaaaaaaaaaaa' }, 'place:b': { approve: false }, 'place:c': { approve: true, seenVersion: 'place-cccccccccccc', history: ' Their own words. ' } },
  placeTies: { 'place:a|person-2020': { role: 'worked' } },
  bios: { 'p-2010': { correctedText: 'Line one,\nline two.' }, 'q-2011': { useSourceText: true } },
  profiles: { 'p-2010': { decision: 'approve', seenVersion: 'profile-abc' }, 'q-2011': { decision: 'changes', seenVersion: 'profile-def', note: 'Wrong year' } },
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
  assert.deepEqual(rows(placesCsv(draft, '2026-10-01')).map((row) => row.placeId), ['place:a', 'place:c']);
});

test('a place approval names the words it saw, and carries the reviewer\'s own words when they wrote some', () => {
  const [kept, reworded] = rows(placesCsv(draft, '2026-10-01'));
  assert.equal(kept.contentVersion, 'place-aaaaaaaaaaaa');
  assert.equal(kept.newHistory, '');
  assert.equal(reworded.contentVersion, 'place-cccccccccccc');
  assert.equal(reworded.newHistory, 'Their own words.');
});

test('what people did at places goes to its own sheet', () => {
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

test('a profile decision carries the version the reviewer saw', () => {
  const [approved, queried] = rows(profilesCsv(draft, '2026-10-01'));
  assert.deepEqual(approved, {
    id: 'p-2010', contentVersion: 'profile-abc', decision: 'approve',
    decisionReference: 'profiles-review-2026-10-01', note: 'Reviewed by Jane Smith in the staff review app.',
  });
  assert.equal(queried.decision, 'changes');
  assert.match(queried.note, /^Wrong year\. Reviewed by Jane Smith/);
});

test('the counts say what will be saved', () => {
  assert.deepEqual(draftCounts(draft), { ties: 3, places: 2, placeTies: 1, bios: 2, profiles: 2, attract: 0, filmStarts: 0 });
});

test('an attract-words decision carries the version seen, or the new words, never both', () => {
  const approve = rows(attractCsv({ reviewer: 'Jane Smith', attract: { attract: { decision: 'approve', seenVersion: 'text-abc', note: '' } } }, '2026-10-01'))[0];
  assert.deepEqual(approve, {
    block: 'attract', decision: 'approve', contentVersion: 'text-abc', headline: '', tagline: '',
    decisionReference: 'attract-words-review-2026-10-01', note: 'Reviewed by Jane Smith in the staff review app.',
  });
  const reword = rows(attractCsv({ reviewer: 'Jane Smith', attract: { attract: { decision: 'reword', headline: 'Home, "here"', tagline: 'A line.', seenVersion: 'text-abc' } } }, '2026-10-01'))[0];
  assert.equal(reword.contentVersion, '');
  assert.equal(reword.headline, 'Home, "here"');
  assert.equal(reword.tagline, 'A line.');
});

test('a ceremony film start names the person, the film and the second, or the beginning', () => {
  const starts = { reviewer: 'Jane Smith', filmStarts: {
    'dona-brady-2024|P34omi5XUiY': { decision: 'start', seconds: 2404 },
    'johnny-k-wu-2024|P34omi5XUiY': { decision: 'beginning' },
  } };
  const [start, beginning] = rows(filmStartsCsv(starts, '2026-10-01'));
  assert.deepEqual(start, {
    personId: 'dona-brady-2024', filmId: 'P34omi5XUiY', decision: 'start', startSeconds: '2404',
    decisionReference: 'film-starts-review-2026-10-01', note: 'Reviewed by Jane Smith in the staff review app.',
  });
  assert.equal(beginning.decision, 'beginning');
  assert.equal(beginning.startSeconds, '');
});
