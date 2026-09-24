import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';

const people = buildPeople();
const approved = { status: 'approved', decisionReference: 'fixture-decision', contentVersion: 'fixture-v1' } as const;
const everywhere = { publicWeb: true, kiosk: true };
// The tests below state their own relationships, so they leave out the
// collection's real tie decisions and places, which reviewers keep adding to.
const alone = { tieDecisions: [], places: [], placeAssociations: [] } as const;

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

test('the collection as it stands: each lens follows its content, and each audience its decision', () => {
  // The induction links were signed 2026-09-22 under cur-2026-062 for the
  // kiosk only. Ties and places decided since carry their own audiences. How
  // many there are moves with review and is not pinned here; the rules are.
  const kiosk = buildRuntimeBundle(people, 'kiosk');
  assert.ok(kiosk.lenses.includes('links'));
  assert.ok(kiosk.relationships.length > 0);
  const onWall = kiosk.lensReport.find((lens) => lens.id === 'links')!;
  assert.equal(onWall.available, true);
  assert.equal(onWall.count, kiosk.relationships.length);

  const web = buildRuntimeBundle(people, 'public');
  assert.equal(web.relationships.filter((link) => String(link.id).startsWith('induction:')).length, 0,
    'the induction decision named the kiosk and only the kiosk');
  assert.ok(web.relationships.every((link) => link.publication.publicWeb), 'nothing reaches the web without a web decision');

  // A lens is offered exactly when its report says it is available.
  for (const bundle of [kiosk, web]) {
    for (const lens of bundle.lensReport) assert.equal(bundle.lenses.includes(lens.id), lens.available, `${bundle.target} ${lens.id}`);
  }
});

test('Connections turns itself on when reviewed relationships reach the threshold', () => {
  // `crosswalk: null` because this is about the threshold, not the collection.
  // Without it the committed crosswalk's own 31 relationships are added and 14
  // is no longer 14.
  const justShort = buildRuntimeBundle(people, 'kiosk', {
    crosswalk: null,
    ...alone,
    relationships: Array.from({ length: 14 }, (_, index) => relationship(index)),
  });
  assert.equal(justShort.lenses.includes('links'), false, '14 is below the threshold of 15');

  const enough = buildRuntimeBundle(people, 'kiosk', {
    crosswalk: null,
    ...alone,
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
  const bundle = buildRuntimeBundle(people, 'kiosk', { ...alone, crosswalk: null, relationships: unreviewed });
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
  const only = { ...alone, crosswalk: null, relationships: kioskOnly };
  assert.equal(buildRuntimeBundle(people, 'kiosk', only).lenses.includes('links'), true);
  assert.equal(buildRuntimeBundle(people, 'public', only).lenses.includes('links'), false);
});
