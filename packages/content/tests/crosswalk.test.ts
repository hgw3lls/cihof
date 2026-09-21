import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  crosswalkProgress, inductionRelationships, labelFrom, publishedConnections, unresolvedEntries,
  type InductionCrosswalk,
} from '../src/index.ts';

const names: Record<string, string> = {
  'alex-machaskee-2010': 'Alex Machaskee',
  'august-pust-2010': 'August Pust',
  'irene-morrow-2010': 'Irene Morrow',
};
const nameOf = (id: string) => names[id];

const resolvedToMachaskee = {
  status: 'inductee' as const,
  inducteeId: 'alex-machaskee-2010' as never,
  decisionReference: 'cur-2026-030',
};

function crosswalk(over: Partial<InductionCrosswalk> = {}): InductionCrosswalk {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-21T00:00:00.000Z',
    source: 'data/cihof_kiosk_manifest.csv#inducted_by',
    entries: [{
      id: 'inducter:alex-machaskee',
      recordedName: 'Alex Machaskee',
      inducted: ['august-pust-2010', 'irene-morrow-2010'] as never,
      candidates: [{ inducteeId: 'alex-machaskee-2010' as never, displayName: 'Alex Machaskee', basis: 'normalised-name' }],
      resolution: resolvedToMachaskee,
    }],
    ...over,
  };
}

const decision = {
  decisionReference: 'cur-2026-031',
  contentVersion: 'v4',
  publication: { publicWeb: true, kiosk: true },
};

test('resolving every name grants no permission to publish any of it', () => {
  // The whole point of keeping the two decisions apart. A curator saying which
  // Sam Miller this is has not said the relationship may go on a wall.
  const resolved = crosswalk();
  assert.equal(crosswalkProgress(resolved).unresolved, 0, 'the name is resolved');
  assert.equal(crosswalkProgress(resolved).relationshipsAvailable, 2);
  assert.deepEqual(inductionRelationships(resolved, nameOf), [], 'and still yields nothing');

  assert.equal(inductionRelationships(crosswalk({ publicationDecision: decision }), nameOf).length, 2);
});

test('a generated relationship is publishable without further repair', () => {
  // Proves the generator emits the shape the publication rules demand, rather
  // than something that only looks right until it reaches the filter.
  const relationships = inductionRelationships(crosswalk({ publicationDecision: decision }), nameOf);
  assert.equal(publishedConnections(relationships, 'public').length, 2);
  assert.equal(publishedConnections(relationships, 'kiosk').length, 2);
});

test('an induction reads correctly from both ends', () => {
  const first = inductionRelationships(crosswalk({ publicationDecision: decision }), nameOf)[0]!;
  assert.equal(first.kind, 'inducted');
  assert.equal(labelFrom(first, 'alex-machaskee-2010' as never), 'inducted August Pust');
  assert.equal(labelFrom(first, 'august-pust-2010' as never), 'was inducted by Alex Machaskee');
});

test('the citation quotes the roster wording that had to be resolved', () => {
  const first = inductionRelationships(crosswalk({ publicationDecision: decision }), nameOf)[0]!;
  assert.equal(first.evidence.length, 1);
  assert.equal(first.evidence[0]?.excerpt, 'Alex Machaskee',
    'a reader can see the record said a name and that a curator decided whose');
});

test('a kiosk-only decision does not reach the public web', () => {
  const kioskOnly = { ...decision, publication: { publicWeb: false, kiosk: true } };
  const relationships = inductionRelationships(crosswalk({ publicationDecision: kioskOnly }), nameOf);
  assert.equal(publishedConnections(relationships, 'kiosk').length, 2);
  assert.equal(publishedConnections(relationships, 'public').length, 0);
});

test('a row naming its own subject draws no line from a portrait to itself', () => {
  const selfInduction = crosswalk({
    publicationDecision: decision,
    entries: [{
      id: 'inducter:alex-machaskee',
      recordedName: 'Alex Machaskee',
      inducted: ['alex-machaskee-2010', 'august-pust-2010'] as never,
      candidates: [],
      resolution: resolvedToMachaskee,
    }],
  });
  const relationships = inductionRelationships(selfInduction, nameOf);
  assert.deepEqual(relationships.map((r) => r.to), ['august-pust-2010']);
  assert.equal(crosswalkProgress(selfInduction).relationshipsAvailable, 1,
    'the count matches what the build actually emits');
});

test('a person with no name produces no relationship rather than a label with a hole', () => {
  const relationships = inductionRelationships(crosswalk({ publicationDecision: decision }), (id) =>
    id === 'irene-morrow-2010' ? undefined : names[id]);
  assert.deepEqual(relationships.map((r) => r.to), ['august-pust-2010']);
});

test('names that are not inductees yield nothing but still count as reviewed', () => {
  const settled = crosswalk({
    publicationDecision: decision,
    entries: [
      {
        id: 'inducter:sam-miller', recordedName: 'Sam Miller',
        inducted: ['august-pust-2010'] as never, candidates: [],
        resolution: { status: 'not-an-inductee', decisionReference: 'cur-2026-032' },
      },
      {
        id: 'inducter:unclear', recordedName: 'the induction committee',
        inducted: ['irene-morrow-2010'] as never, candidates: [],
        resolution: { status: 'unidentifiable', decisionReference: 'cur-2026-033' },
      },
    ],
  });
  assert.deepEqual(inductionRelationships(settled, nameOf), []);
  const progress = crosswalkProgress(settled);
  assert.equal(progress.unresolved, 0);
  assert.equal(progress.notAnInductee, 1);
  assert.equal(progress.unidentifiable, 1);
  assert.equal(progress.rowsResolved, 2, 'review credit is given for deciding a name is nobody in the hall');
});

test('the review queue leads with the names that cover the most records', () => {
  const queue = crosswalk({
    entries: [
      { id: 'a', recordedName: 'One Row', inducted: ['august-pust-2010'] as never, candidates: [], resolution: { status: 'unresolved' } },
      { id: 'b', recordedName: 'Four Rows', inducted: ['a', 'b', 'c', 'd'] as never, candidates: [], resolution: { status: 'unresolved' } },
      { id: 'c', recordedName: 'Done', inducted: ['e'] as never, candidates: [], resolution: resolvedToMachaskee },
    ],
  });
  assert.deepEqual(unresolvedEntries(queue).map((entry) => entry.recordedName), ['Four Rows', 'One Row']);
});
