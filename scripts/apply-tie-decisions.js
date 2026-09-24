import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { connectionProblems, sharedContextProblems } from '@cihof/content';
import { parseCsv } from './data-utils.js';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';
import { buildProposedTiesSheet, relationshipKinds } from '../packages/pipeline/src/build/review.ts';
import { tieContexts, tieRelationships } from '../packages/pipeline/src/build/ties.ts';
import { readCorpusConnections } from '../packages/pipeline/src/sources/corpus.ts';
import { readTieDecisions } from '../packages/pipeline/src/sources/ties.ts';

/**
 * Writes decisions on the proposed ties into `data/cihof_tie_decisions.json`.
 *
 * The sheet at `data/review-sheets/proposed-ties-sheet.csv` is where a reviewer
 * says what each tie the HOF World corpus proposes really is: a relationship,
 * two people who merely appear together (context), or nothing. This is the
 * only thing that records those answers, and it does so as an ordinary file
 * change with the signed sheet archived beside it.
 *
 * Who and what a row is about is taken from the corpus, never from the sheet:
 * the sheet's copied columns are for reading, and a spreadsheet that reordered
 * or edited them must not be able to move a decision onto a different pair of
 * people. Only the reviewer's columns are read from it.
 *
 * It refuses to invent what makes an approval an approval. No decision without
 * a decisionReference; no relationship without a kind and wording; no
 * directional kind without its inverse wording; no audience unless one is
 * named with --targets.
 *
 * Gates, as for the links and places sheets:
 *
 *   1. dry run is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the CSV, so nothing is applied
 *      that was not first previewed
 *   3. --apply refuses on a dirty working tree, so the diff it produces is its own
 *
 *   npm run ties:apply -- --input=data/review-sheets/proposed-ties-sheet.csv --targets=kiosk
 *   npm run ties:apply -- --input=… --targets=kiosk --apply --expect-hash=<sha>
 */

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const root = resolve(import.meta.dirname, '..');
const decisionsPath = resolve(root, 'data/cihof_tie_decisions.json');
const archiveDir = resolve(root, 'data/curation-decisions');

const inputPath = args.input ? resolve(args.input) : '';
if (!inputPath || !existsSync(inputPath)) {
  printUsage();
  process.exit(1);
}

const csv = readFileSync(inputPath, 'utf8');
const hash = createHash('sha256').update(csv).digest('hex');

if (apply) {
  if (args.expectHash !== hash) {
    console.error('\nThis CSV has not been previewed, or it changed since it was.');
    console.error(`  its hash now: ${hash}`);
    if (args.expectHash) console.error(`  you passed:   ${args.expectHash}`);
    console.error('\nRun the dry run first, then pass the hash it prints.');
    process.exit(1);
  }
  requireCleanTree();
}

const people = buildPeople();
const ties = new Map(buildProposedTiesSheet(readCorpusConnections(), people).map((row) => [row.tieId, row]));
const existing = readTieDecisions();
const existingByTie = new Map(existing.map((decision) => [decision.tieId, decision]));
const rows = readDecisionRows(csv);
const targets = parseTargets(args.targets);
const reviewedAt = new Date().toISOString();

const errors = [];
const decisions = [];
let blank = 0;

rows.forEach((row, index) => {
  const line = index + 2;
  const tieId = (row.tieId ?? '').trim();
  const decision = (row.decision ?? '').trim().toLowerCase();
  if (!tieId) return;
  if (decision === '' || decision === 'skip') { blank += 1; return; }

  const tie = ties.get(tieId);
  if (!tie) {
    errors.push(`line ${line}: ${tieId} is not a tie the corpus proposes — regenerate the sheet with npm run review:ties`);
    return;
  }
  const who = `${tie.personAName} / ${tie.personBName}`;

  if (!['relationship', 'context', 'reject'].includes(decision)) {
    errors.push(`line ${line} (${who}): "${decision}" is not a decision — use relationship, context, reject or skip`);
    return;
  }
  const reference = (row.decisionReference ?? '').trim();
  if (!reference) {
    // Never defaulted, never generated.
    errors.push(`line ${line} (${who}): decided "${decision}" with no decisionReference`);
    return;
  }

  const kind = (row.kind ?? '').trim();
  const label = (row.label ?? '').trim();
  const inverseLabel = (row.inverseLabel ?? '').trim();
  const note = (row.note ?? '').trim();

  if (decision === 'relationship' && !relationshipKinds.includes(kind)) {
    errors.push(`line ${line} (${who}): a relationship needs a kind — one of ${relationshipKinds.join(', ')}`);
    return;
  }
  if (decision !== 'reject' && !label) {
    errors.push(`line ${line} (${who}): a ${decision} needs a label — ${decision === 'relationship'
      ? 'how it reads from person A'
      : 'what the source shows, e.g. "Both photographed at the 2017 induction ceremony"'}`);
    return;
  }
  if (decision !== 'reject' && !targets) {
    errors.push(`line ${line} (${who}): nothing says who may see this — pass --targets=kiosk (or kiosk,public-web)`);
    return;
  }

  const content = [decision, kind, label, inverseLabel, ...tie.evidence].join('␞');
  const record = {
    tieId,
    corpusIds: tie.corpusIds,
    personA: tie.personA,
    personB: tie.personB,
    sourceType: tie.sourceType,
    decision,
    ...(decision === 'relationship' ? { kind } : {}),
    ...(decision !== 'reject' ? { label } : {}),
    ...(decision === 'relationship' && inverseLabel ? { inverseLabel } : {}),
    evidence: tie.evidence,
    sourceUrls: tie.sourceUrls,
    verificationLayer: tie.verificationLayer,
    decisionReference: reference,
    // Derived from the wording decided on, so it names exactly what was signed.
    contentVersion: `tie-${createHash('sha256').update(content).digest('hex').slice(0, 12)}`,
    reviewedAt,
    // A rejection is shown to nobody, whatever audience the run named.
    publication: decision === 'reject' || !targets ? { publicWeb: false, kiosk: false } : targets,
    ...(note ? { note } : {}),
  };

  // The same checks the publisher applies, so a decision that could never be
  // shown is refused here, where the reviewer can fix it, not dropped later.
  const problems = decision === 'relationship'
    ? connectionProblems(tieRelationships([record])[0])
    : decision === 'context'
      ? sharedContextProblems(tieContexts([record], targets?.kiosk ? 'kiosk' : 'public')[0])
      : [];
  if (problems.length > 0) {
    errors.push(`line ${line} (${who}): ${problems.join('; ')}`);
    return;
  }
  decisions.push(record);
});

