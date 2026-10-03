import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractEntry, listZip, safeEntryName, writeZip } from './zip.mjs';

/**
 * The display's content, kept on the display: what it was delivered with, and
 * every update since, any of which it can go back to.
 *
 * The app's own files (the exhibit's code, fonts and look) are never changed
 * here. Content is the rest: the data the exhibit reads (`data/`), its images,
 * captions and transcripts (`media/`), the films an update brings, and the
 * source data the staff portal edits, which the display keeps so that the
 * portal can always start from what the display actually shows.
 *
 * A version is a list: which file each content path is, by its checksum. The
 * files themselves are kept once each under `blobs/`, so ten versions cost
 * only what changed between them, and going back is choosing another list.
 *
 * An update is a zip holding `content.json`, the new version's full list, and
 * `blobs/<sha256>` for each file the display does not already have. Before
 * anything changes it is checked: it must be built on the version the display
 * shows now, every file must match its checksum, and its data must be valid
 * kiosk data for this app. Then it becomes the version served, and the
 * exhibit takes it over at its next reset between visitors.
 *
 * Served to the exhibit through the release manifest and worker it already
 * understands: each version gets its own `release.json`, the delivered one
 * with the content entries replaced, and a worker stamped with that release.
 */

export const contentFormat = 'cihof-content';
export const contentFormatVersion = 1;
/** Versions kept besides the delivered one; older ones, and their files, are removed. */
export const keptVersions = 10;

const sha = /^[0-9a-f]{64}$/;
const filmFile = /\.(mp4|webm)$/i;
const isContentPath = (path) => path.startsWith('data/') || path.startsWith('media/');
const isVideoPath = (path) => path.startsWith('media/videos/') && /\.(mp4|webm|mov|m4v|mkv|ogv|avi)$/i.test(path);

/**
 * @param {{ dir: string, deliveredSite: string, deliveredSource?: string }} options
 *   `dir`: where the store lives (the app's own data folder).
 *   `deliveredSite`: the exhibit as delivered in the app.
 *   `deliveredSource`: the source data delivered with it, for the portal.
 */
