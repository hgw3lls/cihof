import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Writes the release manifest the service worker precaches from, and stamps the
 * worker with the release it belongs to.
 *
 * Precaching from a manifest rather than caching opportunistically is what lets
 * a provisioned display open a person it has never visited while offline. A
 * worker that only caches what someone already fetched cannot do that, and
 * cannot say whether it is ready.
 */
const dist = resolve('dist');
const base = process.env.CIHOF_BASE_PATH ?? '/cihof/';

const files = [];
walk(dist);

const assets = files
  .map((path) => {
    const relativePath = relative(dist, path).split('\\').join('/');
    return { path: `${base}${relativePath}`, sha256: sha256(path), bytes: statSync(path).size };
  })
  .filter((asset) => !asset.path.endsWith('/sw.js') && !asset.path.endsWith('/release.json'))
  .sort((a, b) => a.path.localeCompare(b.path));

// The release identifies the exact bytes, so a rebuild of identical sources
// produces an identical release and a device can tell "new release" from
// "same release, served again".
const revision = createHash('sha256').update(assets.map((a) => `${a.path}:${a.sha256}`).join('\n')).digest('hex').slice(0, 16);
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);

writeFileSync(join(dist, 'release.json'), `${JSON.stringify({ revision, base, assets }, null, 2)}\n`);

const worker = readFileSync(resolve('src/sw.js'), 'utf8').replace('__CIHOF_RELEASE__', revision);
writeFileSync(join(dist, 'sw.js'), worker);

console.log(`Release ${revision}: ${assets.length} assets, ${(totalBytes / 1e6).toFixed(1)} MB precached.`);

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path); else if (entry.isFile()) files.push(path);
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
