import { createHash } from 'node:crypto';
import { projectStatus } from './working-tree.js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyAttractDecision, attractDecisions, publishedAttractText, readExhibitText } from '../packages/pipeline/src/build/exhibit-text.ts';

/**
 * Records a curator's decision on the attract screen's words, from the staff
 * review app or a one-row sheet (block, decision, contentVersion, headline,
 * tagline, decisionReference, note).
 *
 *   approve  the words exactly as the reviewer saw them; the sheet's
 *            contentVersion must match the words now
 *   reword   the reviewer's own words, approved as written
 *
 * Either way the words are approved for the display only: the website has no
 * attract screen. Nothing a visitor reads about a person changes, so nothing
 * is recorded in the reviewed differences.
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run text:apply -- --input=<sheet>
 *   npm run text:apply -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const textPath = resolve(root, 'data/cihof_exhibit_text.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  const status = publishedAttractText('kiosk');
  console.error('\nUsage:');
  console.error('  npm run text:apply -- --input=<sheet>');
  console.error('  npm run text:apply -- --input=… --apply --expect-hash=<sha256>');
  console.error('\nThe sheet has one row: block,decision,contentVersion,headline,tagline,decisionReference,note');
  console.error(`To approve the words as they are: block attract, decision approve, contentVersion ${status.contentVersion ?? '(none: no words written)'}.`);
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

const stored = readExhibitText();
const { decisions, errors, blank } = attractDecisions(csv, stored);
for (const decision of decisions) {
  console.log(`\n  Attract words ${decision.decision === 'approve' ? 'approved as they are' : 'rewritten and approved'}, under ${decision.decisionReference}:`);
  console.log(`    headline: ${decision.headline}`);
  console.log(`    tagline:  ${decision.tagline || '(none)'}`);
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
  console.log(`    npm run text:apply -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

const reviewedAt = new Date().toISOString();
const next = applyAttractDecision(stored, decisions[0], reviewedAt);
if (!args.noBackup) copyFileSync(textPath, `${textPath}.backup-${reviewedAt.replace(/[:.]/g, '-')}`);
writeFileSync(textPath, `${JSON.stringify(next, null, 2)}\n`);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `exhibit-text-decisions-${reviewedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv.endsWith('\n') ? csv : `${csv}\n`);

console.log('\n  Written to data/cihof_exhibit_text.json');
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
