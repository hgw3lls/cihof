import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { biographyReviewerColumns, biographySheetCsv, buildBiographySheet } from '../src/build/biographies.ts';
import { buildPeople } from '../src/build/people.ts';
import { decisionsInSheet } from '../src/build/review.ts';
import { repoFile, repoRoot } from '../src/paths.ts';

/**
 * Writes the biography sheet: every person's biography as visitors read it,
 * with empty columns for a correction.
 *
 *   npm run review:bios                          reports/biographies-sheet.csv
 *   npm run review:bios -- --output=<path>
 *
 * Written outside the tracked files (reports/ is ignored by git) so that
 * filling it in never blocks bios:apply, which needs a clean working tree.
 * Apply it with npm run bios:apply.
 */

const argument = process.argv.slice(2).find((value) => value.startsWith('--output='));
const force = process.argv.includes('--force');
const csvPath = argument ? resolve(argument.slice('--output='.length)) : repoFile('reports/biographies-sheet.csv');

if (existsSync(csvPath) && !force) {
  const typed = decisionsInSheet(readFileSync(csvPath, 'utf8'), biographyReviewerColumns, 'name');
  if (typed.length > 0) {
    console.error(`\nRefusing to overwrite ${relative(repoRoot(), csvPath)}: ${typed.length} row(s) have a correction typed in.`);
    for (const row of typed.slice(0, 5)) console.error(`  ${row.slice(0, 100)}`);
    console.error('\nApply them first (npm run bios:apply), or move the file aside. --force overwrites, and means it.');
    process.exit(1);
  }
}

const rows = buildBiographySheet(buildPeople());
mkdirSync(dirname(csvPath), { recursive: true });
writeFileSync(csvPath, biographySheetCsv(rows));
const curated = rows.filter((row) => row.provenance === 'curated').length;
console.log(`\n  ${relative(repoRoot(), csvPath)}: ${rows.length} biographies (${rows.length - curated} the institution's text, ${curated} a curator's).`);
console.log('  Fill in correctedText (the whole corrected biography) and decisionReference on the rows to change.');
console.log('  useSourceText = yes puts a curated biography back to the institution\'s text.');
console.log(`  Then: npm run bios:apply -- --input=${relative(repoRoot(), csvPath)}\n`);
