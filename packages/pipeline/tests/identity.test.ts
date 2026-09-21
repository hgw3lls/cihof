import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inducteeId, slugify } from '../src/identity.ts';
import { dataFile } from '../src/paths.ts';
import { readRosterNames } from '../src/sources/manifest.ts';

const rosterKeys = Object.keys(
  JSON.parse(readFileSync(dataFile('cihof_curated_metadata.json'), 'utf8')).inductees,
);

test('slugify folds accents and collapses punctuation', () => {
  assert.equal(slugify('Alex Machaskee'), 'alex-machaskee');
  assert.equal(slugify('Jure Žmauc'), 'jure-zmauc');
  assert.equal(slugify('  O’Brien--Smith  '), 'o-brien-smith');
  assert.equal(slugify('Lê Nguyên'), 'le-nguyen');
});

test('a trailing year in the roster name is preserved, not tidied away', () => {
  // These four ids are already published with a doubled year.
  assert.equal(inducteeId('Arnie de la Porte – 2016', 2016), 'arnie-de-la-porte-2016-2016');
  assert.equal(inducteeId('Carolyn Balogh – 2016', '2016'), 'carolyn-balogh-2016-2016');
  assert.equal(inducteeId('Alex Machaskee', 2010), 'alex-machaskee-2010');
});

test('every published id is reproduced from the roster, exactly', () => {
  const derived = readRosterNames().map(({ name, classYear }) => inducteeId(name, classYear));
  assert.deepEqual(
    derived.slice().sort(),
    rosterKeys.slice().sort(),
    'the rewritten derivation must reproduce all 111 published ids',
  );
});
