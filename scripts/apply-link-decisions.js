import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { parseCsv } from './data-utils.js';
import { buildPeople } from '../packages/pipeline/src/build/people.ts';

/**
 * Writes induction review decisions into the canonical crosswalk.
 *
 * The sheet at `data/review-sheets/links-review-sheet.csv` is where a curator says who each
 * recorded name is. This is the only thing that moves those answers into
 * `data/cihof_induction_crosswalk.json`, and it does so as an ordinary file
 * change, so every decision arrives as a diff somebody can read in a pull
 * request.
 *
 * It refuses to invent the two fields that make an approval an approval. A row
 * that names a person but no decision reference is rejected rather than written
 * with a placeholder: `decisionReference` exists to trace a claim to whoever
 * made it, and a generated one would trace it to nobody while looking as though
 * it traced to someone.
 *
 * Gates, in the order they are checked — the same three the old staff portal
 * applied to curation and media decisions, implemented here because a curator
 * signing 25 rows should not have to run a server to do it:
 *
 *   1. dry run is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the CSV, so nothing is applied
 *      that was not first previewed
 *   3. --apply refuses on a dirty working tree, so the diff it produces is its
 *      own
 *
 *   node scripts/apply-link-decisions.js --input=data/review-sheets/links-review-sheet.csv
 *   node scripts/apply-link-decisions.js --input=… --apply --expect-hash=<sha>
 *
 * Signing the publication decision is a separate act and has its own flags:
 *
 *   node scripts/apply-link-decisions.js --sign-publication \
 *     --decision-reference=cur-2026-061 --content-version=v7 --targets=kiosk --apply
 */

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const root = resolve(import.meta.dirname, '..');
const crosswalkPath = resolve(root, 'data/cihof_induction_crosswalk.json');
const decisionsDir = resolve(root, 'data/curation-decisions');

if (!existsSync(crosswalkPath)) {
  console.error(`No crosswalk at ${crosswalkPath}. Run: npm run crosswalk`);
  process.exit(1);
}
const crosswalk = JSON.parse(readFileSync(crosswalkPath, 'utf8'));

if (args.signPublication) {
  signPublicationDecision();
} else {
  applyResolutions();
}

// ---------------------------------------------------------------- resolutions

