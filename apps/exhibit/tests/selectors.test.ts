import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matching, optionsFor, yearsIn } from '../src/state/selectors.ts';
import { emptyDiscovery } from '../src/state/exhibit.ts';
import type { RuntimePerson } from '../src/data/runtime.ts';

const person = (id: string, name: string, classYear: number | null, communities: string[], contributions: string[]): RuntimePerson => ({
  id, name, sortName: name, classYear, portrait: null, biography: '', biographyCurated: false,
  contributions, communities, countries: [], sourceUrl: null,
});

const people = [
  person('alpha', 'Alex Machaskee', 2010, ['Serbian'], ['Press']),
  person('beta', 'Jure Žmauc', 2011, ['Slovenian'], ['Press', 'Service']),
  person('gamma', 'Lê Nguyên', null, ['Vietnamese'], ['Service']),
];

test('a query folds accents so a visitor can type plainly', () => {
  assert.deepEqual(matching(people, { ...emptyDiscovery, query: 'zmauc' }).map((p) => p.id), ['beta']);
  assert.deepEqual(matching(people, { ...emptyDiscovery, query: 'le nguyen' }).map((p) => p.id), ['gamma']);
  assert.deepEqual(matching(people, { ...emptyDiscovery, query: 'MACHASKEE' }).map((p) => p.id), ['alpha']);
});

test('facets union within a dimension and intersect across them', () => {
  assert.deepEqual(matching(people, { ...emptyDiscovery, contributions: ['Press'] }).map((p) => p.id), ['alpha', 'beta']);
  assert.deepEqual(
    matching(people, { ...emptyDiscovery, contributions: ['Press'], communities: ['Slovenian'] }).map((p) => p.id),
    ['beta'],
  );
});

test('a person with no induction year is not swept up by a year filter', () => {
  assert.deepEqual(matching(people, { ...emptyDiscovery, years: [2010] }).map((p) => p.id), ['alpha']);
  assert.deepEqual(matching(people, { ...emptyDiscovery, years: [2011, 2010] }).map((p) => p.id), ['alpha', 'beta']);
  assert.equal(matching(people, { ...emptyDiscovery, years: [] }).length, 3, 'no year filter keeps everyone');
});

test('facet options and years come from the collection itself', () => {
  assert.deepEqual(optionsFor(people, 'communities'), ['Serbian', 'Slovenian', 'Vietnamese']);
  assert.deepEqual(optionsFor(people, 'contributions'), ['Press', 'Service']);
  assert.deepEqual(yearsIn(people), [2011, 2010], 'newest first, undated people omitted');
});

test('an empty discovery returns the whole collection', () => {
  assert.equal(matching(people, emptyDiscovery).length, 3);
});
