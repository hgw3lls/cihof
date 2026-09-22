import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { crosswalkProgress, unresolvedEntries, worksheetProgress, entryProblems } from '@cihof/content';
import { buildInductionCrosswalk } from '../src/build/crosswalk.ts';
import { buildContributionWorksheet } from '../src/build/worksheet.ts';
import { buildPeople } from '../src/build/people.ts';
import { dataFile } from '../src/paths.ts';

/**
 * Refreshes the two sheets curators work in:
 *
 *   data/cihof_induction_crosswalk.json  who each recorded inducter name is
 *   data/cihof_contributions.json        what each person actually changed
 *
 * Safe to re-run. Resolutions, statuses and written contributions are carried
 * forward; only the parts derived from the canonical sources are rebuilt. Pass
 * --check to verify both are current without writing, which is what CI runs.
 */

const target = dataFile('cihof_induction_crosswalk.json');
const check = process.argv.includes('--check');

const previous = existsSync(target)
  ? JSON.parse(readFileSync(target, 'utf8'))
  : undefined;

const { crosswalk, added, droppedResolved } = buildInductionCrosswalk(previous);

if (droppedResolved.length > 0) {
  console.error(`\nRefusing to drop ${droppedResolved.length} resolved name(s) no longer in the roster:`);
  for (const name of droppedResolved) console.error(`  ${name}`);
  console.error('\nSomeone resolved these and the roster no longer records them. Reconcile the');
  console.error('roster or remove the rows deliberately; this script will not discard review work.');
  process.exit(1);
}

const progress = crosswalkProgress(crosswalk);
// The timestamp changes on every run, so --check compares the content that
// matters rather than reporting the file stale every time it is inspected.
const comparable = (value) => JSON.stringify({ ...value, generatedAt: null }, null, 2);
const current = previous !== undefined && comparable(previous) === comparable(crosswalk);

if (check && !current) {
  console.error('The induction crosswalk is out of date. Run: npm run crosswalk');
  process.exit(1);
}
if (check) console.log(`Induction crosswalk is current: ${progress.total} names, ${progress.unresolved} unresolved.`);
else if (!current) writeFileSync(target, `${JSON.stringify(crosswalk, null, 2)}\n`);

console.log(`\nInduction crosswalk — ${current ? 'already current' : 'written'}`);
console.log(`  distinct recorded names   ${progress.total}`);
console.log(`  roster rows covered       ${progress.rowsTotal}`);
console.log(`  resolved                  ${progress.total - progress.unresolved}`);
console.log(`    an inductee             ${progress.inductee}`);
console.log(`    not an inductee         ${progress.notAnInductee}`);
console.log(`    unidentifiable          ${progress.unidentifiable}`);
console.log(`  still to review           ${progress.unresolved}`);
if (added.length > 0) console.log(`  new since last run        ${added.length}`);

const withCandidates = unresolvedEntries(crosswalk).filter((entry) => entry.candidates.length > 0);
console.log(`\n  of the unresolved, ${withCandidates.length} have a candidate to confirm or reject.`);
for (const entry of withCandidates.slice(0, 10)) {
  const names = entry.candidates.map((candidate) => `${candidate.displayName} (${candidate.inducteeId})`).join(', ');
  console.log(`    ${entry.recordedName} — inducted ${entry.inducted.length} — candidate: ${names}`);
}
if (withCandidates.length > 10) console.log(`    … and ${withCandidates.length - 10} more`);

console.log(`\n  relationships this would yield once published: ${progress.relationshipsAvailable}`);
if (!crosswalk.publicationDecision) {
  console.log('  (none yet: the file carries no publicationDecision, and resolving a name');
  console.log('   says who someone is, not that the relationship may be shown.)');
}

// ---- the contribution worksheet ----------------------------------------

const sheetPath = dataFile('cihof_contributions.json');
const previousSheet = existsSync(sheetPath) ? JSON.parse(readFileSync(sheetPath, 'utf8')) : undefined;
const sheet = buildContributionWorksheet(buildPeople(), previousSheet);

if (sheet.orphaned.length > 0) {
  console.error(`\nRefusing to drop ${sheet.orphaned.length} written row(s) whose subject left the roster:`);
  for (const id of sheet.orphaned) console.error(`  ${id}`);
  console.error('\nSomebody wrote those. Reconcile the roster or remove the rows deliberately.');
  process.exit(1);
}

const sheetCurrent = previousSheet !== undefined && comparable(previousSheet) === comparable(sheet.worksheet);
if (check) {
  if (!sheetCurrent) {
    console.error('\nThe contribution worksheet is out of date. Run: npm run crosswalk');
    process.exit(1);
  }
} else if (!sheetCurrent) {
  writeFileSync(sheetPath, `${JSON.stringify(sheet.worksheet, null, 2)}\n`);
}

const written = worksheetProgress(sheet.worksheet);
console.log(`\nContribution worksheet \u2014 ${sheetCurrent ? 'already current' : 'written'}`);
console.log(`  people                    ${written.people}`);
console.log(`  not started               ${written.notStarted}`);
console.log(`  in progress               ${written.inProgress}`);
console.log(`  ready for review          ${written.readyForReview}`);
console.log(`  nothing documented        ${written.nothingDocumented}`);
console.log(`  contributions written     ${written.written}`);
console.log(`    naming something        ${written.specific}`);

// A row marked ready that is not actually ready is the failure worth naming:
// it sits in the sheet looking finished.
const notReady = sheet.worksheet.entries
  .map((entry) => ({ entry, problems: entryProblems(entry) }))
  .filter(({ problems }) => problems.length > 0);
if (notReady.length > 0) {
  console.log(`\n  ${notReady.length} row(s) marked ready but not publishable:`);
  for (const { entry, problems } of notReady.slice(0, 5)) {
    console.log(`    ${entry.displayName}: ${problems[0]}`);
  }
  if (notReady.length > 5) console.log(`    \u2026 and ${notReady.length - 5} more`);
}
console.log();
