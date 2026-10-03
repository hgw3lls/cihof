import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { makeUpdate } from '../apps/kiosk-app/src/content-package.mjs';
import { extractEntry, listZip } from '../apps/kiosk-app/src/zip.mjs';

/**
 * Makes a content update for a display from this project, for whoever builds
 * and tests the apps. The staff portal does the same from its own edits.
 *
 *   npm run content:update -- --from=<the display's export> [--out=<file>] [--by="Name"] [--summary="What changed"]
 *
 * The display exports what it shows now (admin panel, Content, Export current
 * content). The update is made from that: it lists the whole new version and
 * carries only what the display lacks, and the display refuses it if it has
 * moved on since the export.
 *
 * The new version is this project as it stands: the kiosk build of the
 * exhibit (its data and media; films stay in the display's films folder) and
 * the source data git tracks under data/. Kiosk content, so the update, like
 * the kiosk release, is never published.
 */

const root = resolve(import.meta.dirname, '..');
const args = { summary: [] };
for (const argument of process.argv.slice(2)) {
  if (!argument.startsWith('--')) continue;
  const [key, ...rest] = argument.slice(2).split('=');
  const value = rest.join('=');
  if (key === 'summary') args.summary.push(value); else args[key] = value;
}
if (!args.from || !existsSync(resolve(args.from))) {
  console.error('\nUsage: npm run content:update -- --from=<the display\'s export (.cihof)> [--out=<file>] [--by="Name"] [--summary="What changed"]');
  console.error('Export it on the display: admin panel, Content, Export current content.');
  process.exit(1);
}
if (process.env.CIHOF_PREVIEW) {
  console.error('CIHOF_PREVIEW is set. A preview shows unreviewed content and never goes on a display.');
  process.exit(1);
}

// What the display has: the list inside its export.
const exportPath = resolve(args.from);
const listing = (await listZip(exportPath)).find((entry) => entry.name === 'content.json');
if (!listing) { console.error(`${exportPath} is not a display's export: it has no content.json.`); process.exit(1); }
const scratch = join(tmpdir(), `cihof-export-${process.pid}.json`);
await extractEntry(exportPath, listing, scratch);
const base = JSON.parse(readFileSync(scratch, 'utf8'));
rmSync(scratch, { force: true });

// The kiosk build, served at the root, as the kiosk release is built.
const env = { ...process.env, CIHOF_TARGET: 'kiosk', CIHOF_BASE_PATH: '/' };
delete env.CIHOF_PREVIEW;
const build = spawnSync('npm', ['run', 'build', '--workspace', '@cihof/exhibit'], { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
if (build.status !== 0) { console.error('\nThe kiosk build failed. No update was made.'); process.exit(build.status ?? 1); }
const dist = join(root, 'apps', 'exhibit', 'dist');
const bundle = JSON.parse(readFileSync(join(dist, 'data', 'exhibit.json'), 'utf8'));
if (bundle.target !== 'kiosk' || bundle.preview) { console.error('The build is not kiosk content. No update was made.'); process.exit(1); }

const site = {};
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { walk(path); continue; }
    const relativePath = relative(dist, path).split('\\').join('/');
    // Films stay in the display's films folder; an update brings a film only when the portal adds one.
    if (relativePath.startsWith('media/videos/') && /\.(mp4|webm|mov|m4v|mkv|ogv|avi)$/i.test(relativePath)) continue;
    site[relativePath] = path;
  }
};
for (const part of ['data', 'media']) if (existsSync(join(dist, part))) walk(join(dist, part));

const source = {};
for (const path of execFileSync('git', ['ls-files', '-z', '--', 'data'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)) {
  if (existsSync(join(root, path))) source[path] = join(root, path);
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const out = resolve(args.out ?? join(root, 'release', 'content', `cihof-update-${stamp}.cihof`));
mkdirSync(join(out, '..'), { recursive: true });
const made = await makeUpdate({
  out,
  base,
  site,
  source,
  createdBy: args.by || 'The project',
  summary: args.summary.length ? args.summary : [`From the project at ${gitCommit()}.`],
  people: bundle.people.length,
  exhibitSchemaVersion: bundle.schemaVersion ?? null,
});

console.log(`\nContent update ${made.manifest.contentVersion}`);
console.log(`  ${relative(root, out)}`);
console.log(`  made from ${base.contentVersion} (the display's export); ${made.listed} files listed, ${made.carried} carried`);
if (made.manifest.contentVersion === base.contentVersion) console.log('  Nothing has changed since the export: the display already shows this.');
console.log('  KIOSK ONLY: never publish it. Load it on the display: admin panel, Content, Load a content update.\n');

function gitCommit() {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'data', 'apps/exhibit', 'packages'], { cwd: root, encoding: 'utf8' }).trim();
    return dirty ? `${commit} with uncommitted changes` : commit;
  } catch {
    return 'an unknown commit';
  }
}
