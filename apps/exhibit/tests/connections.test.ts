import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishedRelationship } from '@cihof/content';
import { connectionNodes } from '../src/state/selectors.ts';
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
