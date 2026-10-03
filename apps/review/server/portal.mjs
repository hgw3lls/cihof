import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeUpdate } from '../../kiosk-app/src/content-package.mjs';
import { contentFormat, contentFormatVersion, contentVersionOf, hashFile } from '../../kiosk-app/src/content-store.mjs';
import { extractEntry, listZip } from '../../kiosk-app/src/zip.mjs';

/**
 * The staff portal: the review app working on a copy of what a display shows,
 * with nobody in between.
 *
 * Staff export the content from the display (its admin panel, Content) and
 * open the file here. Its source, the records, portraits and the films'
 * captions and transcripts, becomes this app's working copy. Edits are saved
 * straight into that copy, through the same apply tools as always, each kind
 * of review recorded under the reviewer's name. When they are ready, "Make a
 * display update" publishes the display's content from the copy, exactly as
 * the kiosk build does, and writes the update the display loads: it lists the
 * whole new version and carries only what the display lacks.
 *
 * What the portal keeps, in .portal/ beside the copy:
 *   base.json   the list of the export it was opened from (what the display had)
 *   last.json   the list of the last update it made, if any
 *   state.json  when it was opened, the changes saved since, and the updates made
 */

/** The source a display keeps for the portal: the records, and the media beside them. */
const sourceParts = ['data', join('public', 'media')];
const isSourcePath = (path) => path.startsWith('data/') || path.startsWith('public/media/');
const filmFile = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
/** Never part of the source: films, the tools' backups, and what computers leave in folders. */
const skipped = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$|\.backup-[^/]*$/i;

const folder = (root) => join(root, '.portal');
const readJson = (path, fallback) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } };
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
};
const readState = (root) => {
  const state = readJson(join(folder(root), 'state.json'), {});
  return { opened: state.opened ?? null, changes: Array.isArray(state.changes) ? state.changes : [], updates: Array.isArray(state.updates) ? state.updates : [] };
};

/** Whether this working copy came from a display's export. */
export function isPortal(root) {
  return existsSync(join(folder(root), 'base.json'));
}

/** Where things stand, for the pages. */
export function portalState(root) {
  const state = readState(root);
  const last = state.updates.at(-1) ?? null;
  return {
    opened: state.opened,
    pending: state.changes.filter((change) => !change.inUpdate),
    changes: state.changes,
    updates: state.updates,
    lastUpdate: last,
  };
}

/**
 * Makes a display's export this app's working copy: its source replaces the
 * records and media here. Refuses while saved changes are waiting for a
 * display update, unless `replace` is given, since they would be lost.
 */
