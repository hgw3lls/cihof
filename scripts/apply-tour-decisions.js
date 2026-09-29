import { createHash } from 'node:crypto';
import { projectStatus } from './working-tree.js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyTourDecisions, readTours, tourDecisions, tourVersion } from '../packages/pipeline/src/build/tours.ts';

/**
 * Records a curator's decisions on the curated tours, from the staff review
 * app or a sheet (tourId, decision, contentVersion, decisionReference, note).
 *
 *   approve   the tour exactly as the reviewer saw it: its words and the
 *             rules that choose its people. The sheet's contentVersion must
 *             match the tour now, and its targets say who may see it:
 *             kiosk, or kiosk,public-web. The display and the website are
 *             decided apart, as for all visitor content.
 *   withdraw  takes an approved tour off the display and the website, back
 *             to a draft.
 *
 * Nothing
 * a visitor reads about a person changes, so nothing is recorded in the
 * reviewed differences.
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run tours:apply -- --input=<sheet>
 *   npm run tours:apply -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const toursPath = resolve(root, 'data/cihof_story_lenses.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run tours:apply -- --input=<sheet>');
  console.error('  npm run tours:apply -- --input=… --apply --expect-hash=<sha256>');
  console.error('\nThe sheet\'s columns: tourId,decision,contentVersion,targets,decisionReference,note');
  console.error('To approve a tour as it is now, give the version shown here:');
  for (const lens of readTours().lenses ?? []) {
    if (typeof lens.id === 'string') console.error(`  ${lens.id}  ${tourVersion(lens)}  (${lens.reviewStatus ?? 'no status'})`);
  }
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

const stored = readTours();
const labels = new Map((stored.lenses ?? []).map((lens) => [lens.id, lens.label]));
const { decisions, errors, blank } = tourDecisions(csv, stored);
for (const decision of decisions) {
  const where = [decision.targets.kiosk && 'the display', decision.targets.publicWeb && 'the public website'].filter(Boolean).join(' and ');
  console.log(decision.decision === 'approve'
    ? `  Approve the tour "${labels.get(decision.tourId) ?? decision.tourId}" for ${where}, under ${decision.decisionReference}`
    : `  Withdraw the tour "${labels.get(decision.tourId) ?? decision.tourId}" from the display and the website, under ${decision.decisionReference}`);
}
if (blank > 0) console.log(`  ${blank} row(s) left as they are.`);
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
  console.log(`    npm run tours:apply -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

const reviewedAt = new Date().toISOString();
const next = applyTourDecisions(stored, decisions, reviewedAt);
if (!args.noBackup) copyFileSync(toursPath, `${toursPath}.backup-${reviewedAt.replace(/[:.]/g, '-')}`);
writeFileSync(toursPath, `${JSON.stringify(next, null, 2)}\n`);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `tour-decisions-${reviewedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv.endsWith('\n') ? csv : `${csv}\n`);

console.log('\n  Written to data/cihof_story_lenses.json');
console.log(`  The signed sheet is archived as ${archived.replace(`${root}/`, '')}`);
console.log('  Next: npm test, review the diff, commit.\n');

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
