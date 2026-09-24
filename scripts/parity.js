import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import { collectDifferences, differenceSubject, readReviewedDifferences, reconcile } from '../packages/pipeline/src/build/parity.ts';
import { changesWhatVisitorsSee, printVisibleChanges, visibleChanges, writeRecordedDifferences } from './parity-utils.js';

/**
 * The record of what visitors see differently from the published record, and
 * why. See packages/pipeline/src/build/parity.ts.
 *
 *   npm run parity:report
 *       Lists differences nobody recorded, and recorded ones that no longer
 *       occur. Exits non-zero if there are any: that is what npm test checks.
 *
 *   npm run parity:record -- --ids=<id>,<id> --decision-reference=<ref> [--note="…"]
 *   npm run parity:record -- … --apply
 *       Records the named people's differences under a decision, and drops
 *       their stale entries. For a change made some way other than an apply
 *       tool. Previews unless --apply is given. --all names everybody with an
 *       unrecorded difference, and is for when each one has been checked.
 *
 * The apply tools do this themselves for the people their sheet changed.
 */

const args = parseArgs(process.argv.slice(2));
const command = process.argv[2];

if (command === 'report') report();
else if (command === 'record') record();
else {
  console.error('Usage: node scripts/parity.js report | record --ids=… --decision-reference=… [--apply]');
  process.exit(1);
}

function report() {
  const differences = collectDifferences(buildPeople());
  const ledger = readReviewedDifferences();
  const { unrecorded, stale } = reconcile(differences, ledger);
  console.log(`\n  ${differences.length} difference(s) from the published record; ${ledger.differences.length} recorded.`);
  if (unrecorded.length > 0) {
    console.log(`\n  Not recorded (${unrecorded.length}):`);
    for (const line of unrecorded) console.log(`    ${line}`);
  }
  if (stale.length > 0) {
    console.log(`\n  Recorded but no longer different (${stale.length}):`);
    for (const entry of stale) console.log(`    ${entry.difference}`);
  }
  if (unrecorded.length === 0 && stale.length === 0) {
    console.log('  Everything visitors see differently is recorded with its decision.\n');
    return;
  }
  console.log('\n  Find the decision behind each, then: npm run parity:record -- --ids=… --decision-reference=…');
  console.log('  A difference no decision made is a regression: fix it instead.\n');
  process.exit(1);
}

function record() {
  const reference = typeof args.decisionReference === 'string' ? args.decisionReference.trim() : '';
  if (!reference) fail('--decision-reference is required. Never defaulted, never generated.');

  let ids;
  if (args.all) {
    const { unrecorded, stale } = reconcile(collectDifferences(buildPeople()), readReviewedDifferences());
    ids = new Set([...unrecorded, ...stale.map((entry) => entry.difference)].map(differenceSubject));
  } else if (typeof args.ids === 'string' && args.ids.trim()) {
    ids = new Set(args.ids.split(',').map((id) => id.trim()).filter(Boolean));
  } else {
    fail('Name the people with --ids=<id>,<id>, or --all.');
  }

  const outcome = visibleChanges({ ids, decisionReference: reference, note: typeof args.note === 'string' ? args.note : '' });
  printVisibleChanges(outcome);
  if (!changesWhatVisitorsSee(outcome)) {
    console.log('\n  Nothing to record.\n');
    return;
  }
  if (!args.apply) {
    console.log('\n  Preview only. Nothing was written. Add --apply to record these.\n');
    return;
  }
  writeRecordedDifferences(outcome);
  console.log(`\n  Recorded under ${reference} in data/cihof_reviewed_differences.json.\n`);
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (const argument of argv) {
    if (!argument.startsWith('--')) continue;
    const [rawKey, ...rest] = argument.slice(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[key] = rest.length > 0 ? rest.join('=') : true;
  }
  return parsed;
}