const count = (value) => decisions.filter((decision) => decision.decision === value).length;
console.log(`\nProposed-tie decisions — ${basename(inputPath)}`);
console.log(`  rows read                 ${rows.length}`);
console.log(`  left blank                ${blank}`);
console.log(`  decisions                 ${decisions.length}`);
console.log(`    relationship            ${count('relationship')}`);
console.log(`    context                 ${count('context')}`);
console.log(`    reject                  ${count('reject')}`);
if (targets) console.log(`  shown on                  ${[targets.kiosk && 'kiosk', targets.publicWeb && 'public web'].filter(Boolean).join(' and ')}`);

const replacing = decisions.filter((decision) => existingByTie.has(decision.tieId));
if (replacing.length > 0) {
  console.log(`\n  ${replacing.length} tie(s) already decided, and this would replace that decision:`);
  for (const decision of replacing.slice(0, 5)) {
    console.log(`    ${decision.tieId}: ${existingByTie.get(decision.tieId).decision} → ${decision.decision}`);
  }
  if (replacing.length > 5) console.log(`    … and ${replacing.length - 5} more`);
}
if (targets?.publicWeb) {
  console.log('\n  This publishes to the public web as well as the kiosk. That is a separate decision from the kiosk, and this is it.');
}

if (errors.length > 0) {
  console.error(`\n  ${errors.length} row(s) refused:`);
  for (const message of errors) console.error(`    ${message}`);
  console.error('\nNothing was written. Fix the sheet and run again.');
  process.exit(1);
}

if (decisions.length === 0) {
  console.log('\n  No decisions in this sheet. Nothing to do.\n');
  process.exit(0);
}

if (!apply) {
  console.log('\n  Dry run — nothing written. To apply:');
  console.log(`    npm run ties:apply -- --input=${args.input}${args.targets ? ` --targets=${args.targets}` : ''} --apply --expect-hash=${hash}`);
  console.log();
  process.exit(0);
}

const merged = new Map(existing.map((decision) => [decision.tieId, decision]));
for (const decision of decisions) merged.set(decision.tieId, decision);
const document = {
  schemaVersion: 1,
  source: 'data/review-sheets/proposed-ties-sheet.csv, applied by scripts/apply-tie-decisions.js',
  note: 'Decisions on the ties data/hof_world_person_relationships.json proposes beyond induction. Written only by npm run ties:apply.',
  decisions: [...merged.values()].sort((a, b) => a.tieId.localeCompare(b.tieId)),
};

if (existsSync(decisionsPath)) backup(decisionsPath);
writeFileSync(decisionsPath, `${JSON.stringify(document, null, 2)}\n`);

// The input that produced the diff is committed beside it, so a reviewer can
// see what was signed as well as what changed.
mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `tie-decisions-${reviewedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv);

console.log(`\n  Written to ${decisionsPath.replace(`${root}/`, '')}`);
console.log(`  Decision sheet archived to ${archived.replace(`${root}/`, '')}`);
console.log('\n  Next: npm run review:ties   (refresh the sheet; decided rows show their status)');
console.log();

// ---------------------------------------------------------------------- shared

function parseTargets(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const names = value.split(',').map((name) => name.trim()).filter(Boolean);
  const unknown = names.filter((name) => name !== 'kiosk' && name !== 'public-web');
  if (unknown.length > 0) {
    console.error(`\n"${unknown.join(', ')}" is not a target — use kiosk, public-web, or both.`);
    process.exit(1);
  }
  return { publicWeb: names.includes('public-web'), kiosk: names.includes('kiosk') };
}

function readDecisionRows(text) {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return [];
  const header = parsed[0].map((cell) => cell.trim());
  const required = ['tieId', 'decision', 'kind', 'label', 'inverseLabel', 'decisionReference'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    console.error(`\nThis CSV is missing the column(s): ${missing.join(', ')}`);
    console.error('Regenerate the sheet with: npm run review:ties');
    process.exit(1);
  }
  return parsed.slice(1).map((cells) => {
    const record = {};
    header.forEach((column, index) => { record[column] = cells[index] ?? ''; });
    return record;
  });
}

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
  if (dirty.length > 10) console.error(`  … and ${dirty.length - 10} more`);
  console.error('\nCommit, stash or discard them first, so this decision arrives as its own diff.');
  process.exit(1);
}

function backup(path) {
  if (args.noBackup) return;
  const target = `${path}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  copyFileSync(path, target);
  console.log(`  Backup written to ${target.replace(`${root}/`, '')}`);
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

function printUsage() {
  console.error('\nUsage:');
  console.error('  npm run ties:apply -- --input=data/review-sheets/proposed-ties-sheet.csv --targets=kiosk');
  console.error('  npm run ties:apply -- --input=… --targets=kiosk --apply --expect-hash=<sha256>');
  console.error('\nDry run is the default. Nothing is written without --apply.');
}