export async function openExport({ root, file, replace = false, now = new Date() }) {
  const pending = readState(root).changes.filter((change) => !change.inUpdate);
  if (pending.length > 0 && !replace) {
    throw new Error(`${pending.length} saved change${pending.length === 1 ? ' is' : 's are'} not yet in a display update. Opening another export replaces them.`);
  }

  let entries;
  try { entries = await listZip(file); } catch (error) { throw new Error(`This is not a display's export: ${error.message}`); }
  const listing = entries.find((entry) => entry.name === 'content.json');
  if (!listing) throw new Error('This is not a display\'s export: it has no content.json.');
  const scratch = join(folder(root), 'opening', randomUUID());
  mkdirSync(scratch, { recursive: true });
  try {
    await extractEntry(file, listing, join(scratch, 'content.json'));
    const manifest = readJson(join(scratch, 'content.json'), null);
    if (manifest?.format !== contentFormat) throw new Error('This is not a display\'s export.');
    if (manifest.formatVersion !== contentFormatVersion) throw new Error(`This export is format ${manifest.formatVersion}; this app reads format ${contentFormatVersion}. Use a matching version of the app.`);
    if (contentVersionOf(manifest) !== manifest.contentVersion) throw new Error('The export\'s name does not match what it holds: it was changed after it was made.');
    const source = manifest.source ?? {};
    if (!source['data/cihof_curated_metadata.json'] || !Object.keys(source).some((path) => path.startsWith('public/media/images/'))) {
      throw new Error('This export does not hold the records and portraits the portal works from. It came from a display delivered before the staff portal: ask for an updated display app.');
    }
    const odd = Object.keys(source).filter((path) => !isSourcePath(path) || path.split('/').includes('..'));
    if (odd.length) throw new Error(`The export holds source outside the records and media (${odd.slice(0, 3).join(', ')}).`);

    // Every file, checked against its checksum, into a fresh folder first.
    const blobs = new Map(entries.filter((entry) => entry.name.startsWith('blobs/')).map((entry) => [entry.name.slice('blobs/'.length), entry]));
    const fresh = join(scratch, 'source');
    const taken = new Map();
    for (const [path, { sha256 }] of Object.entries(source)) {
      const to = join(fresh, ...path.split('/'));
      mkdirSync(dirname(to), { recursive: true });
      if (taken.has(sha256)) { copyFileSync(taken.get(sha256), to); continue; }
      const entry = blobs.get(sha256);
      if (!entry) throw new Error(`The export is missing ${path}. Export the content from the display again.`);
      await extractEntry(file, entry, to);
      if ((await hashFile(to)) !== sha256) throw new Error(`${path} in the export does not match its checksum: the export is damaged.`);
      taken.set(sha256, to);
    }

    // Then in place of the records and media here.
    for (const part of sourceParts) {
      rmSync(join(root, part), { recursive: true, force: true });
      if (existsSync(join(fresh, part))) {
        mkdirSync(dirname(join(root, part)), { recursive: true });
        renameSync(join(fresh, part), join(root, part));
      }
    }
    const base = { ...manifest };
    delete base.exported;
    writeJson(join(folder(root), 'base.json'), base);
    rmSync(join(folder(root), 'last.json'), { force: true });
    writeJson(join(folder(root), 'state.json'), {
      opened: {
        file: basename(file),
        contentVersion: manifest.contentVersion,
        exportedAt: manifest.exported?.at ?? null,
        openedAt: now.toISOString(),
        people: manifest.people ?? null,
        films: Object.keys(manifest.films ?? {}).length,
      },
      changes: [],
      updates: [],
    });
    return portalState(root);
  } finally {
    rmSync(join(folder(root), 'opening'), { recursive: true, force: true });
  }
}

/** Records a kind of review saved into the working copy, for the next update's summary. */
export function recordChange(root, { by, task, title, count, reference, now = new Date() }) {
  const state = readState(root);
  writeJson(join(folder(root), 'state.json'), {
    ...state,
    changes: [...state.changes, { at: now.toISOString(), by, task, title, count, reference, inUpdate: null }],
  });
}

/**
 * Publishes the display's content from the working copy and writes the
 * update for the display into `outDir`.
 *
 * The update follows the last one made here, or the export when none has
 * been, and carries every file the export lacks: so it works on a display
 * still showing the export, or one that took the last update.
 */
