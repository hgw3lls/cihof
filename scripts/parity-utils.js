import { writeFileSync } from 'node:fs';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import {
  collectDifferences, ledgerJson, readReviewedDifferences, recordDecision, reviewedDifferencesPath,
} from '../packages/pipeline/src/build/parity.ts';

/**
 * What a change does to the people visitors see, for the apply tools.
 *
 * Each tool passes the sources it is about to write (only the ones it changes)
 * and the ids its sheet touched. The answer is the visible differences from the
 * frozen published record that the change would record under its decision
 * reference, and those it would retire. `npm test` fails on any visible
 * difference nobody recorded, so a tool that writes must also record.
 *
 * @param {{ sources?: import('../packages/pipeline/src/build/people.ts').PeopleSources, ids: Iterable<string>, decisionReference?: string, note?: string }} change
 */
export function visibleChanges({ sources = {}, ids, decisionReference = '', note = '' }) {
  const differences = collectDifferences(buildPeople(sources));
  return recordDecision(readReviewedDifferences(), differences, {
    ids: new Set(ids),
    decisionReference,
    ...(note ? { note } : {}),
    recordedAt: new Date().toISOString(),
  });
}

/**
 * The same for a sheet whose rows rest on different decisions: each group of
 * people is recorded under its own reference.
 *
 * @param {{ sources?: import('../packages/pipeline/src/build/people.ts').PeopleSources, groups: Map<string, Iterable<string>> }} change
 */
export function visibleChangesByReference({ sources = {}, groups }) {
  const differences = collectDifferences(buildPeople(sources));
  const recordedAt = new Date().toISOString();
  let ledger = readReviewedDifferences();
  const added = [];
  const removed = [];
  const touched = new Set();
  for (const [decisionReference, ids] of groups) {
    const idSet = new Set(ids);
    for (const id of idSet) touched.add(id);
    const outcome = recordDecision(ledger, differences, { ids: idSet, decisionReference, recordedAt });
    ledger = outcome.ledger;
    added.push(...outcome.added);
    removed.push(...outcome.removed);
  }
  const elsewhere = recordDecision(ledger, differences, { ids: touched, decisionReference: '', recordedAt }).elsewhere;
  return { ledger, added, removed, elsewhere };
}

/** True when the change alters something a visitor sees. */
export function changesWhatVisitorsSee(outcome) {
  return outcome.added.length > 0 || outcome.removed.length > 0;
}

export function printVisibleChanges(outcome, { limit = 20 } = {}) {
  if (!changesWhatVisitorsSee(outcome)) {
    console.log('\n  Visitors see no difference from the published record for these people.');
  } else {
    console.log(`\n  What visitors will see differently (${outcome.added.length} to record, ${outcome.removed.length} to retire):`);
    for (const line of outcome.added.slice(0, limit)) console.log(`    + ${line}`);
    if (outcome.added.length > limit) console.log(`    … and ${outcome.added.length - limit} more`);
    for (const line of outcome.removed.slice(0, limit)) console.log(`    - ${line}`);
  }
  if (outcome.elsewhere.length > 0) {
    console.warn(`\n  Note: ${outcome.elsewhere.length} difference(s) about other people are not recorded, and this change does not record them:`);
    for (const line of outcome.elsewhere.slice(0, 5)) console.warn(`    ? ${line}`);
    console.warn('  They were there before this change. npm test will fail on them until a decision is recorded (npm run parity:record) or they are fixed.');
  }
}

export function writeRecordedDifferences(outcome) {
  writeFileSync(reviewedDifferencesPath(), ledgerJson(outcome.ledger));
}

export { reviewedDifferencesPath };
