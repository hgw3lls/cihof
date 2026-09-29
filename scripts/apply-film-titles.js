import { createHash } from 'node:crypto';
import { projectStatus } from './working-tree.js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyFilmTitleDecisions, filmTitleDecisions, filmTitleLimit, readFilmTitles } from '../packages/pipeline/src/build/film-titles.ts';
import { readVideoHoldings } from '../packages/pipeline/src/sources/media.ts';

/**
 * Records what a curator decided each film is called, from the staff review
 * app or a sheet (filmId, decision, title, decisionReference, note).
 *
 *   approve   the title in the sheet, as written: the reviewer's own words,
 *             or the film's YouTube title (collected, unreviewed, in
 *             data/external-research/youtube-film-titles.json) kept as it is
 *   clear     takes the film's title away; it is described by its length again
 *
 * A title is approved for the display only, where films are shown. Nothing a
 * visitor reads about a person changes, so nothing is recorded in the
 * reviewed differences.
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run films:titles:apply -- --input=<sheet>
 *   npm run films:titles:apply -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const titlesPath = resolve(root, 'data/cihof_film_titles.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run films:titles:apply -- --input=<sheet>');
  console.error('  npm run films:titles:apply -- --input=… --apply --expect-hash=<sha256>');
  console.error(`\nThe sheet: filmId,decision,title,decisionReference,note (a title of at most ${filmTitleLimit} characters).`);
  console.error('Each film\'s YouTube title, unreviewed: data/external-research/youtube-film-titles.json (npm run source:film-titles).');
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

const filmIds = new Set([...readVideoHoldings().values()].flat().map((video) => video?.youtubeVideoId).filter((id) => typeof id === 'string' && id));
const { decisions, errors, blank } = filmTitleDecisions(csv, filmIds);
console.log('\nFilm titles');
for (const decision of decisions) {
  console.log(decision.decision === 'approve'
    ? `  ${decision.filmId}: "${decision.title}", for the display, under ${decision.decisionReference}`
    : `  ${decision.filmId}: title cleared, under ${decision.decisionReference}`);
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
  console.log(`    npm run films:titles:apply -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

const reviewedAt = new Date().toISOString();
const next = applyFilmTitleDecisions(readFilmTitles(), decisions, reviewedAt);
if (!args.noBackup && existsSync(titlesPath)) copyFileSync(titlesPath, `${titlesPath}.backup-${reviewedAt.replace(/[:.]/g, '-')}`);
writeFileSync(titlesPath, `${JSON.stringify(next, null, 2)}\n`);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `film-title-decisions-${reviewedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv.endsWith('\n') ? csv : `${csv}\n`);

console.log('\n  Written to data/cihof_film_titles.json');
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
