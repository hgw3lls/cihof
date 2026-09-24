import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { buildProposedTiesSheet } from '../src/build/review.ts';
import { readCorpusConnections } from '../src/sources/corpus.ts';
import type { TieDecision } from '../src/sources/ties.ts';

/**
 * Decisions on the ties the corpus proposes, as the build reads them.
 *
 * A decided relationship must go through the same gate as every other claim,
 * context must stay context, and a rejection must stop the preview proposing
 * the tie again — without any of it leaking to an audience nobody named.
 */

const people = buildPeople();
const corpus = readCorpusConnections();
const spouse = corpus.find((row) => row.sourceType === 'family_spouse' && row.from === 'dr-jaya-shah-2012')!;
const session = corpus.find((row) => row.sourceType === 'joint_oral_history_participant')!;

const decided = (row: typeof spouse, over: Partial<TieDecision>): TieDecision => ({
  tieId: `preview:${row.id}`,
  corpusIds: [row.id],
  personA: row.from,
  personB: row.to,
  sourceType: row.sourceType,
  decision: 'relationship',
  evidence: [row.evidence],
  sourceUrls: row.sourceUrl ? [row.sourceUrl] : [],
  verificationLayer: row.verificationLayer,
  decisionReference: 'ties-review-fixture',
  contentVersion: 'tie-fixture',
  reviewedAt: '2026-09-25T00:00:00.000Z',
  publication: { publicWeb: false, kiosk: true },
  ...over,
});

const marriage = decided(spouse, {
  kind: 'family-of', label: 'married to Ramesh Shah', inverseLabel: 'married to Dr. Jaya Shah',
});
const together = decided(session, { decision: 'context', label: 'Both recorded in the same 2017 oral-history session' });

// The relationships the crosswalk gives today, without any decided tie.
const inductionOnly = () => buildRuntimeBundle(people, 'kiosk', { tieDecisions: [] }).relationships.length;

test('a decided relationship is published to the audience it names, and no other', () => {
  const kiosk = buildRuntimeBundle(people, 'kiosk', { tieDecisions: [marriage] });
  const tie = kiosk.relationships.find((relationship) => (relationship.id as string) === `tie:${spouse.id}`);
  assert.ok(tie, 'the kiosk shows it');
  assert.equal(tie.kind, 'family-of');
  assert.equal(tie.evidence[0]?.excerpt, spouse.evidence, 'the corpus passage travels with it as its citation');
  assert.equal(kiosk.relationshipReport.fromTies, 1);
  assert.equal(kiosk.relationships.length, inductionOnly() + 1, 'counted with the induction relationships');

  const web = buildRuntimeBundle(people, 'public', { tieDecisions: [marriage] });
  assert.equal(web.relationships.some((relationship) => (relationship.id as string).startsWith('tie:')), false);
});

test('a decided relationship with a gap in it is not published', () => {
  const unworded = decided(spouse, { kind: 'mentored', label: 'mentored Ramesh Shah' });
  const bundle = buildRuntimeBundle(people, 'kiosk', { tieDecisions: [unworded] });
  assert.equal(bundle.relationshipReport.fromTies, 0, 'a directional kind with no inverse wording is refused');
});

test('context stays context: drawn apart, never counted as a relationship', () => {
  const kiosk = buildRuntimeBundle(people, 'kiosk', { tieDecisions: [together] });
  assert.equal(kiosk.contexts.length, 1);
  assert.equal(kiosk.contexts[0]!.basis, 'appeared-together');
  assert.equal(kiosk.relationships.length, inductionOnly());
  assert.equal(buildRuntimeBundle(people, 'public', { tieDecisions: [together] }).contexts.length, 0);
});

test('a decided tie, whichever way it went, is no longer proposed in preview', () => {
  const rejected = decided(spouse, { decision: 'reject' });
  const before = buildRuntimeBundle(people, 'kiosk', { preview: true });
  const after = buildRuntimeBundle(people, 'kiosk', { preview: true, tieDecisions: [rejected, together] });
  assert.equal(after.candidates.length, before.candidates.length - 2);
  assert.equal(after.contexts.length, 1);
  assert.equal(after.relationships.length, inductionOnly(), 'a rejection publishes nothing');
});

test('the sheet shows what has been decided', () => {
  const rows = buildProposedTiesSheet(corpus, people, [marriage, decided(session, { decision: 'reject' })]);
  assert.equal(rows.find((row) => row.corpusIds.includes(spouse.id))?.currentStatus, 'relationship');
  assert.equal(rows.find((row) => row.corpusIds.includes(session.id))?.currentStatus, 'reject');
  assert.equal(rows.filter((row) => row.currentStatus === 'unreviewed').length, 27);
});