export function createContentStore({ dir, deliveredSite, deliveredSource = null }) {
  const blobs = join(dir, 'blobs');
  const versions = join(dir, 'versions');
  const served = join(dir, 'served');
  const statePath = join(dir, 'state.json');
  const delivered = deliveredVersion(deliveredSite, deliveredSource);

  const readState = () => {
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      return { active: typeof state.active === 'string' ? state.active : null, history: Array.isArray(state.history) ? state.history : [] };
    } catch {
      return { active: null, history: [] };
    }
  };
  const writeState = async (state) => {
    await mkdir(dir, { recursive: true });
    const temporary = `${statePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
    await rename(temporary, statePath);
  };
  const readVersion = (id) => (id === delivered.manifest.contentVersion ? delivered.manifest : JSON.parse(readFileSync(join(versions, `${id}.json`), 'utf8')));
  const activeManifest = () => {
    const { active } = readState();
    if (!active) return null;
    try { return readVersion(active); } catch { return null; }
  };
  /** Where the file with this checksum is: in the store, or among the delivered files. */
  const blobPath = (checksum) => {
    const stored = join(blobs, checksum);
    if (existsSync(stored)) return stored;
    return delivered.files.get(checksum) ?? null;
  };

  let serving = null;
  const refreshServing = () => {
    const manifest = activeManifest();
    serving = manifest ? servingFor(manifest) : null;
  };
  const servingFor = (manifest) => {
    const folder = join(served, manifest.contentVersion);
    return {
      contentVersion: manifest.contentVersion,
      releaseJson: join(folder, 'release.json'),
      workerJs: join(folder, 'sw.js'),
      /** A content path's file in this version, or null when the version does not have it. */
      site: (path) => (manifest.site[path] ? blobPath(manifest.site[path].sha256) : null),
      film: (path) => (manifest.films?.[path] ? blobPath(manifest.films[path].sha256) : null),
    };
  };
  refreshServing();

  /** Writes the release manifest and worker the exhibit needs to take this version over. */
  const prepareServing = async (manifest) => {
    const folder = join(served, manifest.contentVersion);
    if (existsSync(join(folder, 'sw.js'))) return;
    const release = JSON.parse(readFileSync(join(deliveredSite, 'release.json'), 'utf8'));
    const shell = release.assets.filter((asset) => !isContentPath(asset.path.replace(/^\//, '')));
    const content = Object.entries(manifest.site)
      .filter(([path]) => !isVideoPath(path))
      .map(([path, file]) => ({ path: `/${path}`, sha256: file.sha256, bytes: file.bytes }));
    const assets = [...shell, ...content].sort((a, b) => a.path.localeCompare(b.path));
    // As the exhibit's own build names a release: by exactly the bytes it serves.
    const revision = createHash('sha256').update(assets.map((asset) => `${asset.path}:${asset.sha256}`).join('\n')).digest('hex').slice(0, 16);
    const worker = readFileSync(join(deliveredSite, 'sw.js'), 'utf8');
    if (!worker.includes(release.revision)) throw new Error('The delivered worker does not name its release, so a new one cannot be made from it.');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'release.json'), `${JSON.stringify({ revision, base: release.base, assets }, null, 2)}\n`);
    await writeFile(join(folder, 'sw.js'), worker.replaceAll(release.revision, revision));
  };

  return {
    delivered: delivered.manifest,

    /** What the server should serve instead of the delivered content, or null for the delivered content. */
    serving: () => serving,

    /** Where things stand, for the admin panel. */
    state() {
      const state = readState();
      const describe = (manifest) => ({
        contentVersion: manifest.contentVersion,
        basedOn: manifest.basedOn ?? null,
        createdAt: manifest.createdAt ?? null,
        createdBy: manifest.createdBy ?? null,
        summary: manifest.summary ?? [],
        people: manifest.people ?? null,
        films: Object.keys(manifest.films ?? {}).length,
      });
      const history = state.history.flatMap((id) => {
        try { return [{ ...describe(readVersion(id)), appliedAt: readVersion(id).appliedAt ?? null }]; } catch { return []; }
      });
      return {
        active: state.active ?? delivered.manifest.contentVersion,
        onDelivered: !state.active,
        delivered: describe(delivered.manifest),
        history,
      };
    },

    /**
     * Reads and checks an update without changing anything: what it would
     * change, and anything that stops it.
     */
    async inspect(zipPath) {
      return inspectUpdate(zipPath, { current: readState().active ?? delivered.manifest.contentVersion, delivered, blobPath, scratch: join(dir, 'incoming') });
    },

    /**
     * Applies an update: checks it, takes in its files, and makes it the
     * version served. `force` applies it even though the display has moved on
     * from the version it was built on, which the admin panel asks about first.
     */
    async apply(zipPath, { force = false } = {}) {
      const current = readState().active ?? delivered.manifest.contentVersion;
      const report = await inspectUpdate(zipPath, { current, delivered, blobPath, scratch: join(dir, 'incoming') });
      if (report.problems.length > 0) throw new Error(report.problems.join(' '));
      if (report.stale && !force) throw new Error(report.stale);

      // Take in the files the store lacks, each checked against its checksum.
      const incoming = join(dir, 'incoming', randomUUID());
      await mkdir(incoming, { recursive: true });
      await mkdir(blobs, { recursive: true });
      try {
        for (const entry of report.entries.filter((each) => each.name.startsWith('blobs/'))) {
          const checksum = entry.name.slice('blobs/'.length);
          if (existsSync(join(blobs, checksum))) continue;
          const temporary = join(incoming, checksum);
          await extractEntry(zipPath, entry, temporary);
          if ((await hashFile(temporary)) !== checksum) throw new Error(`A file in the update does not match its checksum (${checksum.slice(0, 12)}): the update is damaged.`);
          await rename(temporary, join(blobs, checksum));
        }
      } finally {
        await rm(incoming, { recursive: true, force: true });
      }

      const manifest = { ...report.manifest, appliedAt: new Date().toISOString() };
      await mkdir(versions, { recursive: true });
      await writeFile(join(versions, `${manifest.contentVersion}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
      await prepareServing(manifest);
      const state = readState();
      const history = [manifest.contentVersion, ...state.history.filter((id) => id !== manifest.contentVersion)];
      await writeState({ active: manifest.contentVersion, history });
      refreshServing();
      await this.prune();
      return this.state();
    },

    /** Serves an earlier version again, or the delivered content (`delivered`). */
    async restore(id) {
      const state = readState();
      if (id === 'delivered' || id === delivered.manifest.contentVersion) {
        await writeState({ ...state, active: null });
      } else {
        if (!state.history.includes(id)) throw new Error(`There is no version ${id} on this display.`);
        const manifest = readVersion(id);
        await prepareServing(manifest);
        await writeState({ ...state, active: id });
      }
      refreshServing();
      return this.state();
    },

    /**
     * Writes the content the display shows now as a zip: for the staff
     * portal to start from, and as the display's own backup. Its full list
     * and every file, including any film an update brought, which exists
     * only here; the films folder is not part of it.
     */
    async exportCurrent(zipPath) {
      const manifest = activeManifest() ?? delivered.manifest;
      const checksums = new Set([...Object.values(manifest.site), ...Object.values(manifest.source ?? {}), ...Object.values(manifest.films ?? {})].map((file) => file.sha256));
      const entries = [{ name: 'content.json', data: `${JSON.stringify({ ...manifest, appliedAt: undefined, exported: { at: new Date().toISOString() } }, null, 2)}\n` }];
      for (const checksum of [...checksums].sort()) {
        const path = blobPath(checksum);
        if (!path) throw new Error(`A file of the current version is missing from the display (${checksum.slice(0, 12)}).`);
        entries.push({ name: `blobs/${checksum}`, path });
      }
      await writeZip(zipPath, entries);
      return { contentVersion: manifest.contentVersion, files: checksums.size };
    },

    /** Removes versions beyond the newest kept, and files no kept version uses. */
    async prune() {
      const state = readState();
      const keep = state.history.slice(0, keptVersions);
      if (state.active && !keep.includes(state.active)) keep.push(state.active);
      for (const id of state.history.filter((each) => !keep.includes(each))) {
        await rm(join(versions, `${id}.json`), { force: true });
        await rm(join(served, id), { recursive: true, force: true });
      }
      if (keep.length !== state.history.length) await writeState({ ...state, history: state.history.filter((id) => keep.includes(id)) });
      const used = new Set();
      for (const id of keep) {
        try {
          const manifest = readVersion(id);
          for (const file of [...Object.values(manifest.site), ...Object.values(manifest.source ?? {}), ...Object.values(manifest.films ?? {})]) used.add(file.sha256);
        } catch { /* a version that cannot be read keeps nothing */ }
      }
      if (!existsSync(blobs)) return;
      for (const name of await readdir(blobs)) {
        if (sha.test(name) && !used.has(name)) await rm(join(blobs, name), { force: true });
      }
    },
  };
}

