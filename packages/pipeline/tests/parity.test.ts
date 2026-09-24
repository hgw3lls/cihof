import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishedPerson } from '@cihof/content';
import { readCuratedRoster } from '../src/sources/curated.ts';
import { buildPeople } from '../src/build/people.ts';
import {
  collectDifferences, differenceSubject, readPublishedRecord, readReviewedDifferences, reconcile, recordDecision,
} from '../src/build/parity.ts';

/**
 * Parity against the artifact the old pipeline published.
 *
 * A from-scratch generator can silently drop a curatorial decision, and nothing
 * about the output would look wrong. This compares every visible field with
 * the last record the old pipeline published, frozen in
 * `packages/pipeline/reference/`. Every difference must be recorded, with the
 * decision that made it, in `data/cihof_reviewed_differences.json`.
 *
 * The apply tools record the differences their own sheet makes. When this test
 * fails, the finding is the difference: find the decision that made it and
 * record it with `npm run parity:record`, or fix what dropped it. Re-snapshotting
 * the frozen record to make it pass discards exactly the evidence it exists to
 * produce.
 */
const published = readPublishedRecord();
const people = buildPeople();
const ledger = readReviewedDifferences();
const differences = collectDifferences(people);

test('the published people are still built, by canonical id', () => {
  const removed = differences.filter((difference) => difference.includes(': removed,'));
  const recorded = new Set(ledger.differences.map((entry) => entry.difference));
  assert.deepEqual(removed.filter((difference) => !recorded.has(difference)), [], 'people lost by the rebuild');
  assert.equal(published.length, 111, 'the frozen record is frozen');
});

test('every difference from the published record is recorded with a decision', () => {
  const { unrecorded } = reconcile(differences, ledger);
  assert.deepEqual(unrecorded.slice(0, 12), [],
    `${unrecorded.length} unrecorded differences. Record the decision that made them with npm run parity:record, or fix what dropped them.`);
});

test('every recorded difference is still a real difference', () => {
  // An entry that stops matching has been fixed, reverted, or superseded, and
  // leaving it would quietly excuse a later regression that read the same way.
  const { stale } = reconcile(differences, ledger);
  assert.deepEqual(stale.map((entry) => entry.difference), [],
    'no longer differs: remove it with npm run parity:record, which drops stale entries for the people it names');
});

test('every recorded difference names its decision', () => {
  for (const entry of ledger.differences) {
    assert.ok(entry.decisionReference.trim().length > 0, `no decisionReference: ${entry.difference}`);
  }
});

test('a new person is recorded as added, not compared field by field', () => {
  const [first, ...rest] = people as [PublishedPerson, ...PublishedPerson[]];
  const invented = { ...first, id: 'somebody-new-2027' } as PublishedPerson;
  const found = collectDifferences([...rest, first, invented]);
  assert.ok(found.includes('somebody-new-2027: added, not in the published record'));
  assert.equal(found.filter((difference) => differenceSubject(difference) === 'somebody-new-2027').length, 1);
});

test('a decision records only the people it touched, and drops their stale entries', () => {
  const outcome = recordDecision(
    { schemaVersion: 1, note: '', differences: [{ difference: 'a-2020.name: published "A" -> rebuilt "B"', decisionReference: 'old' }] },
    ['a-2020.name: published "A" -> rebuilt "C"', 'b-2021.sortName: published "x" -> rebuilt "y"'],
    { ids: new Set(['a-2020']), decisionReference: 'names-2026-10-01', recordedAt: '2026-10-01T00:00:00Z' },
  );
  assert.deepEqual(outcome.added, ['a-2020.name: published "A" -> rebuilt "C"']);
  assert.deepEqual(outcome.removed, ['a-2020.name: published "A" -> rebuilt "B"']);
  assert.deepEqual(outcome.elsewhere, ['b-2021.sortName: published "x" -> rebuilt "y"']);
  assert.deepEqual(outcome.ledger.differences.map((entry) => entry.decisionReference), ['names-2026-10-01']);
});

test('a second edit to long text past the cut is its own difference', () => {
  const person = people[0]!;
  const long = 'x'.repeat(200);
  const edit = (tail: string) => collectDifferences(
    [{ ...person, biography: { ...person.biography!, text: `${long}${tail}` } }],
    published.filter((record) => record['id'] === person.id),
  ).find((difference) => difference.includes('.bioText:'));
  assert.notEqual(edit('first'), edit('second'));
});

test('biography provenance follows the curated override', () => {
  // A curator's biography replaces the institution's and says so. The frozen
  // record stores both as plain strings, so nothing in it tells them apart.
  const curated = readCuratedRoster();
  for (const person of people) {
    const expected = curated.get(person.id)?.bioTextOverride ? 'curated' : 'source';
    assert.equal(person.biography?.provenance, expected, person.id);
  }
});
