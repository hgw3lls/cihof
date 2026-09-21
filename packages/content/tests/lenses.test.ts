import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableLenses, lensAvailability, publishedPlaces, publishedRelationships, type LensCounts } from '../src/index.ts';

const approved = { status: 'approved', decisionReference: 'd-1', contentVersion: 'v1' } as const;
const everywhere = { publicWeb: true, kiosk: true };

test('a lens below its threshold is not offered', () => {
  // The collection as it actually stands: no documented relationships, no
  // reviewed places.
  const today: LensCounts = { people: 111, years: 111, links: 0, places: 0 };
  assert.deepEqual(availableLenses(today), ['people', 'years']);

  const detail = lensAvailability(today);
  const links = detail.find((lens) => lens.id === 'links')!;
  assert.equal(links.available, false);
  assert.equal(links.count, 0);
  assert.equal(links.minimum, 15);
  assert.equal(links.counts, 'documented relationships');
});

test('a lens appears on its own once the content clears the threshold', () => {
  assert.deepEqual(availableLenses({ people: 111, years: 111, links: 14, places: 7 }), ['people', 'years']);
  assert.deepEqual(availableLenses({ people: 111, years: 111, links: 15, places: 8 }), ['people', 'years', 'links', 'places']);
});

test('an empty collection offers nothing rather than an empty shelf', () => {
  assert.deepEqual(availableLenses({ people: 0, years: 0, links: 0, places: 0 }), []);
});

test('an unreviewed place seed is not a place', () => {
  const seed = { id: 'place:hall', name: 'Civic Hall', shortHistory: '', neighborhood: '', personIds: [] };
  assert.equal(publishedPlaces([seed], 'public').length, 0, 'no review record at all');
  assert.equal(publishedPlaces([{ ...seed, review: { status: 'needs-review' }, publication: everywhere }], 'public').length, 0);
  assert.equal(publishedPlaces([{ ...seed, review: approved, publication: everywhere }], 'public').length, 1);
  assert.equal(
    publishedPlaces([{ ...seed, review: approved, publication: { publicWeb: false, kiosk: true } }], 'public').length,
    0,
    'kiosk approval is not public approval',
  );
});

test('a relationship without a source is not published, however it is reviewed', () => {
  const base = { id: 'r1', fromPersonId: 'a', toPersonId: 'b', kind: 'inducted_by', label: 'Inducted by', review: approved, publication: everywhere };
  assert.equal(publishedRelationships([{ ...base, sourceNote: 'CIHOF induction record, 2010.' }], 'kiosk').length, 1);
  assert.equal(publishedRelationships([{ ...base, sourceNote: '   ' }], 'kiosk').length, 0);
  assert.equal(publishedRelationships([base], 'kiosk').length, 0, 'no source note at all');
});
