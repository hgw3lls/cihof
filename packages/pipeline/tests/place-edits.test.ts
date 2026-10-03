import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { publishedPlaces } from '@cihof/content';
import { applyPlaceEdits, newPlaceId, placeEditColumns, placeEditDecisions, readPeople } from '../src/build/place-edits.ts';
import { placeTextVersion, placeWordsState } from '../src/build/place-text.ts';
import { dataFile } from '../src/paths.ts';

// The real places, read once; nothing here writes into them.
const places = JSON.parse(readFileSync(dataFile('cihof_places.json'), 'utf8'));
const associations = JSON.parse(readFileSync(dataFile('cihof_place_associations.json'), 'utf8'));
const removed = JSON.parse(readFileSync(dataFile('cihof_places_removed.json'), 'utf8')).removed;
const personIds = new Set(Object.keys(JSON.parse(readFileSync(dataFile('cihof_curated_metadata.json'), 'utf8')).inductees));
const gardens = places.places.find((place: { id: string }) => place.id === 'place:cleveland-cultural-gardens');
const untied = [...personIds].find((id) => !associations.associations.some((tie: { person: string; place: string }) => tie.person === id && tie.place === gardens.id))!;

const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
const sheet = (...rows: Partial<Record<(typeof placeEditColumns)[number], string>>[]) => [
  placeEditColumns.join(','),
  ...rows.map((row) => placeEditColumns.map((column) => quote({
    placeId: gardens.id, decision: 'edit', contentVersion: placeTextVersion(gardens), name: gardens.name, neighborhood: gardens.neighborhood,
    type: gardens.type, shortHistory: gardens.shortHistory, people: '', audience: 'kiosk', decisionReference: 'place-edits-review-2026-10-03', note: '', ...row,
  }[column] ?? '')).join(',')),
].join('\n');
const read = (...rows: Parameters<typeof sheet>) => placeEditDecisions(sheet(...rows), { places, associations, personIds, removed });

test('a renamed place, approved as edited, is shown under its new name with somebody new tied to it', () => {
  const { decisions, errors } = read({ name: 'The Cleveland Cultural Gardens', people: `${untied}:served` });
  assert.deepEqual(errors, []);
  const next = applyPlaceEdits(places, associations, decisions, '2026-10-03T10:00:00.000Z');
  const edited = next.places.places.find((place) => place.id === gardens.id)!;
  assert.equal(edited['name'], 'The Cleveland Cultural Gardens');
  assert.equal(placeWordsState(edited), 'current', 'the approval covers the new words');
  assert.deepEqual(edited['publication'], { kiosk: true, publicWeb: false });
  assert.ok(publishedPlaces(next.places.places, 'kiosk').some((place) => place.id === gardens.id));
  const tie = next.associations.associations.at(-1)!;
  assert.deepEqual([tie['person'], tie['place'], tie['role']], [untied, gardens.id, 'served']);
  assert.equal(places.places.find((place: { id: string }) => place.id === gardens.id).name, 'Cleveland Cultural Gardens', 'the places read in are untouched');
});

test('an edit left for somebody else hides the place until its new words are approved, and shows its new people nowhere', () => {
  const { decisions } = read({ shortHistory: `${gardens.shortHistory.slice(0, 200).trim()}.`, audience: 'nobody', people: `${untied}:served` });
  const next = applyPlaceEdits(places, associations, decisions, '2026-10-03T10:00:00.000Z');
  assert.equal(placeWordsState(next.places.places.find((place) => place.id === gardens.id)!), 'changed');
  const tie = next.associations.associations.at(-1)!;
  assert.equal((tie['review'] as { status: string }).status, 'needs-review');
  assert.deepEqual(tie['publication'], { kiosk: false, publicWeb: false });
});

test('a place may not take another place\'s name, or bring back one a curator took out', () => {
  const create = { placeId: '', decision: 'create', contentVersion: '', neighborhood: '', type: 'business', shortHistory: 'Words.', people: `${untied}:worked`, audience: 'nobody' };
  const other = places.places.find((place: { id: string; name: string }) => place.id !== gardens.id)!;
  assert.match(read({ name: other.name }).errors.join(' '), /another place is called/);
  assert.match(read({ ...create, name: 'Cleveland Cultural Gardens ' }, {}).errors.join(' '), /already a place|another place is called/);
  assert.match(read({ ...create, name: 'The Gardens' }, { name: 'The Gardens' }).errors.join(' '), /another place is called/);
  assert.match(read({ ...create, name: removed[0].name }).errors.join(' '), /taken out of the places/);
});

test('a new place needs a kind, words and somebody there, and takes its id from its name', () => {
  const create = { placeId: '', decision: 'create', contentVersion: '', name: 'West Side Market', neighborhood: 'Ohio City', type: 'business', shortHistory: 'A public market since 1912.', audience: 'nobody' };
  assert.match(read({ ...create }).errors.join(' '), /needs somebody tied to it/);
  assert.match(read({ ...create, type: 'castle', people: `${untied}:worked` }).errors.join(' '), /not a kind of place/);
  assert.match(read({ ...create, shortHistory: '', people: `${untied}:worked` }).errors.join(' '), /history is empty/);
  const { decisions, errors } = read({ ...create, people: `${untied}:worked` });
  assert.deepEqual(errors, []);
  assert.equal(decisions[0]!.placeId, newPlaceId('West Side Market'));
  const next = applyPlaceEdits(places, associations, decisions, '2026-10-03T10:00:00.000Z');
  assert.equal(next.places.places.length, places.places.length + 1);
  assert.equal(publishedPlaces(next.places.places, 'kiosk').some((place) => place.id === 'place:west-side-market'), false, 'not shown until approved');
  assert.match(read({ ...create, name: gardens.name, people: `${untied}:worked` }).errors.join(' '), /already a place called that/);
});

test('an edit is refused on words that changed since, for somebody unknown or already there, or a role nobody uses', () => {
  const tiedAlready = associations.associations.find((tie: { place: string }) => tie.place === gardens.id).person;
  assert.match(read({ contentVersion: 'place-000000000000' }).errors.join(' '), /changed since/);
  assert.match(read({ people: 'nobody-at-all:served' }).errors.join(' '), /there is nobody/);
  assert.match(read({ people: `${tiedAlready}:served` }).errors.join(' '), /tied to it already/);
  assert.match(read({ people: `${untied}:associated` }).errors.join(' '), /not what somebody did/);
  assert.match(read({ audience: 'everyone' }).errors.join(' '), /not who may see it/);
  assert.match(read({ audience: 'nobody' }).errors.join(' '), /changes nothing/);
  assert.deepEqual(readPeople('a-1:served; b-2:worked'), [{ personId: 'a-1', role: 'served' }, { personId: 'b-2', role: 'worked' }]);
});
