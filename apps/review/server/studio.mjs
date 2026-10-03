import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { saveHere } from './save.mjs';

/**
 * The studio: the staff portal editing the exhibit in place.
 *
 * The portal shows the very exhibit the display runs (built with its editor,
 * apps/exhibit/src/app/editor.ts) on a preview of its own copy, published
 * exactly as a display update would be. An editor picks something on it, and
 * changes it beside the preview; each change is saved straight into the copy,
 * by the same apply tools as every other decision, under their name, and the
 * preview is published again.
 *
 * Each saved change can be undone: the files it changed are kept from before
 * it (.portal/undo), and put back. Each waits for somebody to approve it, the
 * same person or another; a display update is not made while any is waiting.
 */

const folder = (root) => join(root, '.portal');
const statePath = (root) => join(folder(root), 'studio.json');
const sourceParts = ['data', join('public', 'media')];
const filmFile = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

const readJson = (path, fallback) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } };
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
};

export function studioState(root) {
  const state = readJson(statePath(root), {});
  return { changes: Array.isArray(state.changes) ? state.changes : [] };
}

/** Changes saved in the studio that nobody has approved yet. */
export function waitingChanges(root) {
  return studioState(root).changes.filter((change) => change.status === 'waiting');
}

// -------------------------------------------------------------- the preview

/** Where the preview's content is published: data/ and media/, as on a display. */
export const previewFolder = (root) => join(folder(root), 'preview');

/**
 * Publishes the preview from the copy as it is now, as a display update would
 * be (scripts/publish-display-content.mjs), then swaps it in whole.
 */
export function refreshPreview(root) {
  const next = join(folder(root), `preview-${randomUUID()}`);
  const run = spawnSync(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning', join(root, 'scripts', 'publish-display-content.mjs'), `--out=${next}`,
  ], { cwd: root, encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, maxBuffer: 32 * 1024 * 1024 });
  if (run.status !== 0) {
    rmSync(next, { recursive: true, force: true });
    return { ok: false, output: `${run.stdout ?? ''}${run.stderr ?? ''}`.trim() };
  }
  const old = `${previewFolder(root)}-old-${randomUUID()}`;
  if (existsSync(previewFolder(root))) renameSync(previewFolder(root), old);
  renameSync(next, previewFolder(root));
  rmSync(old, { recursive: true, force: true });
  return { ok: true };
}

// ------------------------------------------------------- saving, and undoing

/** Every file of the copy's source, by path, with what tells a change: size and time. */
function sourceFiles(root) {
  const files = new Map();
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && !filmFile.test(entry.name)) {
        const stat = statSync(path);
        files.set(relative(root, path), `${stat.size}:${stat.mtimeMs}`);
      }
    }
  };
  for (const part of sourceParts) walk(join(root, part));
  return files;
}

/**
 * Saves one change made in the studio: a draft holding just that decision,
 * applied as `saveHere` applies any (save.mjs). The files it changed are kept
 * from before, to undo it. Returns what saveHere says.
 */
export function saveStudioChange({ root, draft, title, subject, now = new Date() }) {
  const id = `change-${now.getTime()}-${randomUUID().slice(0, 8)}`;
  const keep = join(folder(root), 'undo', id);
  const before = sourceFiles(root);
  // The tools rewrite the records and the films' captions and transcripts, and
  // only ever add pictures and films: so those are copied first, and only the
  // ones this change touched are kept after.
  const staged = join(keep, 'before');
  const rewritable = (path) => path.startsWith(`data${sep}`) || path.startsWith(join('public', 'media', 'videos') + sep);
  for (const path of before.keys()) {
    if (!rewritable(path)) continue;
    mkdirSync(dirname(join(staged, path)), { recursive: true });
    copyFileSync(join(root, path), join(staged, path));
  }
  const outcome = saveHere({ root, draft, now });
  const saved = outcome.results.length > 0 && outcome.results.every((result) => result.ok);
  if (!saved) {
    rmSync(keep, { recursive: true, force: true });
    return { ok: false, results: outcome.results };
  }
  const after = sourceFiles(root);
  const changed = [...before.keys()].filter((path) => after.get(path) !== before.get(path));
  const lost = changed.filter((path) => !rewritable(path));
  if (lost.length) console.warn(`Changed but not kept to undo: ${lost.join(', ')}`);
  const added = [...after.keys()].filter((path) => !before.has(path));
  // Keep only what the change touched.
  for (const path of before.keys()) if (!changed.includes(path)) rmSync(join(staged, path), { force: true });
  writeJson(join(keep, 'files.json'), { changed: changed.filter(rewritable), added });

  const state = studioState(root);
  const change = { id, at: now.toISOString(), by: draft.reviewer, title, subject, status: 'waiting', files: changed.length + added.length };
  writeJson(statePath(root), { ...state, changes: [...state.changes, change] });
  return { ok: true, change, results: outcome.results };
}

/** Undoes the last change saved in the studio, if nothing has been saved over it since. */
export function undoStudioChange(root) {
  const state = studioState(root);
  const last = state.changes.at(-1);
  if (!last) return { ok: false, problem: 'There is nothing to undo.' };
  if (last.status === 'published') return { ok: false, problem: 'That change is on the display already. Change it again instead.' };
  const keep = join(folder(root), 'undo', last.id);
  const files = readJson(join(keep, 'files.json'), null);
  if (!files) return { ok: false, problem: 'That change can no longer be undone.' };
  for (const path of files.changed) copyFileSync(join(keep, 'before', path), join(root, path));
  for (const path of files.added) rmSync(join(root, path), { force: true });
  rmSync(keep, { recursive: true, force: true });
  writeJson(statePath(root), { ...state, changes: state.changes.slice(0, -1) });
  // The portal's own list of saved changes, for the next display update, loses it too.
  const portalPath = join(folder(root), 'state.json');
  const portal = readJson(portalPath, null);
  if (portal && Array.isArray(portal.changes) && portal.changes.length > 0 && !portal.changes.at(-1).inUpdate) {
    writeJson(portalPath, { ...portal, changes: portal.changes.slice(0, -1) });
  }
  return { ok: true, undone: last };
}

/** Records that somebody approved a change saved in the studio. */
export function approveStudioChange(root, { id, by, now = new Date() }) {
  if (!by?.trim()) return { ok: false, problem: 'Enter your name first.' };
  const state = studioState(root);
  const change = state.changes.find((each) => each.id === id);
  if (!change) return { ok: false, problem: 'There is no such change.' };
  if (change.status !== 'waiting') return { ok: true, change };
  const approved = { ...change, status: 'approved', approvedBy: by.trim(), approvedAt: now.toISOString() };
  writeJson(statePath(root), { ...state, changes: state.changes.map((each) => (each.id === id ? approved : each)) });
  return { ok: true, change: approved };
}

/** Once a display update carries them, approved changes are on their way, and stay as they are. */
export function markPublished(root) {
  const state = studioState(root);
  writeJson(statePath(root), { ...state, changes: state.changes.map((each) => (each.status === 'approved' ? { ...each, status: 'published' } : each)) });
  rmSync(join(folder(root), 'undo'), { recursive: true, force: true });
}
