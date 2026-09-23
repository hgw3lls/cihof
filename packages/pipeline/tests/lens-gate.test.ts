import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';

const people = buildPeople();
const approved = { status: 'approved', decisionReference: 'fixture-decision', contentVersion: 'fixture-v1' } as const;
const everywhere = { publicWeb: true, kiosk: true };

const relationship = (index: number) => ({
  claim: 'documented',
  id: `fixture-rel-${index}`,
  from: 'alex-machaskee-2010',
  to: 'august-pust-2010',
  kind: 'collaborated-with',
  label: 'worked with August Pust on the Cultural Gardens federation',
  review: approved,
  publication: everywhere,
  evidence: [{ id: `fixture-ev-${index}`, title: 'Fixture collection record', kind: 'collection-record' }],
});

test('the collection as it stands offers Connections on the wall and not the web', () => {
  // Signed 2026-09-22 under cur-2026-062, kiosk only. Before that this read
  // People and Years; the lens turned itself on when the content arrived,
  // which is the whole point of deciding availability here.
  const kiosk = buildRuntimeBundle(people, 'kiosk');
  assert.deepEqual(kiosk.lenses, ['people', 'years', 'links']);
  assert.equal(kiosk.relationships.length, 42);

  const onWall = kiosk.lensReport.find((lens) => lens.id === 'links')!;
  assert.equal(onWall.available, true);
  assert.equal(onWall.count, 42);

  const web = buildRuntimeBundle(people, 'public');
  assert.deepEqual(web.lenses, ['people', 'years']);
  assert.equal(web.relationships.length, 0, 'the approval named the kiosk and only the kiosk');

  // Places has had no such decision, so it stays shut in both.
  assert.equal(kiosk.places.length, 0);
  assert.equal(kiosk.lensReport.find((lens) => lens.id === 'places')!.available, false);
});

test('Connections turns itself on when reviewed relationships reach the threshold', () => {
  // `crosswalk: null` because this is about the threshold, not the collection.
  // Without it the committed crosswalk's own 31 relationships are added and 14
  // is no longer 14.
  const justShort = buildRuntimeBundle(people, 'kiosk', {
    crosswalk: null,
    relationships: Array.from({ length: 14 }, (_, index) => relationship(index)),
  });
  assert.equal(justShort.lenses.includes('links'), false, '14 is below the threshold of 15');

  const enough = buildRuntimeBundle(people, 'kiosk', {
    crosswalk: null,
    relationships: Array.from({ length: 15 }, (_, index) => relationship(index)),
  });
  assert.equal(enough.lenses.includes('links'), true, 'the lens appears without a code change');
  assert.equal(enough.relationships.length, 15);
});

test('unreviewed relationships do not count towards the threshold', () => {
  const unreviewed = Array.from({ length: 40 }, (_, index) => ({
    ...relationship(index),
    review: { status: 'needs-review' as const },
  }));
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: null, relationships: unreviewed });
  assert.equal(bundle.lenses.includes('links'), false, 'volume is not review');
  assert.equal(bundle.relationships.length, 0);
});

test('a kiosk approval does not open the lens on the public target', () => {
  const kioskOnly = Array.from({ length: 20 }, (_, index) => ({
    ...relationship(index),
    publication: { publicWeb: false, kiosk: true },
  }));
  // Isolated from the committed crosswalk too. Its relationships are kiosk-only
  // today, so this would pass either way — and would quietly stop testing its
  // own subject the day a public-web decision is signed.
  const only = { crosswalk: null, relationships: kioskOnly };
  assert.equal(buildRuntimeBundle(people, 'kiosk', only).lenses.includes('links'), true);
  assert.equal(buildRuntimeBundle(people, 'public', only).lenses.includes('links'), false);
});
