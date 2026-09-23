import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { planMerge, readIdIndex, readPlaceAssociations, readPlaces } from '../packages/pipeline/src/sources/hofworld.ts';

/**
 * Merges curated fields from an unpacked HOF_WORLD v3 archive.
 *
 * The archive is a snapshot. This repository keeps moving, and on 2026-09-22 it
 * moved three heritage attributions that the snapshot predates. A file-level
 * copy would undo them without a word, and the parity test would only notice
 * after the commit.
 *
 * So the merge is directional and field-level, and the direction is: the
 * repository wins. A field the repository has not filled in is taken from the
 * archive; a field where the two disagree is refused and reported. There is no
 * flag to reverse that. Overwriting a curated value is a curatorial act, and it
 * belongs in `curate:apply` with a decision behind it, not in an import.
 *
 * Ids come from `_meta/id-map.json` and nowhere else. Stripping the `person:`
 * prefix looks like it works and silently drops the four people v3 renamed.
 *
 *   node scripts/ingest-hofworld.js --archive=/path/to/HOF_WORLD
 *   node scripts/ingest-hofworld.js --archive=/path/to/HOF_WORLD --apply
 *
 * Dry run is the default. --apply additionally requires a clean tree, so the
 * change it makes arrives as its own diff.
 */

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const root = resolve(import.meta.dirname, '..');
const archive = args.archive ? resolve(args.archive) : '';

if (!archive || !existsSync(archive)) {
  console.error('\nUsage:');
  console.error('  node scripts/ingest-hofworld.js --archive=/path/to/unpacked/HOF_WORLD [--apply]');
  console.error('\nThe archive stays outside this repository. Point at the unpacked directory.');
  process.exit(1);
}

const ids = readIdIndex(archive);
console.log(`\nHOF_WORLD v3 — ${archive.replace(`${root}/`, '')}`);
console.log(`  id map                    ${ids.count} people, ${ids.changed.length} renamed by the refactor`);
for (const entry of ids.changed) console.log(`    ${entry.typedId} -> ${entry.repoId}`);

// ------------------------------------------------------------ curated metadata

const targetPath = resolve(root, 'data/cihof_curated_metadata.json');
const sourcePath = resolve(archive, 'app/curated-metadata.json');
if (!existsSync(sourcePath)) {
  console.error(`\nNo curated metadata at ${sourcePath}.`);
  process.exit(1);
}

const target = JSON.parse(readFileSync(targetPath, 'utf8'));
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const sourceRecords = source.inductees ?? {};
const targetRecords = target.inductees ?? {};

const taken = [];
const refused = [];
const unmapped = [];
let identical = 0;

for (const [sourceId, sourceRecord] of Object.entries(sourceRecords)) {
  // v3's curated metadata is keyed by the bare roster id rather than a typed
  // one, so it is checked against the map both ways round: a key the map does
  // not recognise either way is reported, never guessed at.
  const repoId = ids.toRepoId(`person:${sourceId}`) ?? (targetRecords[sourceId] ? sourceId : null);
  if (!repoId || !targetRecords[repoId]) {
    unmapped.push(sourceId);
    continue;
  }

  const plan = planMerge(repoId, sourceRecord, targetRecords[repoId]);
  taken.push(...plan.taken.map((entry) => ({ ...entry, value: entry.incoming })));
  refused.push(...plan.refused);
  identical += plan.identical;
}

console.log(`\ncurated metadata`);
console.log(`  records compared          ${Object.keys(sourceRecords).length}`);
console.log(`  fields identical          ${identical}`);
console.log(`  fields the repo lacks     ${taken.length}`);
console.log(`  fields refused            ${refused.length}`);
if (unmapped.length > 0) console.log(`  records with no roster id ${unmapped.length}: ${unmapped.slice(0, 5).join(', ')}`);

if (taken.length > 0) {
  console.log(`\n  would take:`);
  for (const entry of taken.slice(0, 20)) {
    console.log(`    ${entry.repoId} ${entry.path} = ${short(entry.value)}`);
  }
  if (taken.length > 20) console.log(`    … and ${taken.length - 20} more`);
}

if (refused.length > 0) {
  console.log(`\n  refused — the repository's value stands:`);
  for (const entry of refused) {
    console.log(`    ${entry.repoId} ${entry.path}`);
    console.log(`      repo:    ${short(entry.current)}`);
    console.log(`      archive: ${short(entry.incoming)}   (${entry.why})`);
  }
  console.log('\n  To change any of these, make the decision through curate:apply.');
  console.log('  An import is not a decision, and this one will not pretend otherwise.');
}

