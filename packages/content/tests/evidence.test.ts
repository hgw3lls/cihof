import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSubstantiated, substantiationProblems, usableEvidence } from '../src/index.ts';

/**
 * Evidence read from records this codebase did not write.
 *
 * The staff review view exists to say why a claim is not publishable. Pointed
 * at an imported corpus — where `evidence` is a prose sentence rather than a
 * list — it used to throw instead, because a string has no `.filter`. These
 * cover the shapes an external file actually arrives in.
 */

const approved = { status: 'approved', decisionReference: 'cur-2026-050', contentVersion: 'v6' } as const;
const citation = { id: 'ev-1', title: 'Cleveland Press, 14 March 1972', kind: 'secondary-source' as const };

test('a citation needs both an id and a title to be followed', () => {
  assert.equal(usableEvidence([citation]).length, 1);
  assert.equal(usableEvidence([{ ...citation, title: '   ' }]).length, 0);
  assert.equal(usableEvidence([{ ...citation, id: '' }]).length, 0);
});

test('absent evidence is no evidence rather than a crash', () => {
  assert.deepEqual(usableEvidence(undefined), []);
});

test('evidence that is a sentence rather than a list carries no citation', () => {
  // The shape HOF_WORLD_VERIFIED_PERSON_RELATIONSHIPS.json ships: prose.
  const prose = 'Inducted by Dick Russ.' as unknown as undefined;
  assert.deepEqual(usableEvidence(prose), []);
});

test('a record whose evidence is prose is reported, not thrown', () => {
  const record = { review: approved, evidence: 'Inducted by Dick Russ.' } as never;
  const problems = substantiationProblems(record);
  assert.deepEqual(problems, ['evidence is not a list of citations']);
});

test('prose evidence is named as a shape problem, not as a missing source', () => {
  // The distinction matters to the person acting on it: somebody did cite a
  // source here, and telling them to go and find one would send them looking
  // for something they already have.
  const record = { review: approved, evidence: 'Inducted by Dick Russ.' } as never;
  assert.ok(!substantiationProblems(record).includes('no usable evidence'));
});

test('a record carrying no evidence at all is still told to find a source', () => {
  const record = { review: approved } as never;
  assert.deepEqual(substantiationProblems(record), ['no usable evidence']);
});

test('an unfollowable citation is not substantiation', () => {
  assert.equal(isSubstantiated({ review: approved, evidence: 'prose' as never }), false);
  assert.equal(isSubstantiated({ review: approved, evidence: [] }), false);
  assert.equal(isSubstantiated({ review: approved, evidence: [citation] }), true);
});

test('approval still needs a decision reference and a content version', () => {
  const bare = { review: { status: 'approved' as const }, evidence: [citation] };
  assert.deepEqual(substantiationProblems(bare), [
    'approved without a decision reference',
    'approved without a content version',
  ]);
});
