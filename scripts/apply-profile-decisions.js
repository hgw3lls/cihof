import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import { applyProfileDecisions, buildProfileSheet, profileDecisions } from '../packages/pipeline/src/build/profiles.ts';
import { csvCell, parseRows } from '../packages/pipeline/src/build/review.ts';

/**
 * Records profile approvals, and requests for changes, from the profile sheet
 * (npm run review:profiles) or the staff review app.
 *
 * An approval covers the profile exactly as the reviewer saw it: the sheet's
 * contentVersion must match the profile now, or the row is refused. It never
 * changes what a visitor sees, so it records nothing in the reviewed
 * differences.
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run profiles:apply -- --input=reports/profiles-sheet.csv
 *   npm run profiles:apply -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const curatedPath = resolve(root, 'data/cihof_curated_metadata.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run profiles:apply -- --input=reports/profiles-sheet.csv');
  console.error('  npm run profiles:apply -- --input=… --apply --expect-hash=<sha256>');
  console.error('\nMake the sheet with npm run review:profiles. A preview is the default.');
  process.exit(1);
}

const csv = readFileSync(inputPath, 'utf8');
const hash = createHash('sha256').update(csv).digest('hex');
if (args.apply) {
  if (args.expectHash !== hash) {
    console.error('\nThis sheet has not been previewed, or it changed since it was.');
    console.error(`  its hash now: ${hash}`);
    if (args.expectHash) console.error(`  you passed:   ${args.expectHash}`);
    console.error('\nRun the preview first, then pass the hash it prints.');
    process.exit(1);
  }
  requireCleanTree();
}

const rows = buildProfileSheet(buildPeople());
const { decisions, errors, blank } = profileDecisions(csv, rows);
const count = (status) => decisions.filter((decision) => decision.status === status).length;
console.log(`\n  ${count('approved')} approval(s), ${count('changes-requested')} request(s) for changes, ${blank} row(s) left as they are.`);
for (const decision of decisions) {
  console.log(`    ${decision.name} (${decision.id}): ${decision.status === 'approved' ? 'approved' : `changes requested: ${decision.note}`}, under ${decision.decisionReference}`);
}
if (errors.length > 0) {
  console.error(`\n  ${errors.length} row(s) refused:`);
  for (const message of errors) console.error(`    ${message}`);
  console.error('\nNothing was written. Fix the sheet and run again.');
  process.exit(1);
}
if (decisions.length === 0) {
  console.log('  Nothing to do.\n');
  process.exit(0);
}
if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run profiles:apply -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

const reviewedAt = new Date().toISOString();
const curated = applyProfileDecisions(JSON.parse(readFileSync(curatedPath, 'utf8')), decisions, reviewedAt);
if (!args.noBackup) copyFileSync(curatedPath, `${curatedPath}.backup-${reviewedAt.replace(/[:.]/g, '-')}`);
writeFileSync(curatedPath, `${JSON.stringify(curated, null, 2)}\n`);

mkdirSync(archiveDir, { recursive: true });
const decided = new Set(decisions.map((decision) => decision.id));
const parsed = parseRows(csv.replace(/^﻿/, ''));
const idColumn = (parsed[0] ?? []).indexOf('id');
const signed = [parsed[0] ?? [], ...parsed.slice(1).filter((cells) => decided.has((cells[idColumn] ?? '').trim()))];
const archived = resolve(archiveDir, `profile-decisions-${reviewedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, `${signed.map((cells) => cells.map(csvCell).join(',')).join('\n')}\n`);

console.log('\n  Written to data/cihof_curated_metadata.json');
console.log(`  Decided rows archived to ${archived.replace(`${root}/`, '')}`);
console.log('  Next: npm test, review the diff, commit.\n');

function requireCleanTree() {
  let status;
  try {
    status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  } catch {
    return;
  }
  const dirty = status.split('\n').filter((line) => line.trim().length > 0);
  if (dirty.length === 0) return;
  console.error('\nThe working tree has uncommitted changes:');
  for (const line of dirty.slice(0, 10)) console.error(`  ${line}`);
  console.error('\nCommit, stash or discard them first, so this decision arrives as its own diff.');
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
