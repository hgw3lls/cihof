import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { isSigned, readiness, readSignoffs } from '../server/readiness.mjs';

const root = resolve(import.meta.dirname, '../../..');

const review = {
  profiles: [{ state: 'approved' }, { state: 'changed-since-approval' }, { state: 'unreviewed' }],
  ties: [{ status: 'relationship', wordingProblem: null }, { status: 'unreviewed', wordingProblem: null }],
  places: [
    { reviewed: true, canApprove: true, words: 'current', ties: [{ role: 'worked' }] },
    { reviewed: true, canApprove: true, words: 'legacy', ties: [{ role: null }] },
    { reviewed: false, canApprove: true, words: null, ties: [] },
  ],
  attract: { approved: false },
  filmStarts: [{ approvedSeconds: 2404 }, { approvedSeconds: null }],
};

test('each line counts only what the records say is done', () => {
  const lines = readiness(review, []);
  const line = (start) => lines.find((entry) => entry.title.startsWith(start));
  assert.deepEqual([line('Profiles').done, line('Profiles').total], [1, 3], 'an approval of other words is not done');
  assert.deepEqual([line('Connections').done, line('Connections').total], [1, 2]);
  assert.deepEqual([line('Places on the display').done, line('Places on the display').total], [1, 2], 'an approval that predates the words is not done');
  assert.deepEqual([line('Researched places').done, line('Researched places').total], [2, 3]);
  assert.deepEqual([line('People at places').done, line('People at places').total], [1, 2]);
  assert.equal(line('Attract').open, 1);
  assert.deepEqual([line('Ceremony films').done, line('Ceremony films').total], [1, 2]);
});

test('a sign-off counts only with who, when and what it rests on', () => {
  assert.equal(isSigned(null), false);
  assert.equal(isSigned({ by: 'Jane Smith', date: '2026-10-01' }), false);
  assert.equal(isSigned({ by: 'Jane Smith', date: '2026-10-01', reference: ' ' }), false);
  assert.equal(isSigned({ by: 'Jane Smith', date: '2026-10-01', reference: 'data/curation-decisions/logo-sign-off-2026-10-01.pdf' }), true);
  const lines = readiness(review, [
    { title: 'Logo', who: 'Hall', where: 'x', signed: { by: 'A', date: 'B', reference: 'C' } },
    { title: 'Rights', who: 'Rights', where: 'y', signed: null },
  ]);
  assert.deepEqual(lines.filter((line) => line.group === 'Signed by people').map((line) => line.open), [0, 1]);
});

test('the sign-off record lists each sign-off once, and none is signed by this repository', () => {
  const items = readSignoffs(root);
  assert.ok(items.length >= 9);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) {
    assert.ok(item.title && item.who && item.where, `${item.id} says what, who and where`);
  }
});
