import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildProposedTiesSheet, decisionsInSheet, proposedTiesSheetCsv, relationshipKinds } from '../src/build/review.ts';
import { buildPeople } from '../src/build/people.ts';
import { readCorpusConnections } from '../src/sources/corpus.ts';
import { readTieDecisions } from '../src/sources/ties.ts';
import { repoFile } from '../src/paths.ts';

/**
 * Regenerates the proposed-ties review sheet:
 *
 *   data/review-sheets/proposed-ties-sheet.csv   one row per tie the corpus proposes
 *
 * Derived from `data/hof_world_person_relationships.json` (every row that is
 * not an induction, which the crosswalk sheet covers). These are the dashed
 * amber ties in the editor's preview (`npm run dev:preview`), one row per line
 * on that map. Pass --check for CI.
 */

const check = process.argv.includes('--check');
const force = process.argv.includes('--force');

const rows = buildProposedTiesSheet(readCorpusConnections(), buildPeople(), readTieDecisions());
const csvPath = repoFile('data/review-sheets/proposed-ties-sheet.csv');
const csv = proposedTiesSheetCsv(rows);
const current = existsSync(csvPath) && readFileSync(csvPath, 'utf8') === csv;

// A decision typed into the sheet lives nowhere else yet. Regenerating over it
// would destroy review work in silence.
const signed = current || !existsSync(csvPath)
  ? []
  : decisionsInSheet(readFileSync(csvPath, 'utf8'), ['decision', 'kind', 'label', 'decisionReference'], 'tieId');

if (check) {
  if (signed.length > 0) {
    console.error(`\ndata/review-sheets/proposed-ties-sheet.csv has ${signed.length} row(s) with a decision typed into it.`);
    console.error('Apply them, or move the sheet aside:  npm run ties:apply -- --input=<the sheet>');
    process.exit(1);
  }
  if (!current) {
    console.error('The proposed-ties sheet is out of date. Run: npm run review:ties');
    process.exit(1);
  }
}

if (!check && signed.length > 0 && !force) {
  console.error(`\nRefusing to regenerate: data/review-sheets/proposed-ties-sheet.csv has ${signed.length} row(s) with a decision in it.`);
  for (const row of signed.slice(0, 5)) console.error(`  ${row}`);
  if (signed.length > 5) console.error(`  … and ${signed.length - 5} more`);
  console.error('\nApply them first (npm run ties:apply), or move the file aside. --force overwrites, and means it.');
  process.exit(1);
}

let wrote = false;
if (!check && !current) {
  mkdirSync(dirname(csvPath), { recursive: true });
  writeFileSync(csvPath, csv);
  wrote = true;
}

const byType = new Map();
for (const row of rows) byType.set(row.sourceType, (byType.get(row.sourceType) ?? 0) + 1);
const state = check ? (current ? 'current' : 'STALE') : wrote ? 'written' : 'unchanged';

console.log('\nProposed-ties review sheet');
console.log(`  data/review-sheets/proposed-ties-sheet.csv   ${state}`);
const decidedCount = rows.filter((row) => row.currentStatus !== 'unreviewed').length;
console.log(`\n  ${rows.length} proposed ties, ${decidedCount} decided, ${rows.length - decidedCount} to go`);
for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${type.padEnd(32)} ${count}`);
}
console.log('\n  For each row, fill in:');
console.log('    decision           relationship | context | reject');
console.log(`    kind               ${relationshipKinds.join(', ')}`);
console.log('    label              how it reads from person A');
console.log('    inverseLabel       how it reads from person B (needed for mentored, taught, succeeded, employed, nominated)');
console.log('    decisionReference  e.g. ties-review-2026-09-25');
console.log('\n  "context" keeps two people who appear together without claiming a relationship.');
console.log('  See each tie in place first:  npm run dev:preview  →  Connections');
console.log();
