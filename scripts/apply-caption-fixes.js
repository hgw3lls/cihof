import { createHash } from 'node:crypto';
import { projectStatus } from './working-tree.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { captionFixDecisions, filmFiles, fixCaptions, fixText } from '../packages/pipeline/src/build/caption-fixes.ts';
import { readVideoHoldings } from '../packages/pipeline/src/sources/media.ts';

/**
 * Corrects a film's captions and transcript, as a reviewer decided:
 *
 *   filmId,fix,find,replaceWith,decisionReference,note
 *
 *   music   music heard as "heat": replaceWith "[music]", or empty to remove it
 *   blank   removes the transcriber's [BLANK_AUDIO] mark
 *   phrase  replaces `find` with `replaceWith`, exactly as written
 *
 * Each fix is applied to the captions and the transcript of every copy of the
 * film, and recorded in data/cihof_caption_fixes.json with its decision.
 * The films were approved as a whole (21 September); these are corrections to
 * words within them, each on its own decision, and nothing a visitor reads
 * about a person changes, so nothing is recorded in the reviewed differences.
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run films:captions:apply -- --input=<sheet>
 *   npm run films:captions:apply -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const logPath = resolve(root, 'data/cihof_caption_fixes.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run films:captions:apply -- --input=<sheet>');
  console.error('  npm run films:captions:apply -- --input=… --apply --expect-hash=<sha256>');
  console.error('\nThe sheet: filmId,fix,find,replaceWith,decisionReference,note');
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

const films = filmFiles(readVideoHoldings());
const { decisions, errors } = captionFixDecisions(csv, films);

// Applied in order, in memory, so a later fix sees an earlier one's result.
const contents = new Map();
const read = (path) => contents.get(path) ?? readFileSync(resolve(root, path), 'utf8');
const applied = [];
for (const decision of decisions) {
  const film = films.get(decision.filmId);
  let transcriptCount = 0;
  let captionCount = 0;
  for (const path of film.transcripts) {
    const result = fixText(read(path), decision);
    contents.set(path, result.text);
    transcriptCount = Math.max(transcriptCount, result.count);
  }
  for (const path of film.captions) {
    const result = fixCaptions(read(path), decision);
    contents.set(path, result.text);
    captionCount = Math.max(captionCount, result.count);
  }
  applied.push({ decision, film, transcriptCount, captionCount });
}

console.log(`\nFilm caption and transcript fixes — ${relative(root, inputPath)}`);
for (const { decision, film, transcriptCount, captionCount } of applied) {
  const what = decision.fix === 'music'
    ? `music heard as "heat" ${decision.replaceWith ? 'marked [music]' : 'removed'}`
    : decision.fix === 'blank' ? '[BLANK_AUDIO] removed' : `"${decision.find}" corrected to "${decision.replaceWith}"`;
  console.log(`  ${decision.filmId} (${film.people.join(', ')}): ${what}; ${transcriptCount} place(s) in the transcript, ${captionCount} caption line(s), ${film.transcripts.length} cop${film.transcripts.length === 1 ? 'y' : 'ies'}`);
}
if (errors.length > 0) {
  console.error(`\n  ${errors.length} row(s) refused:`);
  for (const message of errors) console.error(`    ${message}`);
  console.error('\nNothing was written. Fix the sheet and run again.');
  process.exit(1);
}
if (applied.length === 0) {
  console.log('  Nothing to do.\n');
  process.exit(0);
}
if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run films:captions:apply -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

for (const [path, text] of contents) writeFileSync(resolve(root, path), text);

const reviewedAt = new Date().toISOString();
const log = existsSync(logPath)
  ? JSON.parse(readFileSync(logPath, 'utf8'))
  : { schemaVersion: 1, note: 'Corrections to film captions and transcripts, each with the decision that made it. Written only by npm run films:captions:apply.', fixes: [] };
for (const { decision, film, transcriptCount, captionCount } of applied) {
  log.fixes.push({
    filmId: decision.filmId,
    people: film.people,
    fix: decision.fix,
    ...(decision.fix === 'phrase' ? { find: decision.find } : {}),
    replaceWith: decision.replaceWith,
    places: { transcript: transcriptCount, captions: captionCount },
    decisionReference: decision.decisionReference,
    reviewedAt,
    ...(decision.note ? { note: decision.note } : {}),
  });
}
writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `caption-fix-decisions-${reviewedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv.endsWith('\n') ? csv : `${csv}\n`);

console.log(`\n  Written: ${contents.size} caption and transcript files, and data/cihof_caption_fixes.json`);
console.log(`  The sheet is archived as ${relative(root, archived)}`);
console.log('  Next: npm run media:assert, npm test, review the diff, commit.\n');

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
