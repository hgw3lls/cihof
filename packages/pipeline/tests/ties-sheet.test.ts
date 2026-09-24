import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildProposedTiesSheet, decisionsInSheet, proposedTieReviewerColumns, proposedTiesSheetCsv } from '../src/build/review.ts';
import { readCorpusConnections, type CorpusConnection } from '../src/sources/corpus.ts';

/**
 * The proposed-ties sheet.
 *
 * It must hold exactly the ties the preview draws, keep every passage the
 * corpus recorded, and leave every decision to the reviewer.
 */

const people = buildPeople();

const row = (over: Partial<CorpusConnection> = {}): CorpusConnection => ({
  id: 'person-rel:a', from: 'alex-machaskee-2010', to: 'august-pust-2010', sourceType: 'documented_mention',
  evidence: 'First passage.', sourceUrl: 'https://example.org/a', verificationLayer: 'documented-in-profile', ...over,
});

test('the same tie recorded from both ends is one row carrying both passages', () => {
  const rows = buildProposedTiesSheet([
    row(),
    row({ id: 'person-rel:b', from: 'august-pust-2010', to: 'alex-machaskee-2010', evidence: 'Second passage.' }),
  ], people);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]!.evidence, ['First passage.', 'Second passage.']);
  assert.deepEqual(rows[0]!.corpusIds, ['person-rel:a', 'person-rel:b']);
  assert.equal(rows[0]!.tieId, 'preview:person-rel:a');
});

test('a kind is suggested only where the corpus names a relationship outright', () => {
  const rows = buildProposedTiesSheet([
    row({ id: 'm', sourceType: 'documented_mention' }),
    row({ id: 's', to: 'dick-russ-2015', sourceType: 'family_spouse' }),
  ], people);
  assert.equal(rows[0]!.sourceType, 'family_spouse', 'rows with a suggestion come first');
  assert.equal(rows[0]!.suggestedKind, 'family-of');
  assert.equal(rows[1]!.suggestedKind, '');
});

test('a tie to somebody outside the collection is not a row', () => {
  assert.equal(buildProposedTiesSheet([row({ to: 'nobody-here' })], people).length, 0);
});

test('the sheet is generated with every decision column empty', () => {
  const csv = proposedTiesSheetCsv(buildProposedTiesSheet(readCorpusConnections(), people));
  assert.deepEqual(decisionsInSheet(csv, ['decision', 'kind', 'label', 'decisionReference'], 'tieId'), []);
  assert.equal(csv.trim().split('\n').length - 1, 29);
});

test('a half-done row with only a note or an inverse label still counts as review work', () => {
  const csv = proposedTiesSheetCsv(buildProposedTiesSheet(readCorpusConnections(), people));
  const lines = csv.split('\n');
  const header = lines[0]!.split(',');
  for (const column of ['inverseLabel', 'note']) {
    const cells = lines[1]!.split(',');
    // The generated reviewer columns are the last six and always empty, so
    // this row has no commas inside quotes to trip over at those positions.
    cells[cells.length - header.length + header.indexOf(column)] = 'half done';
    const edited = [lines[0], cells.join(','), ...lines.slice(2)].join('\n');
    assert.equal(decisionsInSheet(edited, proposedTieReviewerColumns, 'tieId').length, 1, `${column} alone counts`);
  }
});
