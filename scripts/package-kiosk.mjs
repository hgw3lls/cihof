import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Builds the installed exhibit and packages it for a display.
 *
 *   npm run package:kiosk
 *
 * Writes release/cihof-kiosk-<release>/: the kiosk build served at the root of
 * a local address, the exhibit's own server, start scripts, a README for staff
 * and a MANIFEST saying exactly what the release carries, including every film
 * whose video file this machine did not have.
 *
 * This is the one artifact that carries films approved for the kiosk only, so
 * it is refused as an editor's preview, it lands in release/ (ignored by git),
 * and everything in it says it must never be published.
 */

const root = resolve(import.meta.dirname, '..');
const exhibit = resolve(root, 'apps/exhibit');
const dist = resolve(exhibit, 'dist');

if (process.env.CIHOF_PREVIEW) {
  console.error('CIHOF_PREVIEW is set. A preview shows unreviewed content and is never packaged for a display.');
  process.exit(1);
}

// Served at the root of http://localhost:<port>/, not under /cihof/ as the
// Pages preview is.
const env = { ...process.env, CIHOF_TARGET: 'kiosk', CIHOF_BASE_PATH: '/' };
delete env.CIHOF_PREVIEW;
// A shell on Windows so that `npm` resolves to npm.cmd.
const build = spawnSync('npm', ['run', 'build', '--workspace', '@cihof/exhibit'], {
  cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32',
});
if (build.status !== 0) {
  console.error('\nThe kiosk build failed. Nothing was packaged.');
  process.exit(build.status ?? 1);
}

const bundle = JSON.parse(readFileSync(join(dist, 'data/exhibit.json'), 'utf8'));
const release = JSON.parse(readFileSync(join(dist, 'release.json'), 'utf8'));
if (bundle.target !== 'kiosk' || bundle.preview) {
  console.error(`The build is target "${bundle.target}"${bundle.preview ? ', preview' : ''}, not a kiosk release. Nothing was packaged.`);
  process.exit(1);
}
if (release.base !== '/') {
  console.error(`The build is based at "${release.base}", not "/". Nothing was packaged.`);
  process.exit(1);
}

// How many of the profiles on this release a curator has approved as they
// stand. A release does not wait on it, but it says so.
const profileCounts = profiles();

const films = bundle.people.flatMap((person) => person.films.map((film) => ({ person: person.id, film })));
const local = films.filter(({ film }) => film.source.kind === 'local-file');
const missing = local
  .filter(({ film }) => !existsSync(join(dist, film.source.src.replace(/^\//, ''))))
  .map(({ person, film }) => ({ person, film: film.id, file: film.source.src }));

const out = resolve(root, 'release', `cihof-kiosk-${release.revision}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, join(out, 'site'), { recursive: true });
for (const file of [
  'server.mjs', 'launch.mjs',
  'start-kiosk.cmd', 'stop-kiosk.cmd', 'install-autostart.cmd', 'uninstall-autostart.cmd',
  'start-kiosk.sh', 'stop-kiosk.sh', 'install-autostart.sh', 'uninstall-autostart.sh',
]) {
  cpSync(join(exhibit, 'kiosk', file), join(out, file));
}
// The staff guide travels with every release, so the display's own copy
// matches what is installed on it.
cpSync(join(root, 'docs', 'staff-guide.md'), join(out, 'STAFF-GUIDE.md'));
// Under its own name, which the guide links to.
cpSync(join(root, 'docs', 'sign-off.md'), join(out, 'sign-off.md'));

const commit = gitCommit();
const shortCommit = `${commit.slice(0, 7)}${commit.endsWith('+uncommitted') ? ' with uncommitted changes' : ''}`;
const builtAt = new Date().toISOString();
const manifest = {
  kind: 'cihof-kiosk-release',
  warning: 'Kiosk build: carries films approved for the kiosk only. Never publish.',
  release: release.revision,
  contentRevision: bundle.contentRevision,
  builtAt,
  sourceCommit: commit,
  people: bundle.people.length,
  lenses: bundle.lenses,
  relationships: bundle.relationships.length,
  profiles: profileCounts,
  films: { total: films.length, localFiles: local.length, videoPresent: local.length - missing.length, videoMissing: missing },
  precachedAssets: release.assets.length,
  bytes: folderBytes(join(out, 'site')),
};
writeFileSync(join(out, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const filmLine = missing.length === 0
  ? `All ${local.length} films have their video file.`
  : `${local.length - missing.length} of ${local.length} films have their video file; ${missing.length} do not.`;
const readme = readFileSync(join(exhibit, 'kiosk/README.txt'), 'utf8')
  .replaceAll('{{RELEASE}}', release.revision)
  .replaceAll('{{CONTENT}}', bundle.contentRevision.slice(0, 12))
  .replaceAll('{{BUILT}}', builtAt.slice(0, 10))
  .replaceAll('{{COMMIT}}', shortCommit)
  .replaceAll('{{FILMS}}', filmLine);
writeFileSync(join(out, 'README.txt'), readme.replace(/\r?\n/g, '\r\n'));

console.log('\nKiosk package');
console.log(`  ${relative(root, out)}/`);
console.log(`  release ${release.revision}, content ${bundle.contentRevision.slice(0, 12)}, from ${shortCommit}`);
console.log(`  ${bundle.people.length} people · lenses: ${bundle.lenses.join(', ')} · ${bundle.relationships.length} relationships`);
console.log(`  films: ${filmLine}`);
if (profileCounts) {
  console.log(`  profiles approved: ${profileCounts.approved} of ${profileCounts.total}`
    + (profileCounts.changedSinceApproval ? `, ${profileCounts.changedSinceApproval} changed since approval` : '')
    + (profileCounts.approved < profileCounts.total ? '  (npm run review:profiles -- --report)' : ''));
}
console.log(`  ${(manifest.bytes / 1e6).toFixed(1)} MB`);
console.log('\n  On the display: start-kiosk (or install-autostart to start at sign-in). See README.txt.');
console.log('  KIOSK ONLY. Never publish this folder.\n');

function profiles() {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning', '--input-type=module', '-e',
    `const { buildPeople } = await import(${JSON.stringify(pathToFileURL(join(root, 'packages/pipeline/src/build/people.ts')).href)});
     const { buildProfileSheet, profileProgress } = await import(${JSON.stringify(pathToFileURL(join(root, 'packages/pipeline/src/build/profiles.ts')).href)});
     console.log(JSON.stringify(profileProgress(buildProfileSheet(buildPeople()))));`,
  ], { cwd: root, encoding: 'utf8' });
  try { return JSON.parse(result.stdout); } catch { return null; }
}

function gitCommit() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
    return dirty ? `${sha}+uncommitted` : sha;
  } catch {
    return 'unknown';
  }
}

function folderBytes(directory) {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    total += entry.isDirectory() ? folderBytes(path) : statSync(path).size;
  }
  return total;
}
