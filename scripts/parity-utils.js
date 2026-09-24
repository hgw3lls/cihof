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