export async function makeDisplayUpdate({ root, outDir, by, note = '', now = new Date() }) {
  if (!isPortal(root)) throw new Error('Open a display\'s export first.');
  if (!by?.trim()) throw new Error('Enter your name first.');
  const base = readJson(join(folder(root), 'base.json'), null);
  const last = readJson(join(folder(root), 'last.json'), null);
  const state = readState(root);
  const pending = state.changes.filter((change) => !change.inUpdate);
  const follows = last ?? base;

  // Nothing saved since the version this would follow: the display has it already.
  const source = listSource(root);
  const listedSource = Object.fromEntries(await Promise.all(Object.entries(source).map(async ([path, file]) => [path, await hashFile(file)])));
  const same = Object.keys(listedSource).length === Object.keys(follows.source ?? {}).length
    && Object.entries(listedSource).every(([path, checksum]) => follows.source?.[path]?.sha256 === checksum);
  if (same) {
    return { ok: false, problem: last ? 'Nothing has changed since the last display update.' : 'Nothing has changed since the export was opened.' };
  }

  const published = join(folder(root), 'published');
  const run = spawnSync(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
    join(root, 'scripts', 'publish-display-content.mjs'), `--out=${published}`,
  ], { cwd: root, encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, maxBuffer: 32 * 1024 * 1024 });
  if (run.status !== 0) {
    return { ok: false, problem: 'The display\'s content could not be made from these records.', output: `${run.stdout ?? ''}${run.stderr ?? ''}`.trim() };
  }
  const made = readJson(join(published, 'data', 'exhibit.json'), null);
  if (made?.target !== 'kiosk' || made.preview) return { ok: false, problem: 'What was made is not content for a display.' };

  const site = {};
  for (const part of ['data', 'media']) {
    for (const file of walk(join(published, part))) site[relative(published, file).split('\\').join('/')] = file;
  }
  // Films an update brought stay as the display has them, listed and never carried again.
  const held = new Set(Object.values(base.films ?? {}).map((file) => file.sha256));
  const films = Object.fromEntries(Object.entries(follows.films ?? {}).filter(([, file]) => held.has(file.sha256)));

  const stamp = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes()].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'));
  const name = `cihof-update-${stamp.slice(0, 3).join('-')}-${stamp.slice(3).join('')}.cihof`;
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, name);
  const summary = [
    ...note.split('\n').map((line) => line.trim()).filter(Boolean),
    ...pending.map((change) => `${change.title}: ${change.count} decision${change.count === 1 ? '' : 's'} by ${change.by} (${change.reference}).`),
  ];
  const update = await makeUpdate({
    out,
    base,
    basedOn: follows.contentVersion,
    site,
    source,
    films,
    createdBy: by.trim(),
    summary: summary.length ? summary : ['Changes made in the staff portal.'],
    people: made.people.length,
    exhibitSchemaVersion: made.schemaVersion ?? null,
  });
  rmSync(published, { recursive: true, force: true });

  writeJson(join(folder(root), 'last.json'), update.manifest);
  const record = { at: now.toISOString(), by: by.trim(), file: out, contentVersion: update.manifest.contentVersion, basedOn: update.manifest.basedOn, carried: update.carried, summary: update.manifest.summary };
  writeJson(join(folder(root), 'state.json'), {
    ...state,
    changes: state.changes.map((change) => (change.inUpdate ? change : { ...change, inUpdate: update.manifest.contentVersion })),
    updates: [...state.updates, record],
  });
  return { ok: true, ...record };
}

/** The working copy's source: every file of the records and media, by its path in the export. */
function listSource(root) {
  const source = {};
  for (const part of sourceParts) {
    for (const file of walk(join(root, part))) {
      const path = relative(root, file).split('\\').join('/');
      if (!filmFile.test(path)) source[path] = file;
    }
  }
  return source;
}

function* walk(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (skipped.test(path.split('\\').join('/'))) continue;
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

/**
 * Keeps a copy of the records and media before a review is saved, and puts
 * it back if saving fails, so nothing of a failed save is kept. The copy has
 * no git to undo with.
 */
export function snapshot(root) {
  const keep = join(folder(root), 'before-save');
  rmSync(keep, { recursive: true, force: true });
  for (const part of sourceParts) {
    if (existsSync(join(root, part))) cpSync(join(root, part), join(keep, part), { recursive: true, filter: (path) => !filmFile.test(path) });
  }
  return {
    restore() {
      for (const part of sourceParts) {
        rmSync(join(root, part), { recursive: true, force: true });
        if (existsSync(join(keep, part))) { mkdirSync(dirname(join(root, part)), { recursive: true }); renameSync(join(keep, part), join(root, part)); }
      }
      rmSync(keep, { recursive: true, force: true });
    },
    discard() { rmSync(keep, { recursive: true, force: true }); },
  };
}

// The app opens an export by running this file:
//   node apps/review/server/portal.mjs --open=<export> [--replace]      (from the working copy)
const invokedDirectly = process.argv[1] && existsSync(process.argv[1])
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [key, ...rest] = a.slice(2).split('=');
    return [key, rest.length > 0 ? rest.join('=') : true];
  }));
  if (typeof args.open !== 'string') {
    console.error('Usage: node apps/review/server/portal.mjs --open=<export> [--replace]');
    process.exit(2);
  }
  try {
    const state = await openExport({ root: process.cwd(), file: resolve(args.open), replace: Boolean(args.replace) });
    console.log(JSON.stringify(state.opened));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
