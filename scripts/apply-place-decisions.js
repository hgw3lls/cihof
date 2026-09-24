import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { parseCsv } from './data-utils.js';

/**
 * Writes place review decisions into the canonical data.
 *
 * Two sheets, because there are two questions and they have different shapes.
 * A place carries one approval; a place carries many ties. The sheet is
 * recognised by its header rather than by a flag, so a curator cannot apply one
 * as though it were the other.
 *
 *   data/review-sheets/places-review-sheet.csv   approve, decisionReference  -> data/cihof_places.json
 *   data/review-sheets/place-ties-sheet.csv      role, decisionReference     -> data/cihof_place_associations.json
 *
 * It refuses to invent what makes an approval an approval. A row that approves
 * with no decisionReference is rejected rather than written with a placeholder,
 * and a role outside the vocabulary is rejected rather than coerced —
 * `associated` included, which is refused downstream anyway because it does not
 * say what the person did there.
 *
 * Same three gates as the other decision tools: dry run by default,
 * --expect-hash on apply so nothing lands unpreviewed, and a clean tree so the
 * change arrives as its own diff.
 *
 *   node scripts/apply-place-decisions.js --input=data/review-sheets/places-review-sheet.csv
 *   node scripts/apply-place-decisions.js --input=… --apply --expect-hash=<sha>
 */

const roles = ['lived', 'worked', 'studied', 'taught', 'organized', 'served', 'founded'];

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const root = resolve(import.meta.dirname, '..');
const inputPath = args.input ? resolve(args.input) : '';

if (!inputPath || !existsSync(inputPath)) {
  console.error('\nUsage:');
  console.error('  node scripts/apply-place-decisions.js --input=data/review-sheets/places-review-sheet.csv');
  console.error('  node scripts/apply-place-decisions.js --input=data/review-sheets/place-ties-sheet.csv');
  console.error('\nDry run is the default. Nothing is written without --apply.');
  process.exit(1);
}

const csv = readFileSync(inputPath, 'utf8');
const hash = createHash('sha256').update(csv).digest('hex');
const rows = readRows(csv);
const header = Object.keys(rows[0] ?? {});

const isPlaces = header.includes('approve') && header.includes('placeId');
const isTies = header.includes('role') && header.includes('person');
if (!isPlaces && !isTies) {
  console.error('\nThis CSV is neither sheet: a places sheet has `approve` and `placeId`,');
  console.error('a ties sheet has `role` and `person`. Regenerate with: npm run review:places');
  process.exit(1);
}

if (apply) {
  if (args.expectHash !== hash) {
    console.error('\nThis CSV has not been previewed, or it changed since it was.');
    console.error(`  its hash now: ${hash}`);
    if (args.expectHash) console.error(`  you passed:   ${args.expectHash}`);
    console.error(`\nRun the dry run first:\n  node scripts/apply-place-decisions.js --input=${args.input}`);
    process.exit(1);
  }
  requireCleanTree();
}

const errors = [];
const changes = [];

if (isPlaces) applyPlaces(); else applyTies();

// ------------------------------------------------------------------- places

function applyPlaces() {
  const path = resolve(root, 'data/cihof_places.json');
  const document = JSON.parse(readFileSync(path, 'utf8'));
  const byId = new Map((document.places ?? []).map((place) => [place.id, place]));

  rows.forEach((row, index) => {
    const line = index + 2;
    const placeId = (row.placeId ?? '').trim();
    const decision = (row.approve ?? '').trim().toLowerCase();
    if (!placeId || decision === '' || decision === 'skip') return;

    const place = byId.get(placeId);
    if (!place) { errors.push(`line ${line}: no place with id ${placeId}`); return; }

    const reference = (row.decisionReference ?? '').trim();
    if (!reference) { errors.push(`line ${line} (${place.name}): approved with no decisionReference`); return; }

    if (!['yes', 'approve', 'approved', 'true'].includes(decision)) {
      errors.push(`line ${line} (${place.name}): "${decision}" is not an approval — use yes, or leave blank to skip`);
      return;
    }
    // A place with no history publishes a name and an empty paragraph. The
    // sheet bands these as leads; approving one anyway is refused here too,
    // because the sheet is editable and the band is a column.
    if (!String(place.shortHistory ?? '').trim()) {
      errors.push(`line ${line} (${place.name}): has no short history, so approving it would publish a blank`);
      return;
    }
    changes.push({ place, reference, note: (row.note ?? '').trim() });
  });

  report('places', changes.length, `${changes.length} place(s) would be approved`);
  if (!finish()) return;

  for (const change of changes) {
    change.place.review = {
      status: 'approved',
      decisionReference: change.reference,
      contentVersion: args.contentVersion ? String(args.contentVersion) : 'places-v1',
      reviewedAt: new Date().toISOString(),
      ...(change.note ? { note: change.note } : {}),
    };
    // Reviewed for the wall. The public web is a separate decision, as it is
    // for films and for relationships.
    change.place.publication = { publicWeb: false, kiosk: true };
  }
  write(path, document);
}

