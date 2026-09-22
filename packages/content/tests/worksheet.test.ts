import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entryProblems, worksheetContributions, worksheetProgress,
  type ContributionWorksheet, type WorksheetEntry,
} from '../src/index.ts';

const approved = { status: 'approved', decisionReference: 'cur-2026-050', contentVersion: 'v6' } as const;
const everywhere = { publicWeb: true, kiosk: true };
const evidence = [{ id: 'ev-3', title: 'Nationalities Services Center annual report, 1972', kind: 'secondary-source' as const }];
const subject = 'august-pust-2010' as never;

const specific = {
  id: 'con-1' as never, subject,
  action: { text: "Founded the city's One World Day programme", provenance: 'curated' as const, origin: 'cur-2026-050' },
  occurred: { precision: 'year' as const, start: '1972' },
  outcomes: [{ kind: 'event' as const, name: 'One World Day' }],
  review: approved, publication: everywhere, evidence,
};

const honorific = {
  ...specific,
  id: 'con-2' as never,
  action: { text: 'A distinguished community leader', provenance: 'curated' as const, origin: 'cur-2026-050' },
  outcomes: [],
};

function sheet(entries: WorksheetEntry[]): ContributionWorksheet {
  return { schemaVersion: 1, generatedAt: '2026-09-21T00:00:00.000Z', source: 'fixture', entries };
}

function entry(over: Partial<WorksheetEntry> = {}): WorksheetEntry {
  return {
    subject, displayName: 'August Pust', classYear: 2010,
    sourceBiography: 'Born in Slovenia…', currentSummary: 'Contributions to arts and culture.',
    status: 'not-started', contributions: [], ...over,
  };
}

test('the collection as it stands has nothing written', () => {
  const progress = worksheetProgress(sheet([entry(), entry({ subject: 'irene-morrow-2010' as never })]));
  assert.equal(progress.people, 2);
  assert.equal(progress.notStarted, 2);
  assert.equal(progress.written, 0);
  assert.equal(progress.specific, 0);
});

test('a row marked ready with nothing in it is caught', () => {
  // Otherwise it sits in the sheet looking finished.
  assert.deepEqual(
    entryProblems(entry({ status: 'ready-for-review' })),
    ['marked ready with no contribution written'],
  );
});

test('a row marked ready with an honorific is caught', () => {
  // "A distinguished community leader" is what the record already says for all
  // 111 people. Accepting it as a contribution would change nothing.
  const problems = entryProblems(entry({ status: 'ready-for-review', contributions: [honorific] }));
  assert.deepEqual(problems, ['contribution 1 names nothing a visitor could follow']);
});

test('a row that actually names something passes', () => {
  assert.deepEqual(entryProblems(entry({ status: 'ready-for-review', contributions: [specific] })), []);
});

test('a contribution filed against the wrong person is caught', () => {
  const problems = entryProblems(entry({
    status: 'ready-for-review',
    contributions: [{ ...specific, subject: 'irene-morrow-2010' as never }],
  }));
  assert.ok(problems.includes('contribution 1 names a different person'));
});

test('an unfinished row is not nagged about', () => {
  // Only a row offered for review is held to the standard; work in progress is
  // allowed to be incomplete, which is what in-progress means.
  assert.deepEqual(entryProblems(entry({ status: 'in-progress', contributions: [honorific] })), []);
  assert.deepEqual(entryProblems(entry({ status: 'not-started' })), []);
});

test('"nothing documented" is a real answer, not an unfinished row', () => {
  const progress = worksheetProgress(sheet([entry({ status: 'nothing-documented' })]));
  assert.equal(progress.nothingDocumented, 1);
  assert.equal(progress.notStarted, 0, 'it has been looked at, and that counts');
  assert.deepEqual(entryProblems(entry({ status: 'nothing-documented' })), []);
});

test('progress separates what is written from what is usable', () => {
  const progress = worksheetProgress(sheet([
    entry({ status: 'ready-for-review', contributions: [specific, honorific] }),
  ]));
  assert.equal(progress.written, 2);
  assert.equal(progress.specific, 1, 'only one of the two names anything');
  assert.equal(progress.readyButIncomplete, 1, 'so the row is not actually ready');
});

test('the sheet hands the build every contribution, whatever its row says', () => {
  // Filtering by review and target is the build's job and happens once, there.
  const all = worksheetContributions(sheet([
    entry({ status: 'ready-for-review', contributions: [specific] }),
    entry({ subject: 'irene-morrow-2010' as never, status: 'in-progress', contributions: [honorific] }),
  ]));
  assert.deepEqual(all.map((contribution) => contribution.id), ['con-1', 'con-2']);
});
