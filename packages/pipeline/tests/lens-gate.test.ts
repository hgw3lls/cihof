import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';

const people = buildPeople();
const approved = { status: 'approved', decisionReference: 'fixture-decision', contentVersion: 'fixture-v1' } as const;
const everywhere = { publicWeb: true, kiosk: true };

const relationship = (index: number) => ({
  id: `fixture-rel-${index}`,
  fromPersonId: 'alex-machaskee-2010',
  toPersonId: 'august-pust-2010',
  kind: 'inducted_by',
  label: 'Inducted by',
  sourceNote: 'Fixture induction record.',
  review: approved,
  publication: everywhere,
});

test('the collection as it stands offers People and Years only', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk');
  assert.deepEqual(bundle.lenses, ['people', 'years']);
  assert.equal(bundle.relationships.length, 0);
  assert.equal(bundle.places.length, 0);

  const links = bundle.lensReport.find((lens) => lens.id === 'links')!;
  assert.equal(links.available, false);
  assert.equal(links.count, 0, 'there are no documented relationships to show');
});

test('Connections turns itself on when reviewed relationships reach the threshold', () => {
  const justShort = buildRuntimeBundle(people, 'kiosk', {
    relationships: Array.from({ length: 14 }, (_, index) => relationship(index)),
  });
  assert.equal(justShort.lenses.includes('links'), false, '14 is below the threshold of 15');

  const enough = buildRuntimeBundle(people, 'kiosk', {
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
  const bundle = buildRuntimeBundle(people, 'kiosk', { relationships: unreviewed });
  assert.equal(bundle.lenses.includes('links'), false, 'volume is not review');
  assert.equal(bundle.relationships.length, 0);
});

test('a kiosk approval does not open the lens on the public target', () => {
  const kioskOnly = Array.from({ length: 20 }, (_, index) => ({
    ...relationship(index),
    publication: { publicWeb: false, kiosk: true },
  }));
  assert.equal(buildRuntimeBundle(people, 'kiosk', { relationships: kioskOnly }).lenses.includes('links'), true);
  assert.equal(buildRuntimeBundle(people, 'public', { relationships: kioskOnly }).lenses.includes('links'), false);
});
