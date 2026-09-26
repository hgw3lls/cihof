import { createHash } from 'node:crypto';
import { projectStatus } from './working-tree.js';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { parseCsv } from './data-utils.js';

/**
 * Records a sign-off someone gave outside the staff review app: who signed,
 * on what date, and what the signature rests on.
 *
 *   id,action,by,date,reference,scan,note
 *
 *   sign   records the signature. `by` and `date` (YYYY-MM-DD, not in the
 *          future) are required, with a `reference` (where the signed record
 *          is kept) or a `scan` of it, or both.
 *   clear  removes a signature recorded by mistake, or one that no longer
 *          holds (the display moved, and the sheet must be signed again).
 *
 * A scan is copied into data/curation-decisions/signoffs/, beside the other
 * signed decisions, and named for the sign-off and the date. The entry's
 * reference is that file unless another reference is given.
 *
 * The same gates as the other sheets:
 *
 *   1. a preview is the default; --apply is required to write
 *   2. --apply requires --expect-hash matching the sheet that was previewed
 *   3. --apply refuses on a dirty working tree, so the diff it makes is its own
 *
 *   npm run signoffs:apply -- --input=<sheet>
 *   npm run signoffs:apply -- --input=… --apply --expect-hash=<sha256>
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const signoffsPath = resolve(root, 'data/cihof_opening_signoffs.json');
const scansDir = resolve(root, 'data/curation-decisions/signoffs');
const archiveDir = resolve(root, 'data/curation-decisions');
const scanTypes = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const inputPath = args.input ? resolve(args.input) : '';

if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  npm run signoffs:apply -- --input=<sheet>');
  console.error('  npm run signoffs:apply -- --input=… --apply --expect-hash=<sha256>');
  console.error('\nThe sheet: id,action,by,date,reference,scan,note');
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

const document = JSON.parse(readFileSync(signoffsPath, 'utf8'));
const byId = new Map((document.items ?? []).map((item) => [item.id, item]));
const today = new Date().toISOString().slice(0, 10);
const errors = [];
const changes = [];
const seen = new Set();

readRows(csv).forEach((row, index) => {
  const line = index + 2;
  const id = (row.id ?? '').trim();
  const action = (row.action ?? '').trim().toLowerCase();
  if (!id) return;
  if (action === '' || action === 'skip') return;
  const item = byId.get(id);
  if (!item) { errors.push(`line ${line}: no sign-off called "${id}"`); return; }
  if (seen.has(id)) { errors.push(`line ${line}: "${id}" appears twice`); return; }
  seen.add(id);
  const note = (row.note ?? '').trim();
  if (action === 'clear') {
    if (!item.signed) { errors.push(`line ${line} (${item.title}): is not signed, so there is nothing to clear`); return; }
    if (!note) { errors.push(`line ${line} (${item.title}): say why the signature is cleared`); return; }
    changes.push({ item, action, note });
    return;
  }
  if (action !== 'sign') { errors.push(`line ${line}: action is sign, clear or empty, not "${action}"`); return; }
  const by = (row.by ?? '').trim();
  const date = (row.date ?? '').trim();
  const reference = (row.reference ?? '').trim();
  const scan = (row.scan ?? '').trim();
  if (!by) { errors.push(`line ${line} (${item.title}): who signed?`); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) { errors.push(`line ${line} (${item.title}): "${date}" is not a date (YYYY-MM-DD)`); return; }
  if (date > today) { errors.push(`line ${line} (${item.title}): ${date} is in the future`); return; }
  if (!reference && !scan) { errors.push(`line ${line} (${item.title}): say where the signed record is kept, or attach a scan of it`); return; }
  let scanFrom = null;
  if (scan) {
    scanFrom = resolve(root, scan);
    const allowed = [resolve(root, '.review/uploads'), archiveDir].some((dir) => scanFrom.startsWith(dir + sep));
    if (!allowed) { errors.push(`line ${line} (${item.title}): the scan must come from the review app's uploads or data/curation-decisions/`); return; }
    if (!existsSync(scanFrom)) { errors.push(`line ${line} (${item.title}): no file at ${scan}`); return; }
    if (!scanTypes.has(extname(scanFrom).toLowerCase())) { errors.push(`line ${line} (${item.title}): a scan is a PDF, JPEG or PNG`); return; }
  }
  changes.push({ item, action, by, date, reference, scanFrom, note });
});

console.log(`\nSign-offs — ${relative(root, inputPath)}`);
for (const change of changes) {
  console.log(change.action === 'clear'
    ? `  ${change.item.title}: signature cleared (${change.note})`
    : `  ${change.item.title}: signed by ${change.by} on ${change.date}${change.scanFrom ? ', with a scan' : ''}`);
}
if (errors.length > 0) {
  console.error(`\n  ${errors.length} row(s) refused:`);
  for (const message of errors) console.error(`    ${message}`);
  console.error('\nNothing was written. Fix the sheet and run again.');
  process.exit(1);
}
if (changes.length === 0) {
  console.log('  Nothing to do.\n');
  process.exit(0);
}
if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. To apply:');
  console.log(`    npm run signoffs:apply -- --input=${args.input} --apply --expect-hash=${hash}\n`);
  process.exit(0);
}

const recordedAt = new Date().toISOString();
for (const change of changes) {
  if (change.action === 'clear') {
    change.item.signed = null;
    change.item.cleared = { at: recordedAt, note: change.note };
    continue;
  }
  let scanPath = null;
  if (change.scanFrom) {
    mkdirSync(scansDir, { recursive: true });
    const extension = extname(change.scanFrom).toLowerCase().replace('.jpeg', '.jpg');
    let target = resolve(scansDir, `${change.item.id}-${change.date}${extension}`);
    for (let n = 2; existsSync(target); n += 1) target = resolve(scansDir, `${change.item.id}-${change.date}-${n}${extension}`);
    copyFileSync(change.scanFrom, target);
    scanPath = relative(root, target).split(sep).join('/');
  }
  change.item.signed = {
    by: change.by,
    date: change.date,
    reference: change.reference || scanPath,
    ...(scanPath ? { scan: scanPath } : {}),
    ...(change.note ? { note: change.note } : {}),
    recordedAt,
  };
  delete change.item.cleared;
}
writeFileSync(signoffsPath, `${JSON.stringify(document, null, 2)}\n`);

mkdirSync(archiveDir, { recursive: true });
const archived = resolve(archiveDir, `signoff-decisions-${recordedAt.replace(/[:.]/g, '-')}.csv`);
writeFileSync(archived, csv.endsWith('\n') ? csv : `${csv}\n`);

console.log('\n  Written to data/cihof_opening_signoffs.json');
console.log(`  The sheet is archived as ${relative(root, archived)}`);
console.log('  Next: npm run readiness, review the diff, commit.\n');

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

function readRows(text) {
  const [header = [], ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
  const names = header.map((cell) => cell.trim());
  return rows.map((cells) => Object.fromEntries(names.map((name, index) => [name, cells[index] ?? ''])));
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
