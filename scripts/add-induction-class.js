import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { imageFacts } from '../packages/pipeline/src/build/images.ts';
import {
  curatedRecord, mediaRecord, newClassTemplateCsv, portraitPaths, readNewClassSheet, rosterRow,
} from '../packages/pipeline/src/build/new-class.ts';
import { changesWhatVisitorsSee, printVisibleChanges, visibleChangesByReference, writeRecordedDifferences } from './parity-utils.js';

/**
 * Adds a new induction class from a sheet: one row per new inductee.
 *
 *   npm run class:template -- --output=reports/class-2027.csv   a blank sheet
 *   npm run class:add -- --input=reports/class-2027.csv          preview
 *   npm run class:add -- --input=… --apply --expect-hash=<sha256>
 *
 * Each row becomes a roster row, a curated record, and a media record with its
 * portrait copied into public/media/images/<id>/. A portraitFile is read
 * relative to the sheet, so a sheet and its photos can sit in one folder.
 * Then the induction crosswalk and the links sheet are regenerated, so a new
 * inducter name appears there to be resolved, and each new person is recorded
 * as added under the row's decision reference.
 *
 * The same gates as the other sheets: a preview by default, --expect-hash on
 * --apply, and a clean working tree. See packages/pipeline/src/build/new-class.ts
 * for what it will and will not write.
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const paths = {
  roster: resolve(root, 'data/cihof_kiosk_manifest.csv'),
  curated: resolve(root, 'data/cihof_curated_metadata.json'),
  media: resolve(root, 'data/media_manifest.json'),
  archive: resolve(root, 'data/curation-decisions'),
};

if (process.argv[2] === 'template') {
  const output = resolve(typeof args.output === 'string' ? args.output : 'reports/new-class.csv');
  if (existsSync(output) && !args.force) fail(`${relative(root, output)} already exists. --force overwrites it.`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, newClassTemplateCsv());
  console.log(`\n  ${relative(root, output)}: a blank sheet, one row per new inductee.`);
  console.log('  Put the portraits in the same folder and name each in portraitFile.');
  console.log(`  Then: npm run class:add -- --input=${relative(root, output)}\n`);
  process.exit(0);
}

const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run class:template -- --output=reports/class-2027.csv');
  console.error('  npm run class:add -- --input=reports/class-2027.csv');
  console.error('  npm run class:add -- --input=… --apply --expect-hash=<sha256>');
  process.exit(1);
}

const csv = readFileSync(inputPath, 'utf8');
const hash = createHash('sha256').update(csv).digest('hex');
if (args.apply) {
  if (args.expectHash !== hash) {
    console.error('\nThis sheet has not been previewed, or it changed since it was.');
    console.error(`  its hash now: ${hash}`);
    if (args.expectHash) console.error(`  you passed:   ${args.expectHash}`);
    fail('Run the preview first, then pass the hash it prints.');
  }
  requireCleanTree();
}

const rosterText = readFileSync(paths.roster, 'utf8');
const curated = JSON.parse(readFileSync(paths.curated, 'utf8'));
const media = JSON.parse(readFileSync(paths.media, 'utf8'));
const existingIds = new Set([...Object.keys(curated.inductees), ...Object.keys(media.assets)]);
const records = Object.values(curated.inductees);
const known = {
  themes: new Set(records.flatMap((record) => record.approvedThemeTags ?? [])),
  countries: new Set(records.flatMap((record) => record.approvedCountryTags ?? [])),
  communities: new Set(records.flatMap((record) => record.approvedCommunityTags ?? [])),
};

const { people, errors, warnings } = readNewClassSheet(csv, existingIds, known);

// Each portrait, read now, so a missing or unreadable file is refused before
// anything is written.
const portraits = new Map();
for (const person of people) {
  const source = resolve(dirname(inputPath), person.portraitFile);
  if (!existsSync(source)) {
    errors.push(`line ${person.line} (${person.name}): portraitFile ${person.portraitFile} was not found next to the sheet`);
    continue;
  }
  const facts = imageFacts(readFileSync(source));
  if (facts.width === null) {
    errors.push(`line ${person.line} (${person.name}): ${person.portraitFile} is not a JPEG or PNG this can read`);
    continue;
  }
  portraits.set(person.id, { source, facts });
}

console.log(`\n  ${people.length} new inductee(s):`);
for (const person of people) {
  const portrait = portraits.get(person.id);
  console.log(`    ${person.displayName}, class of ${person.classYear}: ${person.id}`);
  console.log(`      portrait ${portrait ? `${portrait.facts.width}×${portrait.facts.height}` : '(unreadable)'}, rights ${person.portraitRights}` +
    `${person.portraitRights === 'approved' ? '' : ' (not shown until approved)'}; under ${person.decisionReference}`);
}
for (const warning of warnings) console.warn(`  Check: ${warning}`);

if (errors.length > 0) {
  console.error(`\n  ${errors.length} row(s) refused:`);
  for (const message of errors) console.error(`    ${message}`);
  fail('Nothing was written. Fix the sheet and run again.');
}
if (people.length === 0) {
  console.log('  Nothing to add.\n');
  process.exit(0);
}

// The new sources, in memory.
const appliedAt = new Date().toISOString();
const rosterHeader = rosterText.replace(/^﻿/, '').split('\n', 1)[0].split(',');
const nextRoster = `${rosterText.endsWith('\n') ? rosterText : `${rosterText}\n`}${people.map((person) => rosterRow(person, rosterHeader)).join('\n')}\n`;
const nextCurated = structuredClone(curated);
const nextMedia = structuredClone(media);
for (const person of people) {
  nextCurated.inductees[person.id] = curatedRecord(person, appliedAt);
  nextMedia.assets[person.id] = mediaRecord(person, portraits.get(person.id).facts);
}
nextCurated.source = { ...(nextCurated.source ?? {}), recordCount: Object.keys(nextCurated.inductees).length };

const groups = new Map();
for (const person of people) groups.set(person.decisionReference, [...(groups.get(person.decisionReference) ?? []), person.id]);
const visible = visibleChangesByReference({ sources: { curated: nextCurated, media: nextMedia, rosterCsv: nextRoster }, groups });
printVisibleChanges(visible);

if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To add them:');
  console.log(`    npm run class:add -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

for (const person of people) {
  const target = resolve(root, portraitPaths(person).filePath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(portraits.get(person.id).source, target);
}
writeFileSync(paths.roster, nextRoster);
writeFileSync(paths.curated, `${JSON.stringify(nextCurated, null, 2)}\n`);
writeFileSync(paths.media, `${JSON.stringify(nextMedia, null, 2)}\n`);
if (changesWhatVisitorsSee(visible)) writeRecordedDifferences(visible);
mkdirSync(paths.archive, { recursive: true });
const archived = resolve(paths.archive, `new-class-${appliedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv);

console.log(`\n  Added ${people.length} to the roster, the curated records and the media manifest.`);
console.log(`  Portraits copied into public/media/images/. Sheet archived to ${relative(root, archived)}.`);

// The crosswalk and the contribution worksheet are built from the roster, and
// the links sheet from the crosswalk. Regenerated here so the checks pass and
// a new inducter name is waiting in the links sheet to be resolved.
for (const script of ['crosswalk', 'review:links']) {
  const result = spawnSync('npm', ['run', '-s', script], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) fail(`npm run ${script} failed. The sources were written; run it again once fixed.`);
}

console.log('\n  Next:');
console.log('    npm test, npm run media:validate, and npm run dev to see them.');
console.log('    Resolve any new inducter names in data/review-sheets/links-review-sheet.csv (npm run links:apply).');
console.log('    Films and more photos go through the media sheet as for everyone else.\n');

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
  fail('Commit, stash or discard them first, so this change arrives as its own diff.');
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
