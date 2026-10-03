import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyPlaceEdits, placeEditColumns, placeEditDecisions } from '../packages/pipeline/src/build/place-edits.ts';
import { projectStatus } from './working-tree.js';

/**
 * Applies place edits and new places from the staff portal: a place's name,
 * neighbourhood, kind and history, people tied to it who were not, and
 * whether it is approved as edited (packages/pipeline/src/build/place-edits.ts
 * says what a row must say). The roles and approvals of ties the research
 * found stay with places:apply.
 *
 *   npm run places:edit -- --input=<sheet>
 *   npm run places:edit -- --input=… --apply --expect-hash=<sha256>
 *
 * The same gates as the other sheets: a preview by default, --expect-hash on
 * --apply, and a clean working tree.
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const placesPath = resolve(root, 'data/cihof_places.json');
const tiesPath = resolve(root, 'data/cihof_place_associations.json');
const curatedPath = resolve(root, 'data/cihof_curated_metadata.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run places:edit -- --input=<sheet>');
  console.error('  npm run places:edit -- --input=… --apply --expect-hash=<sha256>');
  console.error(`\nThe sheet's columns: ${placeEditColumns.join(',')}`);
  console.error('people is "person-id:role; person-id:role"; audience is kiosk, kiosk-and-web or nobody.');
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

const places = JSON.parse(readFileSync(placesPath, 'utf8'));
const associations = JSON.parse(readFileSync(tiesPath, 'utf8'));
const personIds = new Set(Object.keys(JSON.parse(readFileSync(curatedPath, 'utf8')).inductees ?? {}));
const removedPath = resolve(root, 'data/cihof_places_removed.json');
const removed = existsSync(removedPath) ? JSON.parse(readFileSync(removedPath, 'utf8')).removed ?? [] : [];
const { decisions, errors, blank } = placeEditDecisions(csv, { places, associations, personIds, removed });
console.log(`\n  ${decisions.length} place change(s), ${blank} row(s) left as they are.`);
for (const decision of decisions) {
  const where = decision.audience === 'nobody' ? 'left for somebody else to approve'
    : `approved for ${decision.audience === 'kiosk-and-web' ? 'the display and the public website' : 'the display'}`;
  console.log(`    ${decision.decision === 'create' ? 'A new place' : 'Edit'}: ${decision.name} (${decision.placeId}), ${where}, under ${decision.decisionReference}`);
  for (const person of decision.people) console.log(`      + ${person.personId}, ${person.role}`);
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
if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run places:edit -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

const appliedAt = new Date().toISOString();
const next = applyPlaceEdits(places, associations, decisions, appliedAt);
if (!args.noBackup) {
  copyFileSync(placesPath, `${placesPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
  copyFileSync(tiesPath, `${tiesPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
}
writeFileSync(placesPath, `${JSON.stringify(next.places, null, 2)}\n`);
writeFileSync(tiesPath, `${JSON.stringify(next.associations, null, 2)}\n`);
mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `place-edits-${appliedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv);

console.log('\n  Written to data/cihof_places.json and data/cihof_place_associations.json');
console.log(`  The sheet is archived as ${archived.replace(`${root}/`, '')}`);
console.log('  Next: npm run review:places, npm test, review the diff, commit.\n');

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
