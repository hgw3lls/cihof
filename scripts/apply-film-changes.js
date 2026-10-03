import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { applyFilmChanges, filmChangeColumns, filmChangeDecisions, videoHoldingsFrom } from '../packages/pipeline/src/build/media-changes.ts';
import { readFilmTitles } from '../packages/pipeline/src/build/film-titles.ts';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import { collectDifferences, filmTitlesByPerson, readPublishedRecord, readReviewedDifferences, recordDecision } from '../packages/pipeline/src/build/parity.ts';
import { csvCell, parseRows } from '../packages/pipeline/src/build/review.ts';
import { changesWhatVisitorsSee, printVisibleChanges, writeRecordedDifferences } from './parity-utils.js';
import { projectStatus } from './working-tree.js';

/**
 * Adds films chosen in the staff portal to people's films, or takes films off
 * the display (packages/pipeline/src/build/media-changes.ts says what a row
 * must say). A new film is copied with its poster, captions and transcript
 * into public/media/videos, where the exhibit plays it from; the display
 * update carries it to the display. The manifest records it as cleared for
 * the display only, as every film is, with its approved title if it has one.
 * A film taken off keeps its record and its files.
 *
 *   npm run films:change -- --input=<sheet> [--uploads=<folder>]
 *   npm run films:change -- --input=… --apply --expect-hash=<sha256>
 *
 * The files are the staff portal's uploads, in .review/uploads unless
 * --uploads says otherwise, each named by its checksum.
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'data/media_manifest.json');
const titlesPath = resolve(root, 'data/cihof_film_titles.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const uploadsDir = resolve(root, args.uploads ?? '.review/uploads');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run films:change -- --input=<sheet> [--uploads=<folder>]');
  console.error('  npm run films:change -- --input=… --apply --expect-hash=<sha256>');
  console.error(`\nThe sheet's columns: ${filmChangeColumns.join(',')}`);
  console.error('The staff portal writes it from Portraits and films.');
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

const manifestStored = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { decisions, errors, blank } = filmChangeDecisions(csv, { people: buildPeople(), manifest: manifestStored, uploadsDir });
console.log(`\n  ${decisions.length} change(s) to films, ${blank} row(s) left as they are.`);
for (const decision of decisions) {
  console.log(decision.decision === 'add'
    ? `    Add a film of ${clock(decision.durationSeconds)} to ${decision.name}'s films${decision.title ? `, called "${decision.title}"` : ''}, under ${decision.decisionReference}`
    : `    Take ${decision.name}'s film ${decision.filmId} off the display, under ${decision.decisionReference}`);
}
const references = new Set(decisions.map((decision) => decision.decisionReference));
if (references.size > 1) errors.push(`the sheet names ${references.size} decisions (${[...references].join(', ')}); give each its own sheet`);
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
const { manifest, titles, placements } = applyFilmChanges(manifestStored, readFilmTitles(), decisions, appliedAt);
const differences = collectDifferences(buildPeople({ media: manifest }), readPublishedRecord(), filmTitlesByPerson(titles, videoHoldingsFrom(manifest)));
const visible = recordDecision(readReviewedDifferences(), differences, {
  ids: new Set(decisions.map((decision) => decision.personId)), decisionReference: [...references][0], recordedAt: appliedAt,
});
printVisibleChanges(visible);

if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run films:change -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

// The files first, each checked as it is copied: a film is read only once.
for (const placement of placements) {
  const to = resolve(root, placement.to);
  mkdirSync(dirname(to), { recursive: true });
  const partial = `${to}.partial`;
  const checksum = createHash('sha256');
  const source = createReadStream(resolve(uploadsDir, placement.from));
  source.on('data', (chunk) => checksum.update(chunk));
  await pipeline(source, createWriteStream(partial));
  if (checksum.digest('hex') !== placement.from.slice(0, 64)) {
    rmSync(partial, { force: true });
    console.error(`\n  ${placement.from.slice(0, 12)}… changed after it was chosen. Nothing was written; choose it again.`);
    process.exit(1);
  }
  renameSync(partial, to);
}
if (!args.noBackup) {
  copyFileSync(manifestPath, `${manifestPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
  if (existsSync(titlesPath)) copyFileSync(titlesPath, `${titlesPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(titlesPath, `${JSON.stringify(titles, null, 2)}\n`);
if (changesWhatVisitorsSee(visible)) writeRecordedDifferences(visible);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `film-changes-${appliedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, keepRows(csv, new Set(decisions.map((decision) => decision.personId))));

console.log(`\n  ${placements.length} file(s) copied into public/media/videos`);
console.log('  Written to data/media_manifest.json and data/cihof_film_titles.json');
console.log(`  Decided rows archived to ${archived.replace(`${root}/`, '')}\n`);

function clock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function keepRows(text, ids) {
  const rows = parseRows(text.replace(/^﻿/, ''));
  const header = rows[0] ?? [];
  const idColumn = header.indexOf('personId');
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
