import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Builds the CIHOF Staff Portal (the staff review app) for a staff computer: the review in a window of
 * its own, needing no git, Node or copy of the project there.
 *
 *   npm run package:review-app                      for this computer's system
 *   npm run package:review-app -- --target=win      a Windows installer (build on Windows)
 *   npm run package:review-app -- --target=win-zip  a portable Windows folder, from any system
 *   npm run package:review-app -- --target=mac | linux
 *   npm run package:review-app -- --stage-only      only stage it, for npm start in apps/review-app
 *
 * It carries the review (its pages and server, the pipeline, the apply tools
 * and the sign-off sheet, and the display's own code for content updates) as
 * they are in this checkout, and no records: the app reads those from a data
 * folder (npm run review:data), and decisions leave it as a file for npm run
 * review:import; or, as the staff portal, from a display's export, and
 * changes leave it as a display update. Written to release/review-app/,
 * which git ignores.
 */

const root = resolve(import.meta.dirname, '..');
const app = join(root, 'apps', 'review-app');
const stage = join(app, 'stage', 'runtime');
const args = process.argv.slice(2);
const argument = args.find((a) => a.startsWith('--target='));
const host = { win32: 'win', darwin: 'mac' }[process.platform] ?? 'linux';
const target = argument ? argument.slice('--target='.length) : host;
const builderArgs = {
  win: ['--win', 'nsis', '--x64'],
  'win-zip': ['--win', 'zip', '--x64'],
  mac: ['--mac', 'dmg'],
  linux: ['--linux', 'AppImage'],
}[target];
if (!builderArgs) {
  console.error(`--target=${target} is not one of win, win-zip, mac, linux.`);
  process.exit(1);
}

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...options });
  if (result.status !== 0) { console.error(`\n${command} ${commandArgs.join(' ')} failed.`); process.exit(result.status ?? 1); }
};

// 1. The review's pages, built from this checkout.
run('npm', ['run', 'build', '--workspace', '@cihof/review']);

// 2. The review's code, as git tracks it: nothing left lying in a folder.
rmSync(join(app, 'stage'), { recursive: true, force: true });
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'apps/review/server', 'apps/review/package.json',
  'apps/kiosk-app/src/zip.mjs', 'apps/kiosk-app/src/content-store.mjs', 'apps/kiosk-app/src/content-package.mjs', 'apps/kiosk-app/src/connection-auth.mjs', 'packages/content', 'packages/pipeline', 'scripts', 'docs/sign-off.md', 'package.json'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean)
  // The packages' tests and the pipeline's generating scripts stay behind.
  .filter((path) => !/^packages\/[^/]+\/tests\//.test(path));
for (const path of tracked) {
  const from = join(root, path);
  if (!existsSync(from)) continue;
  mkdirSync(dirname(join(stage, path)), { recursive: true });
  cpSync(from, join(stage, path));
}
cpSync(join(root, 'apps', 'review', 'dist'), join(stage, 'apps', 'review', 'dist'), { recursive: true });
// The exhibit with its editor, for the studio's preview: the same code as the display's, built from this checkout.
run(process.execPath, [join(root, 'scripts', 'build-exhibit-shell.mjs'), `--out=${join(stage, 'apps', 'review', 'exhibit-shell')}`]);
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'apps/review', 'packages', 'scripts'], { cwd: root, encoding: 'utf8' }).trim() ? '+changes' : '';
writeFileSync(join(stage, 'BUILD'), `${commit}${dirty} ${new Date().toISOString()}\n`);
console.log(`Staged the review from ${commit}${dirty}: ${tracked.length} files.`);
if (args.includes('--stage-only')) process.exit(0);

// 3. The app's own tools, installed only here and only when needed.
if (!existsSync(join(app, 'node_modules', 'electron-builder'))) run('npm', ['ci'], { cwd: app });
if (!existsSync(join(app, 'node_modules', 'electron', 'dist'))) run(process.execPath, [join(app, 'node_modules', 'electron', 'install.js')], { cwd: app });

// 4. Build.
run('npx', ['electron-builder', ...builderArgs], { cwd: app });
cpSync(join(root, 'docs', 'training', 'review-app.md'), join(root, 'release', 'review-app', 'REVIEW-APP-GUIDE.md'));
cpSync(join(root, 'docs', 'training', 'staff-portal.md'), join(root, 'release', 'review-app', 'STAFF-PORTAL-GUIDE.md'));
cpSync(join(root, 'docs', 'handover-checklist.md'), join(root, 'release', 'review-app', 'handover-checklist.md'));
// What those two point to, laid out as they name it: the staff guide, and the training folder.
cpSync(join(root, 'docs', 'staff-guide.md'), join(root, 'release', 'review-app', 'STAFF-GUIDE.md'));
cpSync(join(root, 'docs', 'training'), join(root, 'release', 'review-app', 'training'), { recursive: true });
console.log(`\nCIHOF Staff Portal for ${target} written to ${join(root, 'release', 'review-app')}`);
console.log('It carries no records: point it at a data folder made with npm run review:data.\n');
