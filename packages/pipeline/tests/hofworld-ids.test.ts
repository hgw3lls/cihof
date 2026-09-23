import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIdIndex, isBlank, leafEntries, planMerge, valueAt } from '../src/sources/hofworld.ts';

/**
 * Mapping v3 person ids back to this roster.
 *
 * The failure worth testing for is not an exception. It is the version that
 * looks like it works: stripping `person:` resolves 82 of the archive's 85
 * person-to-person edges and silently drops three people.
 */

const map = {
  people: [
    { legacyId: 'alex-machaskee-2010', id: 'person:alex-machaskee-2010', changed: false },
    { legacyId: 'carolyn-balogh-2016-2016', id: 'person:carolyn-balogh-2016', changed: true },
    { legacyId: 'khalid-samad-2016-2016', id: 'person:khalid-samad-2016', changed: true },
  ],
};

test('an unchanged id maps to itself without the prefix', () => {
  assert.equal(buildIdIndex(map).toRepoId('person:alex-machaskee-2010'), 'alex-machaskee-2010');
});

test('a normalised id maps back to the doubled year the roster records', () => {
  const ids = buildIdIndex(map);
  assert.equal(ids.toRepoId('person:carolyn-balogh-2016'), 'carolyn-balogh-2016-2016');
  assert.equal(ids.toRepoId('person:khalid-samad-2016'), 'khalid-samad-2016-2016');
});

test('an id the map does not carry resolves to null, never to a stripped guess', () => {
  // The whole point. Falling back to `replace(/^person:/, '')` would return
  // 'someone-2016' here, which is not on the roster, and the caller would
  // either drop it quietly or attach a claim to nobody.
  const ids = buildIdIndex(map);
  assert.equal(ids.toRepoId('person:someone-2016'), null);
  assert.equal(ids.toRepoId('org:jones-day'), null);
  assert.equal(ids.toRepoId('carolyn-balogh-2016'), null, 'an untyped id is not a person id');
});

test('the map reports which ids moved, so an ingest can say so', () => {
  const ids = buildIdIndex(map);
  assert.equal(ids.count, 3);
  assert.deepEqual(ids.changed.map((entry) => entry.repoId).sort(), [
    'carolyn-balogh-2016-2016', 'khalid-samad-2016-2016',
  ]);
  assert.equal(ids.didChange('person:carolyn-balogh-2016'), true);
  assert.equal(ids.didChange('person:alex-machaskee-2010'), false);
});

test('only person ids are taken, whatever else the map holds', () => {
  const mixed = { people: [...map.people, { legacyId: 'jones-day', id: 'org:jones-day', changed: false }] };
  const ids = buildIdIndex(mixed);
  assert.equal(ids.count, 3);
  assert.equal(ids.toRepoId('org:jones-day'), null);
});

test('a map missing its people list is an error, not an empty resolver', () => {
  // An empty resolver resolves nothing, and every caller reads that as "no
  // matches" rather than "the map did not load".
  assert.throws(() => buildIdIndex({}), /has no `people` list/);
  assert.throws(() => buildIdIndex({ people: [] }), /no usable person entries/);
  assert.throws(() => buildIdIndex({ people: [{ id: 'person:x' }] }), /no usable person entries/);
});

// ------------------------------------------------ what an archive may contribute

test('a field the repository has not filled in is taken', () => {
  const plan = planMerge('p', { pronunciation: 'MATCH-as-kee' }, { pronunciation: '' });
  assert.equal(plan.taken.length, 1);
  assert.equal(plan.taken[0]?.path, 'pronunciation');
  assert.equal(plan.refused.length, 0);
});

test('a field the two disagree about is refused, and the repository keeps its value', () => {
  // The case this whole tool exists for: the archive predates three heritage
  // corrections, and a merge preferring the incoming value would undo them.
  const plan = planMerge('bill-miller-2017',
    { approvedCountryTags: ['Slovenian'] },
    { approvedCountryTags: ['Polish', 'German'] });
  assert.equal(plan.taken.length, 0);
  assert.equal(plan.refused.length, 1);
  assert.deepEqual(plan.refused[0]?.current, ['Polish', 'German']);
  assert.match(plan.refused[0]?.why ?? '', /both are set/);
});

test('an archive blank never clears a value the repository holds', () => {
  const plan = planMerge('dick-pogue-2015',
    { approvedCountryTags: [] },
    { approvedCountryTags: ['Scotch-Irish'] });
  assert.equal(plan.taken.length, 0);
  assert.match(plan.refused[0]?.why ?? '', /nothing here/);
});

test('identical fields are counted and left alone', () => {
  const plan = planMerge('p', { a: 'x', b: ['y'] }, { a: 'x', b: ['y'] });
  assert.equal(plan.identical, 2);
  assert.equal(plan.taken.length + plan.refused.length, 0);
});

test('false and zero are decisions, not blanks', () => {
  // Counting them as empty turns "reviewed and declined" into "nobody looked",
  // and an import would then quietly flip a featured flag or a rights refusal.
  assert.equal(isBlank(false), false);
  assert.equal(isBlank(0), false);
  const plan = planMerge('p', { featured: true }, { featured: false });
  assert.equal(plan.taken.length, 0, 'false is held, not overwritten');
  assert.equal(plan.refused.length, 1);
});

test('nesting is walked, and arrays are leaves rather than branches', () => {
  const entries = [...leafEntries({ image: { focalPoint: 'center' }, tags: ['a', 'b'] })];
  assert.deepEqual(entries.map(([path]) => path).sort(), ['image.focalPoint', 'tags']);
  assert.equal(valueAt({ image: { focalPoint: 'center' } }, 'image.focalPoint'), 'center');
  assert.equal(valueAt({}, 'image.focalPoint'), undefined);
});

test('a nested field is compared at the leaf, not as a whole object', () => {
  // Comparing `image` wholesale would refuse the entire block over one
  // differing key, and take nothing from the rest of it.
  const plan = planMerge('p',
    { image: { focalPoint: 'top', primaryAltText: 'A portrait' } },
    { image: { focalPoint: 'center', primaryAltText: '' } });
  assert.deepEqual(plan.taken.map((entry) => entry.path), ['image.primaryAltText']);
  assert.deepEqual(plan.refused.map((entry) => entry.path), ['image.focalPoint']);
});
