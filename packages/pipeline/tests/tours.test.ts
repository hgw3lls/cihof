import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishedTours, tourPeople } from '../src/build/tours.ts';

const person = (id: string, sortName: string, biography: string, contributions: string[] = []) => ({ id, sortName, biography, contributions });
const people = [
  person('a', 'Adams', 'She resettled refugees and taught citizenship; citizenship classes for refugees. Refugees remember her.'),
  person('b', 'Brown', 'A painter.', ['Newcomer Support']),
  person('c', 'Cole', 'An engineer who once met a refugee.'),
  person('d', 'Dunn', 'Taught citizenship to refugees, and resettled families; refugees, refugees, refugees, refugees.'),
];
const lens = { id: 'helped-arrive', label: 'Newcomer Support', prompt: 'Welcome', description: 'Welcome work.', terms: ['refugee', 'citizenship', 'resettled'], themes: ['newcomer support'], reviewStatus: 'approved' };

test('a tour visits the people its terms and themes find, strongest first, and not the passing mention', () => {
  // Brown by an honour (8), Dunn (7) and Adams (6) by their stories; Cole's one mention is not enough.
  assert.deepEqual(tourPeople(people, lens), ['b', 'd', 'a']);
});

test('pinned people lead, excluded people never appear, and the length is capped', () => {
  assert.deepEqual(tourPeople(people, { ...lens, pinnedPersonIds: ['c'], excludedPersonIds: ['d'] }), ['c', 'b', 'a']);
  assert.deepEqual(tourPeople(people, { ...lens, maxPortraits: 1 }), ['b']);
});

test('only an approved tour reaches a display; a preview shows drafts, marked', () => {
  const stored = { lenses: [lens, { ...lens, id: 'draft', reviewStatus: 'draft' }, { ...lens, id: 'off', enabled: false }] };
  assert.deepEqual(publishedTours(people, { stored }).map((tour) => tour.id), ['helped-arrive']);
  const preview = publishedTours(people, { stored, preview: true });
  assert.deepEqual(preview.map((tour) => [tour.id, tour.unreviewed ?? false]), [['helped-arrive', false], ['draft', true]]);
});

test('a tour that finds nobody is not published', () => {
  assert.deepEqual(publishedTours(people, { stored: { lenses: [{ ...lens, terms: ['astronaut'], themes: [] }] } }), []);
});

test('the release today publishes no tour, since none is approved', () => {
  assert.deepEqual(publishedTours(people), []);
});
