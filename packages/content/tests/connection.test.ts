import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  connectionProblems, documentedCount, endpoints, isDirectional, isDocumented, labelFrom,
  placeAssociationProblems, publishedConnections, publishedPlaceAssociations, publishedRelationships,
  type Connection, type DocumentedRelationship, type SharedContext,
} from '../src/index.ts';

const approved = { status: 'approved', decisionReference: 'cur-2026-014', contentVersion: 'v3' } as const;
const everywhere = { publicWeb: true, kiosk: true };
const evidence = [{ id: 'ev-1', title: 'Cleveland Cultural Gardens Federation minutes, 1971', kind: 'primary-source' as const }];

function relationship(over: Partial<DocumentedRelationship> = {}): unknown {
  return {
    claim: 'documented', id: 'rel-1', from: 'august-pust-2010', to: 'leo-weidenthal-2010',
    kind: 'collaborated-with', label: 'worked with Leo Weidenthal on the One World Day programme',
    review: approved, publication: everywhere, evidence, ...over,
  };
}

const sameYear: SharedContext = {
  claim: 'context', id: 'ctx-1' as never, between: ['august-pust-2010', 'leo-weidenthal-2010'] as never,
  basis: 'induction-year', value: '2010', statement: 'Both honoured in 2010.',
};

test('shared context publishes without a review because it asserts nothing to review', () => {
  // There is no curatorial decision to be made about two people having been
  // honoured in the same year. Requiring approval for it would either stall a
  // computed fact in a review queue or invite a rubber stamp.
  const published = publishedConnections([sameYear], 'public');
  assert.equal(published.length, 1);
  assert.equal(published[0]?.claim, 'context');
});

test('shared context never counts as a documented relationship', () => {
  const mixed = publishedConnections([sameYear, relationship()], 'public') as Connection[];
  assert.equal(mixed.length, 2);
  assert.equal(documentedCount(mixed), 1,
    'the Links lens threshold counts documented relationships, not coincidences');
  assert.equal(publishedRelationships([sameYear], 'public').length, 0,
    'context must not reach the relationship bundle at all');
});

test('an approved relationship with no evidence is still refused', () => {
  // Approval says a person decided. Evidence says what they decided from. The
  // claim that two real lives touched needs both.
  const unsourced = relationship({ evidence: [] });
  assert.equal(publishedConnections([unsourced], 'public').length, 0);
  assert.deepEqual(connectionProblems(unsourced), ['no usable evidence']);
  assert.equal(publishedConnections([relationship()], 'public').length, 1);
});

test('approval that cannot be traced is not approval', () => {
  assert.deepEqual(
    connectionProblems(relationship({ review: { status: 'approved' } })),
    ['approved without a decision reference', 'approved without a content version'],
  );
  assert.deepEqual(connectionProblems(relationship({ review: { status: 'needs-review' } })), ['review status is needs-review']);
});

test('a relationship approved for the kiosk is not thereby approved for the web', () => {
  const kioskOnly = relationship({ publication: { publicWeb: false, kiosk: true } });
  assert.equal(publishedConnections([kioskOnly], 'kiosk').length, 1);
  assert.equal(publishedConnections([kioskOnly], 'public').length, 0);
});

test('a directional relationship must say how it reads from the other end', () => {
  assert.equal(isDirectional('mentored'), true);
  assert.equal(isDirectional('collaborated-with'), false);
  const oneWay = { ...(relationship() as object), kind: 'mentored', label: 'mentored Leo Weidenthal', inverseLabel: '' };
  assert.deepEqual(connectionProblems(oneWay), ['mentored reads differently from each end but has no inverse label']);
  assert.equal(publishedConnections([oneWay], 'public').length, 0);
});

test('reading a relationship from the far end does not reverse the claim', () => {
  const mentorship = relationship({
    kind: 'mentored', label: 'mentored Leo Weidenthal', inverseLabel: 'was mentored by August Pust',
  }) as DocumentedRelationship;
  assert.equal(labelFrom(mentorship, 'august-pust-2010' as never), 'mentored Leo Weidenthal');
  assert.equal(labelFrom(mentorship, 'leo-weidenthal-2010' as never), 'was mentored by August Pust');
  assert.equal(labelFrom(mentorship, 'irene-morrow-2010' as never), null,
    'a person who is not an endpoint gets no label rather than a default');

  const mutual = relationship() as DocumentedRelationship;
  assert.equal(labelFrom(mutual, 'leo-weidenthal-2010' as never), mutual.label,
    'a symmetric kind reads the same from either end');
});

test('a relationship cannot join a person to themselves', () => {
  assert.deepEqual(
    connectionProblems(relationship({ to: 'august-pust-2010' as never })),
    ['both endpoints are the same person'],
  );
});

test('a comparison must be a curator speaking, not a generator', () => {
  const base = {
    claim: 'comparison', id: 'cmp-1', between: ['august-pust-2010', 'margaret-w-wong-2015'],
    question: 'How do you make a city legible to people arriving in it?',
    review: approved, publication: everywhere, evidence,
  };
  assert.equal(publishedConnections([{ ...base, reading: { text: 'Two approaches to settlement work.', provenance: 'curated' } }], 'public').length, 1);
  assert.deepEqual(
    connectionProblems({ ...base, reading: { text: 'Both tagged Community Organizing.', provenance: 'generated' } }),
    ['reading is generated, not curated'],
  );
});

test('endpoints read the same way whichever claim is being made', () => {
  assert.deepEqual(endpoints(relationship() as Connection), ['august-pust-2010', 'leo-weidenthal-2010']);
  assert.deepEqual(endpoints(sameYear), ['august-pust-2010', 'leo-weidenthal-2010']);
  assert.equal(isDocumented(sameYear), false);
});

test('an unrecognised claim is refused rather than guessed at', () => {
  assert.deepEqual(connectionProblems({ ...(relationship() as object), claim: 'related' }), ['unrecognised claim']);
  assert.equal(publishedConnections([{ claim: 'related' }], 'public').length, 0);
});

test("a place association that will not say what the person did there is flagged", () => {
  // This is the shape of all 44 seeded person-place links: a person, a place
  // and nothing about the nature of the connection.
  const vague = {
    id: 'pa-1', person: 'leo-weidenthal-2010', place: 'place:cleveland-cultural-gardens',
    role: 'associated', review: approved, publication: everywhere, evidence,
  };
  assert.deepEqual(placeAssociationProblems(vague), ["role is 'associated', which does not say what the person did there"]);
  assert.equal(publishedPlaceAssociations([vague], 'public').length, 0);
  assert.equal(publishedPlaceAssociations([{ ...vague, role: 'founded' }], 'public').length, 1);
});
