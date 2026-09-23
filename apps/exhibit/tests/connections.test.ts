import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishedRelationship } from '@cihof/content';
import { connectionMap, connectionNodes } from '../src/state/selectors.ts';
import type { RuntimePerson } from '../src/data/runtime.ts';

/**
 * Gathering documented relationships for the Connections lens.
 *
 * The failure worth testing for here is not an empty screen. It is a screen
 * that reads fluently and states the opposite of what a curator approved,
 * which is what happens when a forward label is read back from the far end.
 */

const person = (id: string, name: string): RuntimePerson => ({
  id, name, sortName: name, classYear: 2010, portrait: null, biography: '', biographyCurated: false,
  contributions: [], communities: [], countries: [], sourceUrl: null, films: [],
});

const people = [person('miller', 'Samuel H. Miller'), person('ratner', 'Albert B. Ratner'), person('pilla', 'Bishop Anthony Pilla')];

/**
 * A published relationship. `withoutInverse` drops the key rather than setting
 * it to undefined, which is the shape a record missing an inverse label really
 * arrives in.
 */
const relationship = (
  over: Partial<PublishedRelationship> = {},
  withoutInverse = false,
): PublishedRelationship => {
  const base = {
    claim: 'documented',
    id: 'induction:miller:ratner',
    from: 'miller',
    to: 'ratner',
    kind: 'inducted',
    label: 'inducted Albert B. Ratner',
    inverseLabel: 'was inducted by Samuel H. Miller',
    review: { status: 'approved', decisionReference: 'cur-1', contentVersion: 'v1' },
    publication: { publicWeb: false, kiosk: true },
    evidence: [{ id: 'ev-1', title: 'CIHOF kiosk manifest, inducted_by', kind: 'collection-record' }],
    ...over,
  } as Record<string, unknown>;
  if (withoutInverse) delete base['inverseLabel'];
  return base as unknown as PublishedRelationship;
};

test('one relationship reaches both of the people it joins', () => {
  const nodes = connectionNodes(people, [relationship()]);
  assert.deepEqual(nodes.map((node) => node.person.id).sort(), ['miller', 'ratner']);
});

test('each end reads the claim in its own direction', () => {
  const nodes = connectionNodes(people, [relationship()]);
  const miller = nodes.find((node) => node.person.id === 'miller');
  const ratner = nodes.find((node) => node.person.id === 'ratner');
  assert.equal(miller?.ties[0]?.label, 'inducted Albert B. Ratner');
  assert.equal(ratner?.ties[0]?.label, 'was inducted by Samuel H. Miller');
});

test('a directional claim with no inverse is not read backwards', () => {
  // The whole point. Without the inverse, showing Ratner the forward label
  // would say Ratner inducted Miller — fluent, and the reverse of the record.
  const nodes = connectionNodes(people, [relationship({}, true)]);
  assert.deepEqual(nodes.map((node) => node.person.id), ['miller']);
  assert.equal(nodes[0]?.ties.length, 1);
});

test('a non-directional claim reads the same from either end', () => {
  const nodes = connectionNodes(people, [relationship({
    kind: 'collaborated-with', label: 'worked with Albert B. Ratner on the Tower City redevelopment',
  }, true)]);
  assert.equal(nodes.length, 2);
  for (const node of nodes) {
    assert.equal(node.ties[0]?.label, 'worked with Albert B. Ratner on the Tower City redevelopment');
  }
});

test('a relationship naming somebody absent from this release is dropped', () => {
  // A published bundle can withhold a person the relationship still names, and
  // a tie to a portrait that is not there is a dead end on a wall.
  const nodes = connectionNodes(people, [relationship({ to: 'nobody-here' as never })]);
  assert.deepEqual(nodes, []);
});

test('the most connected person comes first, then by sort name', () => {
  const nodes = connectionNodes(people, [
    relationship(),
    relationship({ id: 'induction:miller:pilla' as never, to: 'pilla' as never, label: 'inducted Bishop Anthony Pilla' }),
  ]);
  assert.equal(nodes[0]?.person.id, 'miller');
  assert.equal(nodes[0]?.ties.length, 2);
  assert.deepEqual(nodes.slice(1).map((node) => node.person.id), ['ratner', 'pilla']);
});

test('nothing published is an empty graph, not a crash', () => {
  assert.deepEqual(connectionNodes(people, []), []);
  assert.deepEqual(connectionNodes([], [relationship()]), []);
});

// ------------------------------------------------------- the map's arrangement

