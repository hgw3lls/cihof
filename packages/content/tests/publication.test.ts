import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allowsTarget, attributed, displayablePortrait, facetable, inducteeIdFromEntityId,
  isApproved, isAttributable, isEligible, isInducteeId, isPublished, personEntityId,
  type Portrait, type Review, type TagSet,
} from '../src/index.ts';

const approved: Review = { status: 'approved', decisionReference: 'decision-001', contentVersion: 'v1' };

test('identity is by canonical id, never by name', () => {
  assert.equal(isInducteeId('alex-machaskee-2010'), true);
  assert.equal(isInducteeId('Alex Machaskee'), false);
  assert.equal(isInducteeId('Arnie de la Porte – 2016'), false);
  assert.equal(isInducteeId(''), false);

  const id = 'alex-machaskee-2010' as never;
  assert.equal(personEntityId(id), 'person:alex-machaskee-2010');
  assert.equal(inducteeIdFromEntityId('person:alex-machaskee-2010'), 'alex-machaskee-2010');
  assert.equal(inducteeIdFromEntityId('alex-machaskee-2010'), null, 'a bare id is not an entity id');
  assert.equal(inducteeIdFromEntityId('person:'), null);
});

test('an approval must name its decision and the version it covered', () => {
  assert.equal(isApproved(approved), true);
  assert.equal(isApproved({ status: 'approved' }), false, 'bare approved is not traceable');
  assert.equal(isApproved({ status: 'approved', decisionReference: 'd' }), false, 'no content version');
  assert.equal(isApproved({ status: 'approved', contentVersion: 'v1' }), false, 'no decision reference');
  assert.equal(isApproved({ status: 'approved', decisionReference: '  ', contentVersion: 'v1' }), false);
  assert.equal(isApproved({ status: 'needs-review', decisionReference: 'd', contentVersion: 'v1' }), false);
  assert.equal(isApproved(undefined), false);
});

test('approval is not permission: each target is decided separately', () => {
  const kioskOnly = { review: approved, publication: { publicWeb: false, kiosk: true } };
  assert.equal(isPublished(kioskOnly, 'kiosk'), true);
  assert.equal(isPublished(kioskOnly, 'public'), false, 'kiosk approval must not imply public');

  const staffOnly = { review: approved, publication: { publicWeb: true, kiosk: true, staffOnly: true } };
  assert.equal(isPublished(staffOnly, 'public'), false, 'staffOnly overrides every target');
  assert.equal(isPublished(staffOnly, 'kiosk'), false);

  const unreviewed = { review: { status: 'needs-review' } as Review, publication: { publicWeb: true, kiosk: true } };
  assert.equal(isPublished(unreviewed, 'public'), false, 'a target flag alone publishes nothing');

  assert.equal(allowsTarget(undefined, 'public'), false);
  assert.equal(isPublished(undefined, 'public'), false);
});

test('prose carries its provenance so generated text cannot pose as a claim', () => {
  const bio = attributed('  Alex Machaskee is the retired Publisher.  ', 'source');
  assert.equal(bio?.text, 'Alex Machaskee is the retired Publisher.', 'trimmed');
  assert.equal(isAttributable(bio), true);

  const template = attributed('Contributions to arts and culture within Serbian heritage communities.', 'generated', 'honoredForSummary');
  assert.equal(isAttributable(template), false, 'a generated line is nobody’s claim');
  assert.equal(template?.origin, 'honoredForSummary');

  assert.equal(attributed('   ', 'source'), null, 'empty prose is absent, not blank');
  assert.equal(isAttributable(null), false);
});

test('a facet only offers tags a reviewer stands behind', () => {
  const curated: TagSet = { values: ['Serbian'], provenance: 'curated' };
  const inferred: TagSet = { values: ['Serbian'], provenance: 'inferred' };
  assert.deepEqual(facetable(curated), ['Serbian']);
  assert.deepEqual(facetable(inferred), [], 'an inferred tag must not drive a facet');
  assert.deepEqual(facetable({ values: ['x'], provenance: 'none' }), []);
});

test('base eligibility ignores legacy approvalStatus', () => {
  assert.equal(isEligible({ id: 'alex-machaskee-2010', name: 'Alex Machaskee' }), true);
  assert.equal(isEligible({ id: 'x', name: 'X', approvalStatus: 'draft' } as never), true,
    'all 111 records are draft; treating that as a decision would empty the collection');
  assert.equal(isEligible({ id: '', name: 'X' }), false);
  assert.equal(isEligible({ id: 'x', name: '   ' }), false);
  assert.equal(isEligible({}), false);
});

test('a portrait reaches a visitor only with approved rights', () => {
  const ok: Portrait = { src: '/p.png', alt: 'Portrait', rights: 'approved' };
  assert.equal(displayablePortrait(ok), ok);
  assert.equal(displayablePortrait({ ...ok, rights: 'pending' }), null);
  assert.equal(displayablePortrait({ ...ok, rights: 'unknown' }), null);
  assert.equal(displayablePortrait(null), null);
});
