import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { imageFacts } from '../packages/pipeline/src/build/images.ts';

/**
 * Records each image's checksum and pixel size in data/media_manifest.json,
 * read from the file the manifest names.
 *
 *   npm run portraits:record                        preview every image
 *   npm run portraits:record -- --ids=<id>,<id>     only these people
 *   npm run portraits:record -- … --decision-reference=<ref> --apply
 *
 * To replace a portrait, put the new file where the manifest says the old one
 * is (public/media/images/<id>/primary.jpg) and run this. A replaced file is a
 * different image, and the rights decision for the old one did not cover it,
 * so a changed checksum needs --decision-reference naming the decision that
 * approved the new image. It is stored on the image entry.
 *
 * It never changes a rights or approval state. A missing file is an error.
 */

const args = parseArgs(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'data/media_manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const only = typeof args.ids === 'string' ? new Set(args.ids.split(',').map((id) => id.trim()).filter(Boolean)) : null;
const reference = typeof args.decisionReference === 'string' ? args.decisionReference.trim() : '';

if (only) {
  const unknown = [...only].filter((id) => !manifest.assets?.[id]);
  if (unknown.length > 0) fail(`No media record for: ${unknown.join(', ')}`);
}

const missing = [];
const replaced = [];
const resized = [];
let checked = 0;

for (const [id, asset] of Object.entries(manifest.assets ?? {})) {
  if (only && !only.has(id)) continue;
  const images = [asset.images?.primary, ...(asset.images?.gallery ?? [])].filter(Boolean);
  for (const image of images) {
    checked += 1;
    const path = resolve(root, image.filePath ?? '');
    if (!image.filePath || !existsSync(path)) {
      missing.push(`${id}: ${image.filePath || '(no filePath)'}`);
      continue;
    }
    const facts = imageFacts(readFileSync(path));
    if (facts.checksumSha256 !== image.checksumSha256) {
      replaced.push({ id, image, facts });
    } else if (facts.width !== image.width || facts.height !== image.height) {
      resized.push({ id, image, facts });
    }
  }
}

console.log(`\n  ${checked} image(s) checked${only ? ` for ${only.size} ${only.size === 1 ? 'person' : 'people'}` : ''}.`);
for (const { id, image, facts } of replaced) {
  console.log(`  ${id}: ${image.filePath} is a different file` +
    `${image.checksumSha256 ? '' : ' (no checksum recorded)'}: ${facts.width}×${facts.height}, sha256 ${facts.checksumSha256.slice(0, 12)}…`);
}
for (const { id, image, facts } of resized) {
  console.log(`  ${id}: ${image.filePath} size recorded as ${image.width}×${image.height}, is ${facts.width}×${facts.height}`);
}
if (replaced.length === 0 && resized.length === 0) console.log('  Every checksum and size already matches its file.');

const errors = [];
if (missing.length > 0) errors.push(`${missing.length} image file(s) missing:\n    ${missing.join('\n    ')}`);
const needsReference = replaced.some(({ image }) => image.checksumSha256);
if (needsReference && !reference) {
  errors.push('A portrait file was replaced. Name the decision that approved the new image with --decision-reference=<reference>.');
}
if (replaced.some(({ facts }) => facts.width === null)) errors.push('A file is not a JPEG or PNG this can read.');

if (errors.length > 0) {
  for (const error of errors) console.error(`\n  ${error}`);
  console.error('\n  Nothing was written.\n');
  process.exit(1);
}
if (replaced.length === 0 && resized.length === 0) process.exit(0);

if (!args.apply) {
  console.log('\n  Preview only. Nothing was written. Add --apply to record these.\n');
  process.exit(0);
}

const recordedAt = new Date().toISOString();
for (const { image, facts } of [...replaced, ...resized]) {
  Object.assign(image, facts);
}
for (const { image } of replaced) {
  if (reference) Object.assign(image, { decisionReference: reference, replacedAt: recordedAt });
}
if (!args.noBackup) copyFileSync(manifestPath, `${manifestPath}.backup-${recordedAt.replace(/[:.]/g, '-')}`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n  Recorded in data/media_manifest.json. Next: npm run media:validate\n`);

function fail(message) {
  console.error(`\n  ${message}\n`);
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