/**
 * The delivered content as a version: its display files from the delivered
 * release manifest, which already records each file's checksum, and its
 * source data from the list delivered beside it (`content.json`).
 */
function deliveredVersion(siteRoot, sourceRoot) {
  const release = JSON.parse(readFileSync(join(siteRoot, 'release.json'), 'utf8'));
  const files = new Map();
  const site = {};
  for (const asset of release.assets) {
    const path = asset.path.replace(/^\//, '');
    if (!isContentPath(path) || !asset.sha256) continue;
    site[path] = { sha256: asset.sha256, bytes: asset.bytes };
    files.set(asset.sha256, join(siteRoot, ...path.split('/')));
  }
  let source = {};
  if (sourceRoot && existsSync(join(sourceRoot, 'content.json'))) {
    source = JSON.parse(readFileSync(join(sourceRoot, 'content.json'), 'utf8')).source ?? {};
    for (const [path, file] of Object.entries(source)) files.set(file.sha256, join(sourceRoot, ...path.split('/')));
  }
  const bundle = JSON.parse(readFileSync(join(siteRoot, 'data', 'exhibit.json'), 'utf8'));
  const manifest = {
    format: contentFormat,
    formatVersion: contentFormatVersion,
    contentVersion: contentVersionOf({ site, source, films: {} }),
    basedOn: null,
    createdAt: null,
    createdBy: 'Delivered with the app',
    summary: [`As delivered: release ${release.revision}.`],
    people: Array.isArray(bundle.people) ? bundle.people.length : null,
    exhibitSchemaVersion: bundle.schemaVersion ?? null,
    site,
    source,
    films: {},
  };
  return { manifest, files, schemaVersion: bundle.schemaVersion ?? null };
}

/** A version's name: a fingerprint of every file it holds and where. */
export function contentVersionOf({ site, source, films }) {
  const lines = (prefix, map) => Object.entries(map ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([path, file]) => `${prefix}${path}:${file.sha256}`);
  const hash = createHash('sha256').update([...lines('site/', site), ...lines('source/', source), ...lines('films/', films)].join('\n')).digest('hex');
  return `content-${hash.slice(0, 16)}`;
}

/**
 * Everything an update says and anything that stops it, without changing
 * the store. `stale` is set, rather than a problem, when the display has
 * moved on from the version the update was built on: applying it would undo
 * what changed since, which staff may still choose to do.
 */
async function inspectUpdate(zipPath, { current, delivered, blobPath, scratch: scratchDir }) {
  // Scratch files go in the store, never beside the update, which may be on a stick that cannot be written to.
  await mkdir(scratchDir, { recursive: true });
  const problems = [];
  let entries;
  try {
    entries = await listZip(zipPath);
  } catch (error) {
    return { problems: [`This is not a content update: ${error.message}`], entries: [], manifest: null, stale: null, changes: null };
  }
  const odd = entries.filter((entry) => entry.name !== 'content.json' && !/^blobs\/[0-9a-f]{64}$/.test(entry.name));
  if (odd.length) problems.push(`The update holds files it should not (${odd.slice(0, 3).map((entry) => entry.name).join(', ')}).`);
  const listing = entries.find((entry) => entry.name === 'content.json');
  if (!listing) return { problems: [...problems, 'This is not a content update: it has no content.json.'], entries, manifest: null, stale: null, changes: null };
  if (listing.size > 64 * 1024 * 1024) return { problems: [...problems, 'The update’s list is far too large to be one.'], entries, manifest: null, stale: null, changes: null };

  const scratch = join(scratchDir, `${randomUUID()}.content.json`);
  let manifest;
  try {
    await extractEntry(zipPath, listing, scratch);
    manifest = JSON.parse(await readFile(scratch, 'utf8'));
  } catch (error) {
    return { problems: [...problems, `The update’s list cannot be read: ${error.message}`], entries, manifest: null, stale: null, changes: null };
  } finally {
    await rm(scratch, { force: true });
  }

  if (manifest?.format !== contentFormat) problems.push('This is not a content update for this exhibit.');
  if (manifest?.formatVersion !== contentFormatVersion) problems.push(`This update is format ${manifest?.formatVersion}; this app reads format ${contentFormatVersion}. Update the app, or make the update with a matching portal.`);
  for (const [part, check] of [['site', (path) => isContentPath(path)], ['source', () => true], ['films', (path) => filmFile.test(path)]]) {
    const map = manifest?.[part];
    if (part !== 'films' && (!map || typeof map !== 'object')) { problems.push(`The update has no ${part} list.`); continue; }
    for (const [path, file] of Object.entries(map ?? {})) {
      if (!safeEntryName(path) || !check(path)) { problems.push(`"${path}" cannot be part of an update’s ${part}.`); continue; }
      if (!sha.test(file?.sha256 ?? '') || !Number.isInteger(file?.bytes) || file.bytes < 0) problems.push(`"${path}" has no proper checksum.`);
    }
  }
  if (problems.length) return { problems, entries, manifest, stale: null, changes: null };

  if (contentVersionOf(manifest) !== manifest.contentVersion) problems.push('The update’s name does not match what it holds: it was changed after it was made.');
  if (!manifest.site['data/exhibit.json']) problems.push('The update has no exhibit data (data/exhibit.json).');

  // Every file must be in the update or already on the display.
  const carried = new Set(entries.filter((entry) => entry.name.startsWith('blobs/')).map((entry) => entry.name.slice('blobs/'.length)));
  const lacking = [];
  for (const [part, map] of [['site', manifest.site], ['source', manifest.source], ['films', manifest.films ?? {}]]) {
    for (const [path, file] of Object.entries(map)) if (!carried.has(file.sha256) && !blobPath(file.sha256)) lacking.push(`${part}/${path}`);
  }
  if (lacking.length) problems.push(`${lacking.length} file(s) are neither in the update nor on this display (${lacking.slice(0, 3).join(', ')}). The update was made for a different display, or from a different version.`);

  // The exhibit data itself: kiosk data, for this app.
  if (!problems.length) {
    const checksum = manifest.site['data/exhibit.json'].sha256;
    const scratchData = join(scratchDir, `${randomUUID()}.exhibit.json`);
    try {
      const entry = entries.find((each) => each.name === `blobs/${checksum}`);
      let path = blobPath(checksum);
      if (entry) { await extractEntry(zipPath, entry, scratchData); path = scratchData; }
      const bundle = JSON.parse(await readFile(path, 'utf8'));
      if (bundle.target !== 'kiosk') problems.push(`The exhibit data is for the "${bundle.target}" target, not the display.`);
      if (bundle.preview) problems.push('The exhibit data is an editor’s preview, which never goes on a display.');
      if (bundle.schemaVersion !== delivered.schemaVersion) problems.push(`The exhibit data is version ${bundle.schemaVersion}; this app shows version ${delivered.schemaVersion}. The app needs updating before this content.`);
      if (!Array.isArray(bundle.people) || bundle.people.length === 0) problems.push('The exhibit data has nobody in it.');
      // Every image a person shows must come with the content.
      const missingImages = (bundle.people ?? []).map((person) => person.portrait?.src).filter((src) => typeof src === 'string' && src.startsWith('/') && !manifest.site[src.replace(/^\//, '')]);
      if (missingImages.length) problems.push(`${missingImages.length} portrait(s) are not in the update (${missingImages.slice(0, 3).join(', ')}).`);
    } catch (error) {
      problems.push(`The exhibit data cannot be read: ${error.message}`);
    } finally {
      await rm(scratchData, { force: true });
    }
  }

  const stale = manifest.basedOn && manifest.basedOn !== current
    ? `This update was made from version ${manifest.basedOn}, but this display now shows ${current}. Applying it would undo what changed since. Export the current content, make the update again from it, or apply it anyway.`
    : null;
  return { problems, entries, manifest, stale, changes: changesBetween(current, manifest, delivered) };
}

/** What an update changes, against what the display shows now, in counts. */
function changesBetween(current, manifest, delivered) {
  return {
    from: current,
    to: manifest.contentVersion,
    summary: manifest.summary ?? [],
    createdBy: manifest.createdBy ?? null,
    createdAt: manifest.createdAt ?? null,
    newFilms: Object.keys(manifest.films ?? {}).length,
    deliveredVersion: delivered.manifest.contentVersion,
  };
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export { hashFile };
// For the delivered source list, written when the app is staged.
export async function listSource(folder) {
  const source = {};
  const walk = async (directory, prefix) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(directory, entry.name), path);
      else if (entry.isFile() && entry.name !== 'content.json') source[path] = { sha256: await hashFile(join(directory, entry.name)), bytes: (await stat(join(directory, entry.name))).size };
    }
  };
  await walk(folder, '');
  return source;
}