// -------------------------------------------------------------------- places

const placesPath = resolve(root, 'data/cihof_places.json');
const placesDoc = JSON.parse(readFileSync(placesPath, 'utf8'));
const held = new Map((placesDoc.places ?? []).map((place) => [place.id, place]));
const incoming = readPlaces(archive);
const newPlaces = incoming.filter((place) => !held.has(place.id));
const researched = incoming.filter((place) => place.researched).length;

console.log(`\nplaces`);
console.log(`  in the archive            ${incoming.length}`);
console.log(`    with a short history    ${researched}`);
console.log(`    leads, no history yet   ${incoming.length - researched}`);
console.log(`  already held here         ${incoming.length - newPlaces.length}`);
console.log(`  would add as seeds        ${newPlaces.length}`);
console.log(`  none carries a review, so none becomes publishable by being added.`);

const associationsPath = resolve(root, 'data/cihof_place_associations.json');
const { associations, unresolved } = readPlaceAssociations(archive, ids);
const toResearched = associations.filter((tie) => incoming.find((p) => p.id === tie.place)?.researched).length;
const byKind = {};
for (const tie of associations) byKind[tie.kind] = (byKind[tie.kind] ?? 0) + 1;

console.log(`\nperson-to-place ties`);
console.log(`  in the archive            ${associations.length}`);
for (const [kind, count] of Object.entries(byKind)) console.log(`    ${kind.padEnd(22)}${count}`);
console.log(`  pointing at a researched place ${toResearched}`);
if (unresolved.length > 0) console.log(`  naming an unmapped person ${unresolved.length}: ${unresolved.slice(0, 3).join(', ')}`);
console.log(`  every one arrives with no role. A role is what says the person did`);
console.log(`  something there, and it is a curator's word, not a harvester's verb.`);

if (taken.length === 0 && newPlaces.length === 0 && associations.length === 0) {
  console.log('\n  Nothing to take.');
  if (!apply) console.log();
  process.exit(0);
}

if (!apply) {
  console.log(`\n  Dry run — nothing written. --apply would take ${taken.length} curated field(s),`);
  console.log(`  add ${newPlaces.length} place seed(s) and write ${associations.length} unreviewed place tie(s).`);
  console.log();
  process.exit(0);
}

requireCleanTree();

if (newPlaces.length > 0) {
  placesDoc.places = [...(placesDoc.places ?? []), ...newPlaces.map((place) => ({
    id: place.id, name: place.name, type: place.type,
    shortHistory: place.shortHistory, neighborhood: place.neighborhood,
    ...(place.address ? { address: place.address } : {}),
    provenance: { source: 'HOF_WORLD v3 core/places.json', authorityStatus: place.authorityStatus },
    researched: place.researched,
  }))];
  backupAndWrite(placesPath, placesDoc);
  console.log(`\n  Added ${newPlaces.length} place seed(s) to ${placesPath.replace(`${root}/`, '')}`);
}

writeFileSync(associationsPath, `${JSON.stringify({
  schemaVersion: 1,
  source: 'HOF_WORLD v3 edges/edges.json',
  generatedAt: new Date().toISOString(),
  note: 'Unreviewed. Every tie needs a PlaceRole and a review before it can be shown.',
  associations,
}, null, 2)}\n`);
console.log(`  Wrote ${associations.length} unreviewed tie(s) to ${associationsPath.replace(`${root}/`, '')}`);


if (taken.length > 0) {
  for (const entry of taken) put(targetRecords[entry.repoId], entry.path, entry.value);
  backupAndWrite(targetPath, target);
  console.log(`  Wrote ${targetPath.replace(`${root}/`, '')} — ${taken.length} field(s) taken, ${refused.length} refused.`);
}
console.log();

function backupAndWrite(path, document) {
  copyFileSync(path, `${path}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
}

// ----------------------------------------------------------------------- parts

function put(record, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = record;
  for (const key of keys) {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[last] = value;
}

function short(value) {
  const text = JSON.stringify(value ?? null);
  return text.length > 78 ? `${text.slice(0, 75)}…` : text;
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
  console.error('\nCommit, stash or discard them first, so this import arrives as its own diff.');
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
