import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import type { CorpusConnection } from '../src/sources/corpus.ts';

/**
 * An editor's preview.
 *
 * It shows what nobody has reviewed so an editor can see it in place and decide.
 * What must never happen is that seeing it counts as deciding it: nothing a
 * preview adds may look approved, count toward a lens, or reach a public build.
 */

const people = buildPeople();

const proposed = (over: Partial<CorpusConnection> = {}): CorpusConnection => ({
  id: 'person-rel:fixture',
  from: 'alex-machaskee-2010',
  to: 'august-pust-2010',
  sourceType: 'collaborator',
  evidence: 'Fixture sentence from a profile.',
  sourceUrl: '',
  verificationLayer: 'documented-in-profile',
  ...over,
});

test('an ordinary build carries no preview content', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk');
  assert.equal(bundle.preview, false);
  assert.deepEqual(bundle.candidates, []);
  assert.equal(bundle.places.some((place) => place.unreviewed), false);
});

test('a public preview is refused before anything is built', () => {
  assert.throws(() => buildRuntimeBundle(people, 'public', { preview: true }), /kiosk target only/);
});

test('a preview shows every seeded place, each marked and published to nobody', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk', { preview: true });
  assert.equal(bundle.preview, true);
  const unreviewed = bundle.places.filter((place) => place.unreviewed);
  assert.ok(unreviewed.length > 0, 'the seeded places appear');
  for (const place of unreviewed) {
    assert.equal(place.review.status, 'needs-review');
    assert.deepEqual(place.publication, { publicWeb: false, kiosk: false });
  }
  // A person's tie from the seeded associations brings them under the place.
  assert.ok(unreviewed.some((place) => place.personIds.length > 0));
});

test('proposed ties are marked, deduplicated and kept to people this release shows', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk', {
    preview: true,
    corpusConnections: [
      proposed(),
      proposed({ id: 'person-rel:reversed', from: 'august-pust-2010', to: 'alex-machaskee-2010' }),
      proposed({ id: 'person-rel:elsewhere', to: 'nobody-in-this-release' }),
    ],
  });
  assert.equal(bundle.candidates.length, 1, 'the reversed duplicate and the dead end are dropped');
  const tie = bundle.candidates[0]!;
  assert.equal(tie.unreviewed, true);
  assert.equal(tie.label, 'collaborator');
  assert.equal(tie.id, 'preview:person-rel:fixture');
});

test('proposed ties never count toward the Connections threshold', () => {
  const many = Array.from({ length: 20 }, (_, index) => proposed({ id: `person-rel:${index}`, to: people[index + 2]!.id }));
  const bundle = buildRuntimeBundle(people, 'kiosk', { preview: true, crosswalk: null, corpusConnections: many });
  assert.equal(bundle.candidates.length, 20);
  assert.equal(bundle.relationships.length, 0);
  assert.equal(bundle.lenses.includes('links'), false);
});

test('the corpus rows the preview reads are the non-induction ones', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk', { preview: true });
  assert.ok(bundle.candidates.length > 0);
  assert.equal(bundle.candidates.some((tie) => tie.sourceType.startsWith('inducted_by')), false,
    'induction rows reach the map through the reviewed crosswalk, not as proposals');
});

test('a place reviewed for another audience is not shown in preview as unreviewed', () => {
  const approved = { status: 'approved', decisionReference: 'places-fixture', contentVersion: 'v1' } as const;
  const webOnly = {
    id: 'place:web-only', name: 'Web-only place', shortHistory: 'History.', neighborhood: '',
    review: approved, publication: { publicWeb: true, kiosk: false },
  };
  const withheld = { id: 'place:withheld', name: 'Withheld place', review: { status: 'withheld' } };
  const open = { id: 'place:open', name: 'Nobody has looked at this' };
  const bundle = buildRuntimeBundle(people, 'kiosk', { preview: true, places: [webOnly, withheld, open], placeAssociations: [] });
  assert.deepEqual(bundle.places.map((place) => place.id), ['place:open'],
    'the decisions stand: neither reappears marked as never reviewed');
});
