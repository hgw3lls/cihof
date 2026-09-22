import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { InductionCrosswalk } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { readInductionCrosswalk } from '../src/sources/crosswalk.ts';

const people = buildPeople();
const ids = people.map((person) => person.id);
const inducter = ids[0];

const decision = {
  decisionReference: 'cur-2026-040',
  contentVersion: 'v5',
  publication: { publicWeb: true, kiosk: true },
};

/** One resolved name that inducted `count` people, using real roster ids. */
function resolved(count: number, over: Partial<InductionCrosswalk> = {}): InductionCrosswalk {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-21T00:00:00.000Z',
    source: 'data/cihof_kiosk_manifest.csv#inducted_by',
    entries: [{
      id: 'inducter:fixture',
      recordedName: people[0]!.name,
      inducted: ids.slice(1, 1 + count) as never,
      candidates: [],
      resolution: { status: 'inductee', inducteeId: inducter as never, decisionReference: 'cur-2026-039' },
    }],
    ...over,
  };
}

test('the crosswalk as it actually stands leaves Connections off', () => {
  // The honest state of the collection: every name recorded, none resolved.
  const bundle = buildRuntimeBundle(people, 'kiosk');
  assert.equal(bundle.relationships.length, 0);
  assert.equal(bundle.lenses.includes('links'), false);
  assert.equal(bundle.relationshipReport.crosswalkNamesUnresolved, 95);
  assert.equal(bundle.relationshipReport.crosswalkApproved, false);
});

test('the report distinguishes "no relationships" from "nobody has looked yet"', () => {
  // Both are a count of zero and they are different problems, so a release can
  // say which one it is looking at.
  const unresolved = buildRuntimeBundle(people, 'kiosk').relationshipReport;
  const missing = buildRuntimeBundle(people, 'kiosk', { crosswalk: null }).relationshipReport;
  assert.equal(unresolved.published, missing.published);
  assert.equal(unresolved.crosswalkNamesUnresolved, 95);
  assert.equal(missing.crosswalkNamesUnresolved, 0, 'no crosswalk at all is a different report');
});

test('resolving every name does not publish a single relationship', () => {
  // The separation, carried all the way through the build rather than only
  // asserted in the unit tests.
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: resolved(20) });
  assert.equal(bundle.relationships.length, 0);
  assert.equal(bundle.lenses.includes('links'), false);
  assert.equal(bundle.relationshipReport.crosswalkNamesUnresolved, 0, 'the work is done');
  assert.equal(bundle.relationshipReport.crosswalkApproved, false, 'and still unapproved');
});

test('Connections turns itself on when the crosswalk is resolved and approved', () => {
  const justShort = buildRuntimeBundle(people, 'kiosk', { crosswalk: resolved(14, { publicationDecision: decision }) });
  assert.equal(justShort.relationships.length, 14);
  assert.equal(justShort.lenses.includes('links'), false, '14 is below the threshold of 15');

  const enough = buildRuntimeBundle(people, 'kiosk', { crosswalk: resolved(15, { publicationDecision: decision }) });
  assert.equal(enough.lenses.includes('links'), true, 'the lens appears without a code change');
  assert.equal(enough.relationships.length, 15);
  assert.equal(enough.relationshipReport.fromCrosswalk, 15);
  assert.equal(enough.relationshipReport.curated, 0);
});

test('an approval for the kiosk does not open Connections on the public site', () => {
  const kioskOnly = resolved(20, {
    publicationDecision: { ...decision, publication: { publicWeb: false, kiosk: true } },
  });
  assert.equal(buildRuntimeBundle(people, 'kiosk', { crosswalk: kioskOnly }).lenses.includes('links'), true);
  assert.equal(buildRuntimeBundle(people, 'public', { crosswalk: kioskOnly }).lenses.includes('links'), false);
});

test('a generated relationship carries the real names of both people', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: resolved(1, { publicationDecision: decision }) });
  const link = bundle.relationships[0]!;
  assert.equal(link.from, inducter);
  assert.equal(link.to, ids[1]!);
  assert.equal(link.label, `inducted ${people[1]!.name}`);
  assert.equal(link.inverseLabel, `was inducted by ${people[0]!.name}`);
  assert.equal(link.evidence[0]?.excerpt, people[0]!.name, 'the roster wording that was resolved');
});

test('a curated record wins over the generated one for the same pair', () => {
  const curated = {
    claim: 'documented', id: `induction:${inducter}:${ids[1]}`,
    from: inducter, to: ids[1], kind: 'inducted',
    label: 'presented at the 2011 ceremony', inverseLabel: 'was presented by a longtime colleague',
    review: { status: 'approved', decisionReference: 'cur-1', contentVersion: 'v1' },
    publication: { publicWeb: true, kiosk: true },
    evidence: [{ id: 'ev-1', title: 'Ceremony programme, 2011', kind: 'primary-source' }],
  };
  const bundle = buildRuntimeBundle(people, 'kiosk', {
    crosswalk: resolved(1, { publicationDecision: decision }),
    relationships: [curated],
  });
  assert.equal(bundle.relationships.length, 1, 'counted once, not twice');
  assert.equal(bundle.relationships[0]?.label, 'presented at the 2011 ceremony');
});

test('a missing crosswalk file builds rather than breaking the release', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: null });
  assert.equal(bundle.relationships.length, 0);
  assert.deepEqual(bundle.lenses, ['people', 'years']);
});

test('the committed crosswalk is readable by the build', () => {
  const crosswalk = readInductionCrosswalk();
  assert.ok(crosswalk, 'the generated file is present and parses');
  assert.equal(crosswalk.entries.length, 95);
  assert.equal(crosswalk.publicationDecision, undefined);
});
