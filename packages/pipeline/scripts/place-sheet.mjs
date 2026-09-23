import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { placeReviewProgress, placeReviewRemaining } from '@cihof/content';
import { buildPlaceReviewSheet, decisionsInSheet, placeReviewSheetCsv } from '../src/build/review.ts';
import { buildPeople } from '../src/build/people.ts';
import { dataFile, repoFile } from '../src/paths.ts';

/**
 * Regenerates the places review sheet:
 *
 *   data/cihof_place_review.json   what each place holds and who is tied to it
 *   docs/places-review-sheet.csv   the same, to fill in away from here
 *
 * Derived from `data/cihof_places.json` and
 * `data/cihof_place_associations.json`. Decisions go back through
 * `npm run places:apply`, never here. Pass --check for CI.
 */

const check = process.argv.includes('--check');
const force = process.argv.includes('--force');

const places = JSON.parse(readFileSync(dataFile('cihof_places.json'), 'utf8')).places ?? [];
const tiesPath = dataFile('cihof_place_associations.json');
const associations = existsSync(tiesPath)
  ? JSON.parse(readFileSync(tiesPath, 'utf8')).associations ?? []
  : [];

const sheet = buildPlaceReviewSheet(places, associations, buildPeople());
const jsonPath = dataFile('cihof_place_review.json');
const csvPath = repoFile('docs/places-review-sheet.csv');

const comparable = (value) => JSON.stringify({ ...value, generatedAt: null }, null, 2);
const previous = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : undefined;
const jsonCurrent = previous !== undefined && comparable(previous) === comparable(sheet);

const csv = placeReviewSheetCsv(sheet);
const csvCurrent = existsSync(csvPath) && readFileSync(csvPath, 'utf8') === csv;

// Same guard as the links sheet: what a curator types lives nowhere else until
// it is applied, and regenerating over it destroys review work in silence.
const signed = csvCurrent || !existsSync(csvPath)
  ? []
  : decisionsInSheet(readFileSync(csvPath, 'utf8'), ['approve', 'decisionReference', 'roles'], 'name');

if (check) {
  if (signed.length > 0) {
    console.error(`\ndocs/places-review-sheet.csv has ${signed.length} row(s) with a decision typed into it.`);
    console.error('Apply it, or move it aside:  npm run places:apply -- --input=docs/places-review-sheet.csv');
    process.exit(1);
  }
  if (!(jsonCurrent && csvCurrent)) {
    console.error('The places review sheet is out of date. Run: npm run review:places');
    process.exit(1);
  }
}

if (!check && signed.length > 0 && !force) {
  console.error(`\nRefusing to regenerate: docs/places-review-sheet.csv has ${signed.length} row(s) with a decision in it.`);
  for (const row of signed.slice(0, 5)) console.error(`  ${row}`);
  if (signed.length > 5) console.error(`  … and ${signed.length - 5} more`);
  console.error('\nApply them first, or move the file aside. --force overwrites, and means it.');
  process.exit(1);
}

let jsonWrote = false;
let csvWrote = false;
if (!check) {
  if (!jsonCurrent) { writeFileSync(jsonPath, `${JSON.stringify(sheet, null, 2)}\n`); jsonWrote = true; }
  if (!csvCurrent) { mkdirSync(dirname(csvPath), { recursive: true }); writeFileSync(csvPath, csv); csvWrote = true; }
}

const progress = placeReviewProgress(sheet);
const state = (wrote, current) => (check ? (current ? 'current' : 'STALE') : wrote ? 'written' : 'unchanged');
console.log('\nPlaces review sheet');
console.log(`  data/cihof_place_review.json          ${state(jsonWrote, jsonCurrent)}`);
console.log(`  docs/places-review-sheet.csv          ${state(csvWrote, csvCurrent)}`);
console.log();
console.log(`  places                    ${progress.places}`);
console.log(`    with a short history    ${progress.researched}`);
console.log(`    leads, research first   ${progress.leads}`);
console.log(`  reviewed                  ${progress.reviewed}`);
console.log(`\n  person-to-place ties      ${progress.ties}`);
console.log(`    carrying a role         ${progress.tiesWithRole}`);
console.log(`\n  Places lens               ${progress.publishable} of ${progress.placesThreshold} — ${progress.placesWouldOpen ? 'OPEN' : 'closed'}`);

const remaining = placeReviewRemaining(sheet);
if (remaining.length > 0) {
  console.log('\n  to open it:');
  for (const item of remaining) console.log(`    - ${item}`);
}

const ready = sheet.rows.filter((row) => row.band === 'researched' && !row.reviewed);
if (ready.length > 0) {
  console.log(`\n  ${ready.length} place(s) ready to review, most-connected first:`);
  for (const row of ready.slice(0, 8)) {
    console.log(`    ${row.name} — ${row.ties.length} ${row.ties.length === 1 ? 'person' : 'people'}`);
  }
  if (ready.length > 8) console.log(`    … and ${ready.length - 8} more`);
}
console.log();
