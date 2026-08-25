import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const distDir = resolve(args.find((arg) => !arg.startsWith('--')) ?? 'dist');
const errors = [];
const warnings = [];
const localAssetRefs = new Map();
const remoteAssetRefs = [];

requireFile('index.html');
requireDirectory('assets');
requireFile('data/cihof-runtime-data.json');

const bundlePath = resolve(distDir, 'data/cihof-runtime-data.json');
const bundle = existsSync(bundlePath) ? readJson(bundlePath, 'runtime data bundle') : null;

if (bundle) {
  if (!Array.isArray(bundle.inductees)) {
    errors.push('Runtime data bundle must include an inductees array.');
  } else {
    bundle.inductees.forEach((person, index) => collectPersonAssetRefs(person, index));
  }

  collectMediaManifestRefs(bundle.mediaManifest);
  collectStorySectionRefs(bundle.storySections);
}

collectIndexAssetRefs();
validateLocalAssetRefs();

if (remoteAssetRefs.length > 0) {
  warnings.push(
    `${remoteAssetRefs.length} remote media reference${remoteAssetRefs.length === 1 ? '' : 's'} remain in the runtime bundle. These are allowed but require cache or imported local data for fully offline playback.`,
  );
}

if (warnings.length > 0) {
  warnings.slice(0, 20).forEach((warning) => console.warn(`Warning: ${warning}`));
  if (warnings.length > 20) console.warn(`Warning: ...and ${warnings.length - 20} more`);
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

const inducteeCount = Array.isArray(bundle?.inductees) ? bundle.inductees.length : 0;
const relationshipCount = Array.isArray(bundle?.relationships) ? bundle.relationships.length : 0;
console.log(`CIHOF offline package validation passed for ${distDir}.`);
console.log(`${inducteeCount} profiles, ${relationshipCount} relationships, ${localAssetRefs.size} local asset references checked.`);

function requireFile(path) {
  const filePath = resolve(distDir, path);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) errors.push(`Missing built file: ${path}`);
}

function requireDirectory(path) {
  const directoryPath = resolve(distDir, path);
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) errors.push(`Missing built directory: ${path}`);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    errors.push(`Could not read ${label}: ${error.message}`);
    return null;
  }
}

function collectPersonAssetRefs(person, index) {
  if (!person || typeof person !== 'object') {
    errors.push(`Runtime inductee at index ${index} must be an object.`);
    return;
  }

  const label = person.id || `inductee-${index}`;
  collectAssetRef(person.primaryImageUrl, `${label}.primaryImageUrl`);
  collectArrayRefs(person.imageUrls, `${label}.imageUrls`);
  collectArrayRefs(person.localImagePaths, `${label}.localImagePaths`);
  collectArrayRefs(person.videoUrls, `${label}.videoUrls`);
  collectArrayRefs(person.localVideoPaths, `${label}.localVideoPaths`);
}

function collectMediaManifestRefs(mediaManifest) {
  if (!mediaManifest || typeof mediaManifest !== 'object' || !mediaManifest.assets || typeof mediaManifest.assets !== 'object') return;

  Object.entries(mediaManifest.assets).forEach(([personId, asset]) => {
    if (!asset || typeof asset !== 'object') return;
    collectImageRecord(asset.images?.primary, `${personId}.media.images.primary`);
    if (Array.isArray(asset.images?.gallery)) {
      asset.images.gallery.forEach((image, index) => collectImageRecord(image, `${personId}.media.images.gallery.${index}`));
    }
    if (Array.isArray(asset.videos)) {
      asset.videos.forEach((video, index) => {
        collectAssetRef(video?.runtimePath, `${personId}.media.videos.${index}.runtimePath`);
        collectAssetRef(video?.posterRuntimePath, `${personId}.media.videos.${index}.posterRuntimePath`);
        collectAssetRef(video?.captionRuntimePath, `${personId}.media.videos.${index}.captionRuntimePath`);
        collectAssetRef(video?.transcriptRuntimePath, `${personId}.media.videos.${index}.transcriptRuntimePath`);
      });
    }
  });
}

function collectImageRecord(image, label) {
  if (!image || typeof image !== 'object') return;
  collectAssetRef(image.runtimePath, `${label}.runtimePath`);
  collectAssetRef(image.sourceUrl, `${label}.sourceUrl`);
}

function collectStorySectionRefs(storySections) {
  if (!storySections || typeof storySections !== 'object' || !Array.isArray(storySections.records)) return;
  storySections.records.forEach((record) => {
    if (!record || typeof record !== 'object' || !Array.isArray(record.beats)) return;
    record.beats.forEach((beat, index) => collectAssetRef(beat?.imageUrl, `${record.personId}.story.beats.${index}.imageUrl`));
  });
}

function collectIndexAssetRefs() {
  const indexPath = resolve(distDir, 'index.html');
  if (!existsSync(indexPath)) return;
  const html = readFileSync(indexPath, 'utf8');
  const matches = html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g);
  for (const match of matches) {
    collectAssetRef(match[1], `index.html:${match[0].slice(0, 18)}`);
  }
}

function collectArrayRefs(value, label) {
  if (!Array.isArray(value)) return;
  value.forEach((item, index) => collectAssetRef(item, `${label}.${index}`));
}

function collectAssetRef(value, label) {
  if (typeof value !== 'string') return;
  const reference = value.trim();
  if (!reference || reference.startsWith('data:') || reference.startsWith('mailto:') || reference.startsWith('tel:')) return;
  if (/^https?:\/\//i.test(reference)) {
    remoteAssetRefs.push({ label, reference });
    return;
  }

  const cleaned = normalizeBuiltPath(reference);
  if (!cleaned) return;
  if (!isPackageAssetPath(cleaned)) return;
  localAssetRefs.set(cleaned, [...(localAssetRefs.get(cleaned) ?? []), label]);
}

function normalizeBuiltPath(reference) {
  let cleaned = reference.split(/[?#]/)[0];
  if (!cleaned || cleaned === '/') return '';
  cleaned = cleaned.replace(/^\/cihof\//, '');
  cleaned = cleaned.replace(/^\.\//, '');
  cleaned = cleaned.replace(/^\//, '');
  return cleaned;
}

function isPackageAssetPath(path) {
  return path.startsWith('assets/') || path.startsWith('data/') || path.startsWith('media/') || path.startsWith('risograph-icons/');
}

function validateLocalAssetRefs() {
  localAssetRefs.forEach((labels, path) => {
    if (existsSync(resolve(distDir, path))) return;
    errors.push(`Missing local asset "${path}" referenced by ${labels.slice(0, 4).join(', ')}${labels.length > 4 ? ', ...' : ''}.`);
  });

  const assetFiles = existsSync(resolve(distDir, 'assets')) ? readdirSync(resolve(distDir, 'assets')) : [];
  if (assetFiles.length === 0) errors.push('Built assets directory is empty.');
}
