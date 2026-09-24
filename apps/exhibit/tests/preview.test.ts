import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishedRelationship } from '@cihof/content';
import type { PreviewTie } from '@cihof/pipeline';
import { connectionMap, connectionNodes } from '../src/state/selectors.ts';
import type { RuntimePerson } from '../src/data/runtime.ts';
import { resolvePreview } from '../scripts/target.mjs';

const person = (id: string, name: string): RuntimePerson => ({
  id, name, sortName: name, classYear: 2010, portrait: null, biography: '', biographyCurated: false,
  contributions: [], communities: [], countries: [], sourceUrl: null, presentedBy: null, films: [],
});

const people = [person('ana', 'Ana Ruiz'), person('ben', 'Ben Cole'), person('cal', 'Cal Diaz')];

const documented = {
  claim: 'documented', id: 'rel-1', from: 'ana', to: 'ben', kind: 'collaborated-with',
  label: 'worked with Ben Cole', review: { status: 'approved', decisionReference: 'd', contentVersion: 'v' },
  publication: { publicWeb: false, kiosk: true }, evidence: [{ id: 'e', title: 't', kind: 'collection-record' }],
} as unknown as PublishedRelationship;

const proposed = (over: Partial<PreviewTie> = {}): PreviewTie => ({
  id: 'preview:1', from: 'ana', to: 'cal', sourceType: 'documented_mention', label: 'named in a profile',
  evidence: '', sourceUrl: '', unreviewed: true, ...over,
});

test('a preview is off unless asked for, and asked for exactly', () => {
  assert.equal(resolvePreview('kiosk', {}), false);
  assert.throws(() => resolvePreview('kiosk', { CIHOF_PREVIEW: 'yes' }), /Use CIHOF_PREVIEW=all/);
});

test('a preview is refused in an automated build and for the public target', () => {
  assert.throws(() => resolvePreview('kiosk', { CIHOF_PREVIEW: 'all', CI: 'true' }), /automated build/);
  assert.throws(() => resolvePreview('public', { CIHOF_PREVIEW: 'all' }), /public target/);
});

test('proposed ties join the map marked, and read the same from either end', () => {
  const nodes = connectionNodes(people, [documented], [proposed()]);
  const cal = nodes.find((node) => node.person.id === 'cal')!;
  assert.equal(cal.ties[0]!.unreviewed, true);
  assert.equal(cal.ties[0]!.label, 'named in a profile');

  const map = connectionMap(nodes, 'ana');
  const toCal = map.placed.find((entry) => entry.person.id === 'cal')!;
  assert.equal(toCal.labelUnreviewed, true);
  assert.equal(map.ties.find((tie) => tie.to === 'cal' || tie.from === 'cal')!.unreviewed, true);
  assert.equal(map.ties.find((tie) => tie.connectionId === 'rel-1')!.unreviewed, false);
});

test('a person with a reviewed and a proposed tie is placed once, under the reviewed wording', () => {
  const nodes = connectionNodes(people, [documented], [proposed({ id: 'preview:2', to: 'ben' })]);
  const map = connectionMap(nodes, 'ana');
  const bens = map.placed.filter((entry) => entry.person.id === 'ben');
  assert.equal(bens.length, 1);
  assert.equal(bens[0]!.label, 'worked with Ben Cole');
  assert.equal(bens[0]!.labelUnreviewed, false);
});

test('without proposals the map is exactly the reviewed one', () => {
  const plain = connectionMap(connectionNodes(people, [documented]), 'ana');
  assert.equal(plain.ties.every((tie) => !tie.unreviewed), true);
  assert.equal(plain.placed.length, 2);
});

test('context joins the map on its own layer, and a documented tie outranks it', () => {
  const context = {
    claim: 'context', id: 'context:1', between: ['ana', 'cal'], basis: 'appeared-together',
    value: 'joint_oral_history_participant', statement: 'Both recorded in the same session',
  } as unknown as import('@cihof/content').SharedContext;

  const map = connectionMap(connectionNodes(people, [documented], [], [context]), 'ana');
  const cal = map.placed.find((entry) => entry.person.id === 'cal')!;
  assert.equal(cal.labelContext, true);
  assert.equal(cal.labelUnreviewed, false);
  assert.equal(map.ties.find((tie) => tie.connectionId === 'context:1')!.context, true);

  const both = connectionMap(connectionNodes(people, [documented], [proposed({ to: 'ben' })], [
    { ...context, between: ['ana', 'ben'] } as unknown as typeof context,
  ]), 'ana');
  const ben = both.placed.filter((entry) => entry.person.id === 'ben');
  assert.equal(ben.length, 1);
  assert.equal(ben[0]!.label, 'worked with Ben Cole', 'documented beats context beats proposed');
});
