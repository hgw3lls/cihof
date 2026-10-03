import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applyPortraits, portraitColumns, portraitDecisions } from '../packages/pipeline/src/build/media-changes.ts';
import { readPortraitChecksums } from '../packages/pipeline/src/build/profiles.ts';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import { csvCell, parseRows } from '../packages/pipeline/src/build/review.ts';
import { changesWhatVisitorsSee, printVisibleChanges, visibleChanges, writeRecordedDifferences } from './parity-utils.js';
import { projectStatus } from './working-tree.js';

/**
 * Replaces portraits with pictures chosen in the staff portal
 * (packages/pipeline/src/build/media-changes.ts says what a row must say).
 * Each new picture is copied into public/media/images beside the old one,
 * which stays; the manifest and the curated record name the new one, with
 * its description and the confirmation that the museum may show it. What
 * visitors see differently is recorded under the decision, and the profile's
 * approval lapses until somebody approves it with its new picture.
 *
 *   npm run portraits:replace -- --input=<sheet> [--uploads=<folder>]
 *   npm run portraits:replace -- --input=… --apply --expect-hash=<sha256>
 *
 * The pictures are the staff portal's uploads, in .review/uploads unless
 * --uploads says otherwise, each named by its checksum.
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const curatedPath = resolve(root, 'data/cihof_curated_metadata.json');
const manifestPath = resolve(root, 'data/media_manifest.json');
const archiveDir = resolve(root, 'data/curation-decisions');
const uploadsDir = resolve(root, args.uploads ?? '.review/uploads');
const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run portraits:replace -- --input=<sheet> [--uploads=<folder>]');
  console.error('  npm run portraits:replace -- --input=… --apply --expect-hash=<sha256>');
  console.error(`\nThe sheet's columns: ${portraitColumns.join(',')}`);
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

const curatedStored = JSON.parse(readFileSync(curatedPath, 'utf8'));
const manifestStored = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { decisions, errors, blank } = portraitDecisions(csv, {
  people: buildPeople(), curated: curatedStored, manifest: manifestStored, checksums: readPortraitChecksums(), uploadsDir,
});
console.log(`\n  ${decisions.length} new portrait(s), ${blank} row(s) left as they are.`);
for (const decision of decisions) console.log(`    ${decision.name} (${decision.id}): ${decision.width} by ${decision.height}, under ${decision.decisionReference}`);
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
const { manifest, curated, placements } = applyPortraits(manifestStored, curatedStored, decisions, appliedAt);
const visible = visibleChanges({ sources: { curated, media: manifest }, ids: decisions.map((decision) => decision.id), decisionReference: [...references][0] });
printVisibleChanges(visible);

if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run portraits:replace -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

for (const placement of placements) {
  const to = resolve(root, placement.to);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(resolve(uploadsDir, placement.from), to);
}
if (!args.noBackup) {
  copyFileSync(curatedPath, `${curatedPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
  copyFileSync(manifestPath, `${manifestPath}.backup-${appliedAt.replace(/[:.]/g, '-')}`);
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(curatedPath, `${JSON.stringify(curated, null, 2)}\n`);
if (changesWhatVisitorsSee(visible)) writeRecordedDifferences(visible);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `portraits-${appliedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, keepRows(csv, new Set(decisions.map((decision) => decision.id))));

console.log(`\n  ${placements.length} picture(s) copied into public/media/images`);
console.log('  Written to data/media_manifest.json and data/cihof_curated_metadata.json');
console.log('  Recorded what visitors see differently in data/cihof_reviewed_differences.json');
console.log(`  Decided rows archived to ${archived.replace(`${root}/`, '')}`);
console.log('  The profiles need approving again with their new pictures (profiles:apply).\n');

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