// --------------------------------------------------------------------- ties

function applyTies() {
  const path = resolve(root, 'data/cihof_place_associations.json');
  const document = JSON.parse(readFileSync(path, 'utf8'));
  const index = new Map(document.associations.map((tie) => [`${tie.person}|${tie.place}`, tie]));

  rows.forEach((row, index_) => {
    const line = index_ + 2;
    const person = (row.person ?? '').trim();
    const placeId = (row.placeId ?? '').trim();
    const role = (row.role ?? '').trim().toLowerCase();
    if (!person || !placeId || role === '' || role === 'skip') return;

    const tie = index.get(`${person}|${placeId}`);
    if (!tie) { errors.push(`line ${line}: no tie between ${person} and ${placeId}`); return; }

    const reference = (row.decisionReference ?? '').trim();
    if (!reference) { errors.push(`line ${line} (${person} at ${placeId}): a role with no decisionReference`); return; }

    if (role === 'associated') {
      errors.push(`line ${line} (${person} at ${placeId}): "associated" does not say what the person did there`);
      return;
    }
    if (!roles.includes(role)) {
      errors.push(`line ${line} (${person} at ${placeId}): "${role}" is not a role — use ${roles.join(', ')}`);
      return;
    }
    changes.push({ tie, role, reference, note: (row.note ?? '').trim() });
  });

  report('ties', changes.length, `${changes.length} tie(s) would be given a role`);
  if (!finish()) return;

  for (const change of changes) {
    change.tie.role = change.role;
    change.tie.review = {
      status: 'approved',
      decisionReference: change.reference,
      contentVersion: args.contentVersion ? String(args.contentVersion) : 'places-v1',
      reviewedAt: new Date().toISOString(),
      ...(change.note ? { note: change.note } : {}),
    };
    change.tie.publication = { publicWeb: false, kiosk: true };
    // A tie is a claim about a person, so it cites what it rests on. The
    // harvested prose becomes a citation rather than staying a sentence.
    change.tie.evidence = (change.tie.evidence ?? []).map((entry, position) => ({
      id: `${change.tie.id}:src${position}`,
      title: entry.text || 'HOF_WORLD place association',
      kind: 'secondary-source',
      ...(entry.sourceUrls?.[0] ? { url: entry.sourceUrls[0] } : {}),
    }));
  }
  write(path, document);
}

// ------------------------------------------------------------------- shared

function report(what, count, summary) {
  console.log(`\nPlace decisions — ${basename(inputPath)} (${what})`);
  console.log(`  rows read                 ${rows.length}`);
  console.log(`  decisions                 ${count}`);
  console.log(`  ${summary}`);
}

function finish() {
  if (errors.length > 0) {
    console.error(`\n  ${errors.length} row(s) refused:`);
    for (const message of errors) console.error(`    ${message}`);
    console.error('\nNothing was written. Fix the sheet and run again.');
    process.exit(1);
  }
  if (changes.length === 0) {
    console.log('\n  Nothing to apply.');
    console.log();
    return false;
  }
  if (!apply) {
    console.log(`\n  Dry run — nothing written. To apply:`);
    console.log(`    node scripts/apply-place-decisions.js --input=${args.input} --apply --expect-hash=${hash}`);
    console.log();
    return false;
  }
  return true;
}

function write(path, document) {
  copyFileSync(path, `${path}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
  const decisions = resolve(root, 'data/curation-decisions');
  mkdirSync(decisions, { recursive: true });
  writeFileSync(resolve(decisions, `place-decisions-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`), csv);
  console.log(`\n  Wrote ${path.replace(`${root}/`, '')}`);
  console.log('  Decision sheet archived beside it.');
  console.log('\n  Next: npm run review:places   (see whether the lens opens)');
  console.log();
}

function readRows(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const columns = rows[0].map((cell) => cell.trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    columns.forEach((column, index) => { record[column] = cells[index] ?? ''; });
    return record;
  });
}

function requireCleanTree() {
  let status;
  try {
    status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  } catch { return; }
  const dirty = status.split('\n').filter((line) => line.trim().length > 0);
  if (dirty.length === 0) return;
  console.error('\nThe working tree has uncommitted changes:');
  for (const line of dirty.slice(0, 10)) console.error(`  ${line}`);
  console.error('\nCommit, stash or discard them first, so this decision arrives as its own diff.');
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