const cast = [
  person('miller', 'Samuel H. Miller'), person('ratner', 'Albert B. Ratner'),
  person('pilla', 'Bishop Anthony Pilla'), person('maltz', 'Milton Maltz'),
  // A pair with no connection to the first four: its own island.
  person('wong', 'Margaret W. Wong'), person('chen', 'May Chen'),
];

const web = [
  relationship(),                                                                     // miller → ratner
  relationship({ id: 'induction:miller:pilla' as never, to: 'pilla' as never, label: 'inducted Bishop Anthony Pilla' }),
  // ratner → maltz, so maltz is two hops from miller.
  relationship({ id: 'induction:ratner:maltz' as never, from: 'ratner' as never, to: 'maltz' as never, label: 'inducted Milton Maltz', inverseLabel: 'was inducted by Albert B. Ratner' }),
  relationship({ id: 'induction:wong:chen' as never, from: 'wong' as never, to: 'chen' as never, label: 'inducted May Chen', inverseLabel: 'was inducted by Margaret W. Wong' }),
];

const mapOf = (focusId: string | null) => connectionMap(connectionNodes(cast, web), focusId);

test('the chosen person is the origin everything else is placed around', () => {
  const map = mapOf('miller');
  assert.equal(map.focus?.id, 'miller');
  const centre = map.placed.find((entry) => entry.person.id === 'miller');
  assert.deepEqual([centre?.x, centre?.y, centre?.ring], [0, 0, 'focus']);
});

test('distance from the centre is how far the claim is from the person', () => {
  const map = mapOf('miller');
  const ringOf = (id: string) => map.placed.find((entry) => entry.person.id === id)?.ring;
  assert.equal(ringOf('ratner'), 'tie', 'a source says these two touched');
  assert.equal(ringOf('pilla'), 'tie');
  assert.equal(ringOf('maltz'), 'cluster', 'reachable, but not by a claim about this person');
  assert.equal(ringOf('wong'), 'elsewhere', 'a different island entirely');
});

test('only the claims about the person at the centre are worded', () => {
  // A label on a line whose endpoints are both strangers to the centre states
  // a relationship the visitor has no context for, in wording chosen for a
  // different viewpoint.
  const map = mapOf('miller');
  const label = (id: string) => map.ties.find((tie) => tie.connectionId === id)?.label;
  assert.equal(label('induction:miller:ratner'), 'inducted Albert B. Ratner');
  assert.equal(label('induction:ratner:maltz'), null, 'neither end is the centre');
});

test('a claim reads outwards from the centre whichever end the centre is', () => {
  // Approaching from `to` and reading the forward label would reverse it.
  const fromRatner = mapOf('ratner');
  const tie = fromRatner.ties.find((entry) => entry.connectionId === 'induction:miller:ratner');
  assert.equal(tie?.label, 'was inducted by Samuel H. Miller');
});

test('the same choice arranges the map the same way every time', () => {
  // A visitor who points at a portrait and looks back should find it there.
  const once = mapOf('miller');
  const again = mapOf('miller');
  assert.deepEqual(
    once.placed.map((entry) => [entry.person.id, entry.x.toFixed(6), entry.y.toFixed(6)]),
    again.placed.map((entry) => [entry.person.id, entry.x.toFixed(6), entry.y.toFixed(6)]),
  );
});

test('choosing somebody on the rim brings their island in', () => {
  const map = mapOf('wong');
  assert.equal(map.focus?.id, 'wong');
  assert.equal(map.placed.find((entry) => entry.person.id === 'chen')?.ring, 'tie');
  assert.equal(map.placed.find((entry) => entry.person.id === 'miller')?.ring, 'elsewhere');
});

test('the map counts the island it is showing and the ones it is not', () => {
  const map = mapOf('miller');
  assert.equal(map.clusterSize, 4, 'miller, ratner, pilla, maltz');
  assert.equal(map.islands, 1, 'the wong pair');
});

test('everybody in the collection is placed, nobody is dropped', () => {
  // A person who vanishes from the map is a relationship a visitor cannot
  // reach, and nothing else would report it.
  const map = mapOf('miller');
  assert.equal(map.placed.length, cast.length);
  assert.equal(new Set(map.placed.map((entry) => entry.person.id)).size, cast.length);
});

test('no chosen person, and the map still opens on somebody', () => {
  const map = mapOf(null);
  assert.ok(map.focus, 'arriving at the lens shows a map, not a blank field');
  assert.equal(map.placed.length, cast.length);
});

test('an empty collection is an empty map rather than a crash', () => {
  const map = connectionMap([], null);
  assert.equal(map.focus, null);
  assert.deepEqual(map.placed, []);
  assert.deepEqual(map.ties, []);
});
