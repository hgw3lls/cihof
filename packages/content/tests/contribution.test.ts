import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changeChain, contributionProblems, isSpecific, publishedContributions,
  type Contribution, type Timespan,
} from '../src/index.ts';

const approved = { status: 'approved', decisionReference: 'cur-2026-021', contentVersion: 'v3' } as const;
const everywhere = { publicWeb: true, kiosk: true };
const evidence = [{ id: 'ev-9', title: 'Plain Dealer, 4 May 1972, p.12', kind: 'secondary-source' as const }];
const subject = 'august-pust-2010' as never;

function contribution(over: Partial<Contribution> = {}): unknown {
  return {
    id: 'con-1', subject,
    action: { text: "Founded the city's One World Day programme", provenance: 'curated', origin: 'cur-2026-021' },
    occurred: { precision: 'year', start: '1972' } as Timespan,
    outcomes: [{ kind: 'event', name: 'One World Day', id: 'place:one-world-day-rockefeller-park' }],
    review: approved, publication: everywhere, evidence, ...over,
  };
}

test('a contribution that names nothing is an honorific, not an account', () => {
  // This is the whole point of the record. `honoredForSummary` is machine-made
  // for all 111 people and names nothing a visitor can follow; a contribution
  // that also names nothing is no better, whatever its review record says.
  assert.equal(isSpecific(contribution() as Contribution), true);
  assert.equal(isSpecific(contribution({ outcomes: [] }) as Contribution), false);
});

test('an action composed by a generator is not somebody’s account', () => {
  const generated = contribution({
    action: { text: 'Contributions to arts and culture and civic life.', provenance: 'generated', origin: 'honoredForSummary' },
  });
  assert.deepEqual(contributionProblems(generated), ["action is generated, so it is nobody's account"]);
  assert.equal(publishedContributions([generated], 'public').length, 0);
  assert.equal(publishedContributions([contribution()], 'public').length, 1);
});

test('an approved contribution with no evidence is refused', () => {
  assert.deepEqual(contributionProblems(contribution({ evidence: [] })), ['no usable evidence']);
});

test('an outcome with no name is reported with a count a reviewer can act on', () => {
  const problems = contributionProblems(contribution({
    outcomes: [{ kind: 'organization', name: 'Nationalities Services Center' }, { kind: 'program', name: '  ' }] as never,
  }));
  assert.deepEqual(problems, ['1 outcome(s) with no name']);
});

test('a missing date record is a problem; an explicit unknown is not', () => {
  const undatedRecord = { ...(contribution() as Record<string, unknown>) };
  delete undatedRecord['occurred'];
  assert.deepEqual(contributionProblems(undatedRecord), ['no date record, not even an explicit unknown']);
  assert.deepEqual(contributionProblems(contribution({ occurred: { precision: 'unknown' } })), []);
});

test('the chain is capped and says how much it left behind', () => {
  const many = [1970, 1974, 1978, 1982].map((year, index) => contribution({
    id: `con-${index}` as never, occurred: { precision: 'year', start: String(year) },
  }) as Contribution);
  const chain = changeChain(subject, many);
  assert.equal(chain.steps.length, 3, 'three well-explained steps, not a screen of lines');
  assert.equal(chain.remaining, 1, 'the rest is offered, not silently dropped');
  assert.deepEqual(chain.steps.map((step) => step.occurred.start), ['1970', '1974', '1978']);
});

test('an undated contribution sorts last but stays in the chain', () => {
  const mixed = [
    contribution({ id: 'con-undated' as never, occurred: { precision: 'unknown' } }),
    contribution({ id: 'con-1972' as never, occurred: { precision: 'year', start: '1972' } }),
  ] as Contribution[];
  const chain = changeChain(subject, mixed);
  assert.deepEqual(chain.steps.map((step) => step.id), ['con-1972', 'con-undated']);
  assert.equal(chain.remaining, 0);
});

test('a chain holds only its own subject', () => {
  const others = [
    contribution() as Contribution,
    contribution({ id: 'con-other' as never, subject: 'irene-morrow-2010' as never }) as Contribution,
  ];
  const chain = changeChain(subject, others);
  assert.deepEqual(chain.steps.map((step) => step.subject), [subject]);
});
