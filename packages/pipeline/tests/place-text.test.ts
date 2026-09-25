import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { legacyPlaceVersion, placeHistoryLimit, placeHistoryProblem, placeTextVersion, placeWordsState } from '../src/build/place-text.ts';

/**
 * A place approval covers the words a visitor reads about the place, as the
 * attract words and the profiles already do.
 */
const people = buildPeople();
const words = { id: 'place:fixture', name: 'Fixture Gardens', neighborhood: 'Rockefeller Park', shortHistory: 'A history.' };
const publication = { publicWeb: false, kiosk: true };
const approvedAs = (contentVersion: string) => ({ status: 'approved', decisionReference: 'fixture', contentVersion });
const shown = (place: object) => buildRuntimeBundle(people, 'kiosk', { places: [place], placeAssociations: [], crosswalk: null })
  .places.some((entry) => entry.id === 'place:fixture');

test('the version is a fingerprint of the name, the neighbourhood and the history', () => {
  const version = placeTextVersion(words);
  assert.match(version, /^place-[0-9a-f]{12}$/);
  assert.equal(placeTextVersion({ ...words, shortHistory: ' A history. ' }), version, 'surrounding space is not a change');
  for (const change of [{ name: 'Other' }, { neighborhood: 'Downtown' }, { shortHistory: 'Another history.' }]) {
    assert.notEqual(placeTextVersion({ ...words, ...change }), version);
  }
});

test('a place approved in its words is shown', () => {
  const place = { ...words, review: approvedAs(placeTextVersion(words)), publication };
  assert.equal(placeWordsState(place), 'current');
  assert.equal(shown(place), true);
});

test('a place whose words changed after approval is held back', () => {
  const place = { ...words, shortHistory: 'Words nobody approved.', review: approvedAs(placeTextVersion(words)), publication };
  assert.equal(placeWordsState(place), 'changed');
  assert.equal(shown(place), false);
});

test('an approval from before approvals recorded the words is still shown, and marked for another look', () => {
  const place = { ...words, review: approvedAs(legacyPlaceVersion), publication };
  assert.equal(placeWordsState(place), 'legacy');
  assert.equal(shown(place), true);
});

test('a history must be one paragraph that fits the screen', () => {
  assert.equal(placeHistoryProblem('A history.'), null);
  assert.match(placeHistoryProblem('  ') ?? '', /empty/);
  assert.match(placeHistoryProblem('x'.repeat(placeHistoryLimit + 1)) ?? '', /room for/);
  assert.match(placeHistoryProblem('One.\nTwo.') ?? '', /one paragraph/);
});
