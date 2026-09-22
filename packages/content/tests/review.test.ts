import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bandOf, readyToConfirm, reviewProgress, reviewRemaining, reviewRowProblems,
  type CrosswalkEntry, type RelationshipReviewSheet, type ReviewRow,
} from '../src/index.ts';

/**
 * The sheet a curator signs induction relationships off in.
 *
 * What these mostly guard is the sheet's honesty about its own state. A sheet
 * that reported the relationships it *could* yield as though they were counted
 * would tell somebody the lens was nearly open when nothing had been decided.
 */

const candidate = {
  inducteeId: 'alex-machaskee-2010' as never,
  displayName: 'Alex Machaskee',
  basis: 'corpus-induction-record' as const,
};

function row(over: Partial<ReviewRow> = {}): ReviewRow {
  return {
    entryId: 'inducter:alex-machaskee',
    recordedName: 'Alex Machaskee',
    band: 'single-candidate',
    inducted: ['georgine-welo-2023' as never, 'ingrida-bublys-2019' as never],
    candidates: [candidate],
    proposes: [{ id: 'a' as never }, { id: 'b' as never }] as never,
    resolution: { status: 'unresolved' },
    ...over,
  };
}

function sheet(rows: ReviewRow[], signed = false): RelationshipReviewSheet {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-22T00:00:00.000Z',
    source: 'fixture',
    ...(signed
      ? {
        publicationDecision: {
          decisionReference: 'fixture-decision',
          contentVersion: 'fixture-v1',
          publication: { publicWeb: false, kiosk: true },
        },
      }
      : {}),
    rows,
  };
}

const entry = (candidates: number): CrosswalkEntry => ({
  id: 'inducter:x', recordedName: 'X', inducted: [],
  candidates: Array.from({ length: candidates }, () => candidate),
  resolution: { status: 'unresolved' },
});

test('a row is banded by how much judgement it needs, not by confidence', () => {
  assert.equal(bandOf(entry(1)), 'single-candidate');
  assert.equal(bandOf(entry(2)), 'ambiguous');
  assert.equal(bandOf(entry(0)), 'no-candidate');
});

test('proposed relationships are counted apart from resolved ones', () => {
  const progress = reviewProgress(sheet([row(), row({ entryId: 'b', recordedName: 'B' })]));
  assert.equal(progress.relationshipsResolved, 0);
  assert.equal(progress.relationshipsProposed, 4);
});

test('what a curator has not accepted does not count toward the lens', () => {
  // The failure this prevents: a sheet reporting 31 and an exhibit showing none.
  const progress = reviewProgress(sheet([row(), row({ entryId: 'b', recordedName: 'B' })]));
  assert.equal(progress.linksCount, 0);
  assert.equal(progress.linksWouldOpen, false);
});

test('resolving every name publishes nothing without a publication decision', () => {
  const resolved = row({
    resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: 'cur-1' },
  });
  const many = Array.from({ length: 20 }, (_, index) => ({ ...resolved, entryId: `e${index}` }));
  const progress = reviewProgress(sheet(many));
  assert.equal(progress.relationshipsResolved, 40);
  assert.equal(progress.linksCount, 0, 'resolving is not permission');
  assert.equal(progress.linksWouldOpen, false);
});

test('the lens opens once the resolutions and the decision both exist', () => {
  const resolved = (index: number): ReviewRow => row({
    entryId: `e${index}`, recordedName: `Name ${index}`,
    resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: 'cur-1' },
  });
  const progress = reviewProgress(sheet(Array.from({ length: 8 }, (_, i) => resolved(i)), true));
  assert.equal(progress.relationshipsResolved, 16);
  assert.equal(progress.linksCount, 16);
  assert.equal(progress.linksWouldOpen, true);
});

test('the sheet names the missing publication decision even when it has enough relationships', () => {
  const resolved = (index: number): ReviewRow => row({
    entryId: `e${index}`, recordedName: `Name ${index}`,
    resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: 'cur-1' },
  });
  const remaining = reviewRemaining(sheet(Array.from({ length: 8 }, (_, i) => resolved(i))));
  assert.equal(remaining.length, 1);
  assert.match(remaining[0] ?? '', /publicationDecision/);
});

test('a resolution naming someone off the roster is reported', () => {
  const problems = reviewRowProblems(
    row({ resolution: { status: 'inductee', inducteeId: 'nobody-2099' as never, decisionReference: 'cur-1' } }),
    () => false,
  );
  assert.deepEqual(problems, ['resolved to nobody-2099, who is not on the roster']);
});

test('a resolution that yields nothing is reported rather than sitting there looking done', () => {
  const problems = reviewRowProblems(
    row({
      inducted: ['alex-machaskee-2010' as never],
      resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: 'cur-1' },
    }),
    () => true,
  );
  assert.deepEqual(problems, ['resolved to the only person this row records them as inducting, so it yields nothing']);
});

test('an approval with no decision reference is named as such', () => {
  const problems = reviewRowProblems(
    row({ resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: '  ' } }),
    () => true,
  );
  assert.deepEqual(problems, ['resolved without a decision reference']);
});

test('only unresolved single-candidate rows are offered as ready to confirm', () => {
  const rows = [
    row(),
    row({ entryId: 'b', recordedName: 'B', band: 'ambiguous' }),
    row({ entryId: 'c', recordedName: 'C', band: 'no-candidate' }),
    row({
      entryId: 'd', recordedName: 'D',
      resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: 'cur-1' },
    }),
  ];
  assert.deepEqual(readyToConfirm(sheet(rows)).map((value) => value.entryId), ['inducter:alex-machaskee']);
});

test('a sheet counts every band, so it cannot report only the easy work', () => {
  const progress = reviewProgress(sheet([
    row(),
    row({ entryId: 'b', recordedName: 'B', band: 'ambiguous' }),
    row({ entryId: 'c', recordedName: 'C', band: 'no-candidate' }),
    row({ entryId: 'd', recordedName: 'D', band: 'no-candidate' }),
  ]));
  assert.equal(progress.names, 4);
  assert.equal(progress.singleCandidate, 1);
  assert.equal(progress.ambiguous, 1);
  assert.equal(progress.noCandidate, 2);
});