function applyResolutions() {
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
      console.error('\nRun the dry run first, then pass the hash it prints:');
      console.error(`  node scripts/apply-link-decisions.js --input=${args.input}`);
      process.exit(1);
    }
    requireCleanTree();
  }

  const byName = new Map(crosswalk.entries.map((entry) => [entry.recordedName, entry]));
  const known = readKnownInducteeIds();
  const rows = readDecisionRows(csv);
  const errors = [];
  const changes = [];
  let blank = 0;

  rows.forEach((row, index) => {
    const line = index + 2;
    const recordedName = (row.recordedName ?? '').trim();
    const decision = (row.decision ?? '').trim().toLowerCase();
    if (!recordedName) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }

    const entry = byName.get(recordedName);
    if (!entry) {
      errors.push(`line ${line}: no crosswalk row is recorded as "${recordedName}"`);
      return;
    }

    const reference = (row.decisionReference ?? '').trim();
    if (!reference) {
      // The whole point of the gate. Never defaulted, never generated.
      errors.push(`line ${line} (${recordedName}): decided "${decision}" with no decisionReference`);
      return;
    }

    const note = (row.note ?? '').trim();
    const status = normaliseDecision(decision);
    if (!status) {
      errors.push(`line ${line} (${recordedName}): "${decision}" is not a decision — use inductee, not-an-inductee, unidentifiable or skip`);
      return;
    }

    if (status === 'inductee') {
      const inducteeId = (row.inducteeId ?? '').trim();
      if (!inducteeId) {
        errors.push(`line ${line} (${recordedName}): resolved to an inductee but no inducteeId given`);
        return;
      }
      if (!known.has(inducteeId)) {
        errors.push(`line ${line} (${recordedName}): ${inducteeId} is not on the roster`);
        return;
      }
      const yields = entry.inducted.filter((id) => id !== inducteeId).length;
      if (yields === 0) {
        errors.push(`line ${line} (${recordedName}): resolving to ${inducteeId} yields no relationship — this row records them as inducting only themselves`);
        return;
      }
      changes.push({
        entry, recordedName, yields,
        resolution: {
          status: 'inductee', inducteeId, decisionReference: reference,
          decidedAt: new Date().toISOString(),
          ...(note ? { note } : {}),
        },
      });
      return;
    }

    changes.push({
      entry, recordedName, yields: 0,
      resolution: { status, decisionReference: reference, decidedAt: new Date().toISOString(), ...(note ? { note } : {}) },
    });
  });

  console.log(`\nInduction review decisions — ${basename(inputPath)}`);
  console.log(`  rows read                 ${rows.length}`);
  console.log(`  left blank                ${blank}`);
  console.log(`  decisions                 ${changes.length}`);
  const resolving = changes.filter((change) => change.resolution.status === 'inductee');
  console.log(`    resolved to an inductee ${resolving.length}`);
  console.log(`    not an inductee         ${changes.filter((c) => c.resolution.status === 'not-an-inductee').length}`);
  console.log(`    unidentifiable          ${changes.filter((c) => c.resolution.status === 'unidentifiable').length}`);
  console.log(`  relationships they yield  ${resolving.reduce((sum, change) => sum + change.yields, 0)}`);

  const overwriting = changes.filter((change) => change.entry.resolution.status !== 'unresolved');
  if (overwriting.length > 0) {
    console.log(`\n  ${overwriting.length} row(s) already decided, and this would replace that decision:`);
    for (const change of overwriting.slice(0, 5)) console.log(`    ${change.recordedName}`);
    if (overwriting.length > 5) console.log(`    … and ${overwriting.length - 5} more`);
  }

  if (errors.length > 0) {
    console.error(`\n  ${errors.length} row(s) refused:`);
    for (const message of errors) console.error(`    ${message}`);
    console.error('\nNothing was written. Fix the sheet and run again.');
    process.exit(1);
  }

  if (!apply) {
    console.log(`\n  Dry run — nothing written. To apply:`);
    console.log(`    node scripts/apply-link-decisions.js --input=${args.input} --apply --expect-hash=${hash}`);
    console.log();
    return;
  }

  for (const change of changes) change.entry.resolution = change.resolution;
  backup(crosswalkPath);
  writeFileSync(crosswalkPath, `${JSON.stringify(crosswalk, null, 2)}\n`);

  // The input that produced the diff is committed beside it, so a reviewer can
  // see what was signed as well as what changed.
  mkdirSync(decisionsDir, { recursive: true });
  const archived = resolve(decisionsDir, `link-decisions-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  writeFileSync(archived, csv);

  console.log(`\n  Written to ${crosswalkPath.replace(`${root}/`, '')}`);
  console.log(`  Decision sheet archived to ${archived.replace(`${root}/`, '')}`);
  console.log('\n  Next: npm run review:links   (refresh the sheet and see the new count)');
  console.log();
}

// -------------------------------------------------------- publication decision

function signPublicationDecision() {
  const reference = (args.decisionReference ?? '').trim();
  const version = (args.contentVersion ?? '').trim();
  const targets = (args.targets ?? '').split(',').map((value) => value.trim()).filter(Boolean);

  const problems = [];
  if (!reference) problems.push('--decision-reference is required');
  if (!version) problems.push('--content-version is required');
  if (targets.length === 0) problems.push('--targets is required, e.g. --targets=kiosk');
  for (const target of targets) {
    if (target !== 'kiosk' && target !== 'public-web') problems.push(`"${target}" is not a target — use kiosk, public-web, or both`);
  }
  if (problems.length > 0) {
    console.error('\nCannot sign the publication decision:');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('\nThese are not defaulted. An approval that cannot be traced to a person is not an approval.');
    process.exit(1);
  }

  const publication = { publicWeb: targets.includes('public-web'), kiosk: targets.includes('kiosk') };
  const decision = { decisionReference: reference, contentVersion: version, reviewedAt: new Date().toISOString(), publication };

  console.log('\nPublication decision');
  console.log(`  decisionReference         ${reference}`);
  console.log(`  contentVersion            ${version}`);
  console.log(`  kiosk                     ${publication.kiosk}`);
  console.log(`  publicWeb                 ${publication.publicWeb}`);
  if (publication.publicWeb) {
    console.log('\n  This publishes induction relationships to the public web.');
    console.log('  All 93 films are withheld there; relationships are a separate decision, and this is it.');
  }
  if (crosswalk.publicationDecision) {
    console.log(`\n  Replacing the decision already on file (${crosswalk.publicationDecision.decisionReference}).`);
  }

  if (!apply) {
    console.log('\n  Dry run — nothing written. Add --apply to sign.');
    console.log();
    return;
  }
  requireCleanTree();

  backup(crosswalkPath);
  writeFileSync(crosswalkPath, `${JSON.stringify(withDecision(crosswalk, decision), null, 2)}\n`);
  console.log(`\n  Written to ${crosswalkPath.replace(`${root}/`, '')}`);
  console.log('\n  Next: npm run review:links   (see whether the lens opens)');
  console.log();
}

/**
 * The crosswalk with a publication decision, in the key order the builder uses.
 *
 * Assigning the property appends it after `entries`, and `crosswalk.mjs
 * --check` compares serialised JSON, which is order-sensitive. So a signature
 * written the obvious way left the file semantically identical to a rebuild and
 * textually different from one — `crosswalk:check` failed, CI went red, and the
 * fix was an unrelated-looking `npm run crosswalk`. Rebuilt here in the
 * declared order instead.
 */
function withDecision(source, decision) {
  const { schemaVersion, generatedAt, source: origin, entries } = source;
  return { schemaVersion, generatedAt, source: origin, publicationDecision: decision, entries };
}

// ---------------------------------------------------------------------- shared

function requireCleanTree() {
  let status;
  try {
    status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  } catch {
    // Not a git repository, or git unavailable. The gate exists to keep the
    // diff readable; where there is no diff to read, it has nothing to protect.
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

/**
 * The sheet's rows, keyed by its own header.
 *
 * `parseCsv` yields raw arrays with the header as the first row, so the
 * mapping happens here. Columns are looked up by name rather than by position
 * because a curator working in a spreadsheet may well reorder or hide them, and
 * reading the wrong column would silently resolve names to the wrong people.
 */
function readDecisionRows(csv) {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];
  const header = rows[0].map((cell) => cell.trim());
  const required = ['recordedName', 'decision', 'inducteeId', 'decisionReference'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    console.error(`\nThis CSV is missing the column(s): ${missing.join(', ')}`);
    console.error('Regenerate the sheet with: npm run review:links');
    process.exit(1);
  }
  return rows.slice(1).map((cells) => {
    const record = {};
    header.forEach((column, index) => { record[column] = cells[index] ?? ''; });
    return record;
  });
}

/**
 * The roster, by canonical id.
 *
 * From `buildPeople()` rather than the kiosk manifest, which records names and
 * derives ids downstream. Checking a resolution against anything but the ids
 * the build actually emits would accept a person the build cannot find, and the
 * relationship would vanish silently between approval and release.
 */
function readKnownInducteeIds() {
  return new Set(buildPeople().map((person) => person.id));
}

function normaliseDecision(value) {
  if (value === 'inductee' || value === 'confirm' || value === 'yes') return 'inductee';
  if (value === 'not-an-inductee' || value === 'not-inductee' || value === 'no') return 'not-an-inductee';
  if (value === 'unidentifiable' || value === 'unknown') return 'unidentifiable';
  return null;
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
  console.error('  node scripts/apply-link-decisions.js --input=data/review-sheets/links-review-sheet.csv');
  console.error('  node scripts/apply-link-decisions.js --input=… --apply --expect-hash=<sha256>');
  console.error('  node scripts/apply-link-decisions.js --sign-publication --decision-reference=… --content-version=… --targets=kiosk --apply');
  console.error('\nDry run is the default. Nothing is written without --apply.');
}
