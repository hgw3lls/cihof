import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * What the staff review app does on a staff computer, worked out without
 * Electron so it can be tested.
 *
 * The app carries the review itself (its pages, its server, the pipeline and
 * the apply tools it checks decisions with) and runs it with the Node inside
 * Electron. It carries no records. It reads them from a data folder chosen
 * once, such as a shared folder the developer keeps up to date: every time the
 * app starts, the records, portraits and the films' posters, captions and
 * transcripts are copied from there into the app's own working folder. The
 * data folder is only read, and films are never copied.
 *
 * Nothing needs git, Node or a copy of the project on the staff computer.
 * Decisions leave as a file the reviewer sends to the developer.
 */

/** The parts of a data folder the review reads. */
export const dataParts = ['data', join('public', 'media')];
/** Never copied: the films themselves, and things a computer leaves in folders. */
const skipped = /(\.(mp4|m4v|mov|webm|mkv|avi)$)|(^\.DS_Store$)|(^Thumbs\.db$)|(^desktop\.ini$)|(\.backup-[^/\\]*$)/i;

/** Why a folder is not a review data folder, or null when it is. */
export function dataFolderProblem(folder) {
  if (!folder) return 'No data folder has been chosen.';
  if (!existsSync(folder)) return `The data folder ${folder} cannot be reached. Is the drive it is on connected?`;
  if (!existsSync(join(folder, 'data', 'cihof_curated_metadata.json'))) {
    return `${folder} is not a review data folder: there is no data/cihof_curated_metadata.json in it. Choose the folder the developer set up.`;
  }
  return null;
}

/**
 * Copies the review's data from `from` into `to`: what has changed since the
 * last copy, and nothing else, and removes what is no longer in the data
 * folder. Only the data parts are touched.
 */
export function syncDataFolder(from, to) {
  let copied = 0;
  let removed = 0;
  let kept = 0;
  for (const part of dataParts) {
    const source = join(from, part);
    const target = join(to, part);
    const wanted = new Set();
    for (const file of walk(source)) {
      const path = relative(source, file);
      wanted.add(path);
      const destination = join(target, path);
      const stat = statSync(file);
      if (existsSync(destination)) {
        const current = statSync(destination);
        if (current.size === stat.size && Math.abs(current.mtimeMs - stat.mtimeMs) < 2000) { kept += 1; continue; }
      }
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(file, destination);
      utimesSync(destination, stat.atime, stat.mtime);
      copied += 1;
    }
    for (const file of walk(target)) {
      if (!wanted.has(relative(target, file))) { rmSync(file, { force: true }); removed += 1; }
    }
  }
  return { copied, removed, kept };
}

function* walk(folder) {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (skipped.test(entry.name)) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && !skipped.test(path)) yield path;
  }
}

/**
 * Puts the review's code, from the app, into the working folder: again only
 * when the app is a different build, so a reviewer's unsent decisions
 * (.review/), the copied data and the portal's own record (.portal/) are
 * never touched.
 */
export function installRuntime(runtime, work, build) {
  const stampPath = join(work, '.review-app-build');
  const current = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : '';
  const linked = ['content', 'pipeline'].every((name) => existsSync(join(work, 'node_modules', '@cihof', name, 'package.json')));
  if (current === build && linked) return false;
  for (const part of [join('apps', 'review'), join('apps', 'kiosk-app'), 'packages', 'scripts', 'docs', 'node_modules', 'package.json']) {
    rmSync(join(work, part), { recursive: true, force: true });
  }
  mkdirSync(work, { recursive: true });
  // apps/kiosk-app holds only what the portal shares with the display: how content updates are made.
  for (const part of [join('apps', 'review'), join('apps', 'kiosk-app'), 'packages', 'scripts', 'docs', 'package.json']) {
    cpSync(join(runtime, part), join(work, part), { recursive: true });
  }
  // The project's own packages, found by name as in the project. Linked, not
  // copied: Node will not run TypeScript from inside node_modules. A junction
  // on Windows, which needs no administrator.
  for (const name of ['content', 'pipeline']) {
    const link = join(work, 'node_modules', '@cihof', name);
    mkdirSync(dirname(link), { recursive: true });
    const target = join(work, 'packages', name);
    symlinkSync(process.platform === 'win32' ? resolve(target) : relative(dirname(link), target), link, process.platform === 'win32' ? 'junction' : 'dir');
  }
  writeFileSync(stampPath, `${build}\n`);
  return true;
}

/** A port nothing on this computer is using, from `from` upwards. */
export async function freePort(from = 5180, attempts = 40) {
  for (let port = from; port < from + attempts; port += 1) {
    const free = await new Promise((resolvePort) => {
      const probe = createServer();
      probe.once('error', () => resolvePort(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => resolvePort(true)));
    });
    if (free) return port;
  }
  throw new Error(`No free port between ${from} and ${from + attempts - 1}.`);
}

/** Only the review's own pages are shown in the window; a web address opens in the browser. */
export function isOwnPage(url, port) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname) && Number(parsed.port) === port;
  } catch {
    return false;
  }
}

export function isWebAddress(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** A file the page asks to show must be one of the exported decisions files. */
export function isExportedFile(path, exportDir) {
  if (typeof path !== 'string' || !path) return false;
  const full = resolve(path);
  return full.startsWith(resolve(exportDir) + sep) && /cihof-decisions-[^/\\]+\.json$/.test(full) && existsSync(full);
}

/** A file the page asks to show must be one of the display updates the portal made. */
export function isUpdateFile(path, updatesDir) {
  if (typeof path !== 'string' || !path) return false;
  const full = resolve(path);
  return full.startsWith(resolve(updatesDir) + sep) && /cihof-update-[^/\\]+\.cihof$/.test(full) && existsSync(full);
}
