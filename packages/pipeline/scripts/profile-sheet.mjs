import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { buildPeople } from '../src/build/people.ts';
import { buildProfileSheet, profileProgress, profileReviewerColumns, profileSheetCsv } from '../src/build/profiles.ts';
import { decisionsInSheet } from '../src/build/review.ts';
import { repoFile, repoRoot } from '../src/paths.ts';

/**
 * Writes the profile sheet: one row per person, with their review state and
 * the content version a decision would cover, and empty columns to decide.
 *
 *   npm run review:profiles                     reports/profiles-sheet.csv
 *   npm run review:profiles -- --output=<path>
 *   npm run review:profiles -- --report         the counts only, nothing written
 *
 * The staff review app is the easier way to do this; the sheet is for a
 * curator who prefers a spreadsheet. Apply it with npm run profiles:apply.
 */

const args = process.argv.slice(2);
const rows = buildProfileSheet(buildPeople());
const progress = profileProgress(rows);
console.log(`\n  Profiles: ${progress.approved} of ${progress.total} approved`
  + `, ${progress.changedSinceApproval} changed since approval`
  + `, ${progress.changesRequested} with changes requested`
  + `, ${progress.unreviewed} not yet reviewed.`);
if (args.includes('--report')) process.exit(0);

const argument = args.find((value) => value.startsWith('--output='));
const csvPath = argument ? resolve(argument.slice('--output='.length)) : repoFile('reports/profiles-sheet.csv');
if (existsSync(csvPath) && !args.includes('--force')) {
  const typed = decisionsInSheet(readFileSync(csvPath, 'utf8'), profileReviewerColumns, 'name');
  if (typed.length > 0) {
    console.error(`\nRefusing to overwrite ${relative(repoRoot(), csvPath)}: ${typed.length} row(s) have a decision typed in.`);
    console.error('Apply them first (npm run profiles:apply), or move the file aside. --force overwrites, and means it.');
    process.exit(1);
  }
}
mkdirSync(dirname(csvPath), { recursive: true });
writeFileSync(csvPath, profileSheetCsv(rows));
console.log(`  ${relative(repoRoot(), csvPath)}: decision is approve or changes (with a note saying what).`);
console.log(`  Then: npm run profiles:apply -- --input=${relative(repoRoot(), csvPath)}\n`);
