import { createHash } from 'node:crypto';
import { projectStatus } from './working-tree.js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyProfileEdits, profileEditColumns, profileEditDecisions } from '../packages/pipeline/src/build/profile-edits.ts';
import { readPortraitChecksums } from '../packages/pipeline/src/build/profiles.ts';
import { csvCell, parseRows } from '../packages/pipeline/src/build/review.ts';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import { refreshGenerated } from './refresh-generated.js';
import { changesWhatVisitorsSee, printVisibleChanges, visibleChangesByReference, writeRecordedDifferences } from './parity-utils.js';

/**
 * Applies profile edits from the staff review app's profile editor: the name
 * and how it is alphabetised, the communities, honours and countries, the
 * "Honoured for" and context lines, and the portrait's description and focal
 * point (packages/pipeline/src/build/profile-edits.ts says what may change and
 * why the rest may not).
 *
 * Each row names the version of the profile the editing began from, and is
 * refused if the profile has changed since. An edit changes what visitors see,
 * so every difference is recorded in the reviewed differences under the
 * decision, and the crosswalk and contribution worksheet are refreshed. The
 * profile's approval lapses, as for any change, until somebody approves the
 * profile as edited (profiles:apply).
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run profiles:edit -- --input=<sheet>
 *   npm run profiles:edit -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const curatedPath = resolve(root, 'data/cihof_curated_metadata.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run profiles:edit -- --input=<sheet>');
  console.error('  npm run profiles:edit -- --input=… --apply --expect-hash=<sha256>');
  console.error(`\nThe sheet's columns: ${profileEditColumns.join(',')} (lists separated by semicolons).`);
  console.error('The staff review app writes it from the profile editor.');
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

const stored = JSON.parse(readFileSync(curatedPath, 'utf8'));
const { decisions, errors, blank } = profileEditDecisions(csv, { people: buildPeople(), curated: stored, checksums: readPortraitChecksums() });
console.log(`\n  ${decisions.length} profile edit(s), ${blank} row(s) left as they are.`);
for (const decision of decisions) {
  console.log(`    ${decision.name} (${decision.id}), under ${decision.decisionReference}`);
}
if (errors.length > 0) {
  console.error(`\n  ${errors.length} problem(s):`);
  for (const message of errors) console.error(`    ${message}`);
  console.error('\nNothing was written. Fix the sheet and run again.');
  process.exit(1);
}
if (decisions.length === 0) {
  console.log('  Nothing to do.\n');
  process.exit(0);
}

const appliedAt = new Date().toISOString();
const curated = applyProfileEdits(stored, decisions, appliedAt);
const groups = new Map();
for (const decision of decisions) {
  groups.set(decision.decisionReference, [...(groups.get(decision.decisionReference) ?? []), decision.id]);
}
const visible = visibleChangesByReference({ sources: { curated }, groups });
printVisibleChanges(visible);

if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run profiles:edit -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

if (!args.noBackup) copyFileSync(curatedPath, `${curatedPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
writeFileSync(curatedPath, `${JSON.stringify(curated, null, 2)}\n`);
if (changesWhatVisitorsSee(visible)) writeRecordedDifferences(visible);

// What was signed: the decided rows, as the sheet had them.
mkdirSync(archiveDir, { recursive: true });
const decided = new Set(decisions.map((decision) => decision.id));
const archived = resolve(archiveDir, `profile-edits-${appliedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, keepRows(csv, decided));

console.log('\n  Written to data/cihof_curated_metadata.json');
refreshGenerated(root);
console.log('  Recorded what visitors see differently in data/cihof_reviewed_differences.json');
console.log(`  Decided rows archived to ${archived.replace(`${root}/`, '')}`);
console.log('  The edited profiles need approving again (profiles:apply).');
console.log('  Next: npm test, review the diff, commit.\n');

function keepRows(text, ids) {
  const rows = parseRows(text.replace(/^﻿/, ''));
  const header = rows[0] ?? [];
  const idColumn = header.indexOf('id');
  const kept = [header, ...rows.slice(1).filter((cells) => ids.has((cells[idColumn] ?? '').trim()))];
  return `${kept.map((cells) => cells.map(csvCell).join(',')).join('\n')}\n`;
}

function requireCleanTree() {
  let status;
  try {
    status = projectStatus(root);
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
