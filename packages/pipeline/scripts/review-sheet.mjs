import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readyToConfirm, reviewProgress, reviewRemaining, reviewRowProblems } from '@cihof/content';
import { buildRelationshipReviewSheet, reviewSheetCsv } from '../src/build/review.ts';
import { buildPeople } from '../src/build/people.ts';
import { dataFile, repoFile } from '../src/paths.ts';

/**
 * Regenerates the induction review sheet:
 *
 *   data/cihof_relationship_review.json  what each signature would publish
 *   docs/links-review-sheet.csv          the same, to fill in away from here
 *
 * Wholly derived from `data/cihof_induction_crosswalk.json`, so it is safe to
 * re-run and safe to delete. Decisions are written back to the crosswalk by
 * `npm run links:apply`, never here. Pass --check to verify both files are
 * current without writing, which is what CI runs.
 */

const check = process.argv.includes('--check');
const crosswalkPath = dataFile('cihof_induction_crosswalk.json');

if (!existsSync(crosswalkPath)) {
  console.error(`No crosswalk at ${crosswalkPath}. Run: npm run crosswalk`);
  process.exit(1);
}

const crosswalk = JSON.parse(readFileSync(crosswalkPath, 'utf8'));
const people = buildPeople();
const sheet = buildRelationshipReviewSheet(crosswalk, people);

const jsonPath = dataFile('cihof_relationship_review.json');
const csvPath = repoFile('docs/links-review-sheet.csv');

// The timestamp changes on every run, so --check compares the content that
// matters rather than reporting the sheet stale every time it is inspected.
const comparable = (value) => JSON.stringify({ ...value, generatedAt: null }, null, 2);
const previous = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : undefined;
const jsonCurrent = previous !== undefined && comparable(previous) === comparable(sheet);

const csv = reviewSheetCsv(sheet);
const csvCurrent = existsSync(csvPath) && readFileSync(csvPath, 'utf8') === csv;

if (check && !(jsonCurrent && csvCurrent)) {
  console.error('The induction review sheet is out of date. Run: npm run review:links');
  process.exit(1);
}

if (!check) {
  if (!jsonCurrent) writeFileSync(jsonPath, `${JSON.stringify(sheet, null, 2)}\n`);
  if (!csvCurrent) {
    mkdirSync(dirname(csvPath), { recursive: true });
    writeFileSync(csvPath, csv);
  }
}

const progress = reviewProgress(sheet);
const known = new Set(people.map((person) => person.id));

console.log(`\nInduction review sheet — ${jsonCurrent && csvCurrent ? 'already current' : 'written'}`);
console.log(`  recorded names            ${progress.names}`);
console.log(`    one candidate           ${progress.singleCandidate}`);
console.log(`    more than one           ${progress.ambiguous}`);
console.log(`    none                    ${progress.noCandidate}`);
console.log(`  resolved                  ${progress.resolved}`);
console.log(`  still to review           ${progress.unresolved}`);
console.log(`\n  relationships resolved    ${progress.relationshipsResolved}`);
console.log(`  proposed, not accepted    ${progress.relationshipsProposed}`);
console.log(`  publication decision      ${progress.publicationDecisionSigned ? 'signed' : 'not signed'}`);
console.log(`\n  Links lens                ${progress.linksCount} of ${progress.linksThreshold} — ${progress.linksWouldOpen ? 'OPEN' : 'closed'}`);

const remaining = reviewRemaining(sheet);
if (remaining.length > 0) {
  console.log('\n  to open it:');
  for (const item of remaining) console.log(`    - ${item}`);
}

// A resolution that yields nothing reads as review work having gone missing,
// so it is named rather than left to be noticed.
const broken = sheet.rows
  .map((row) => ({ row, problems: reviewRowProblems(row, (id) => known.has(id)) }))
  .filter(({ problems }) => problems.length > 0);
if (broken.length > 0) {
  console.log(`\n  ${broken.length} resolved row(s) that cannot be acted on:`);
  for (const { row, problems } of broken.slice(0, 5)) {
    console.log(`    ${row.recordedName}: ${problems[0]}`);
  }
  if (broken.length > 5) console.log(`    … and ${broken.length - 5} more`);
}

const ready = readyToConfirm(sheet);
if (ready.length > 0) {
  console.log(`\n  ${ready.length} row(s) ready to confirm, longest first:`);
  const sorted = [...ready].sort((a, b) => b.proposes.length - a.proposes.length);
  for (const row of sorted.slice(0, 8)) {
    const candidate = row.candidates[0];
    console.log(`    ${row.recordedName} → ${candidate.displayName} (${candidate.inducteeId}) — ${row.proposes.length} relationship(s)`);
  }
  if (sorted.length > 8) console.log(`    … and ${sorted.length - 8} more`);
  console.log(`\n  Fill in ${csvPath.replace(`${resolve(import.meta.dirname, '..', '..', '..')}/`, '')} and run:`);
  console.log('    npm run links:apply -- --input=docs/links-review-sheet.csv          (dry run)');
  console.log('    npm run links:apply -- --input=docs/links-review-sheet.csv --apply  (writes)');
}
console.log();
