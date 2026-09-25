import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Builds the installed exhibit as a desktop app.
 *
 *   npm run package:kiosk-app                  for this computer's system
 *   npm run package:kiosk-app -- --target=win  a Windows installer (build on Windows)
 *   npm run package:kiosk-app -- --target=win-zip   a portable Windows folder, from any system
 *   npm run package:kiosk-app -- --target=mac | linux
 *
 * Writes to release/app/. Like the kiosk package it carries kiosk-only films,
 * so it is built by hand, on the machine that holds the video files, and never
 * published. The Windows installer needs Windows (or Wine) to build; the
 * portable zip does not.
 */

const root = resolve(import.meta.dirname, '..');
const app = join(root, 'apps', 'kiosk-app');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...options });
  if (result.status !== 0) {
    console.error(`\n${command} ${args.join(' ')} failed. Nothing more was built.`);
    process.exit(result.status ?? 1);
  }
};

const argument = process.argv.slice(2).find((a) => a.startsWith('--target='));
const host = { win32: 'win', darwin: 'mac' }[process.platform] ?? 'linux';
const target = argument ? argument.slice('--target='.length) : host;
const builderArgs = {
  // The installer is built on Windows (or Wine), where the program file can be
  // given its icon and version details; the portable zip is built anywhere, so
  // it leaves the program file as Electron ships it.
  win: ['--win', 'nsis', '--x64', '-c.win.signAndEditExecutable=true'],
  'win-zip': ['--win', 'zip', '--x64'],
  mac: ['--mac', 'dmg'],
  linux: ['--linux', 'AppImage'],
}[target];
if (!builderArgs) {
  console.error(`--target=${target} is not one of win, win-zip, mac, linux.`);
  process.exit(1);
}
if (target === 'win' && process.platform !== 'win32' && spawnSync('wine', ['--version']).status !== 0) {
  console.error('The Windows installer is built on Windows (or with Wine installed).');
  console.error('Build it on the Windows machine that holds the films, or use --target=win-zip for a portable folder.');
  process.exit(1);
}

// 1. The exhibit itself: the kiosk build, served at "/".
run(process.execPath, [join(root, 'scripts', 'package-kiosk.mjs')]);
const releases = join(root, 'release');
const newest = readdirSync(releases)
  .filter((name) => name.startsWith('cihof-kiosk-'))
  .map((name) => join(releases, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

// 2. The app's own tools, installed only here and only when needed.
if (!existsSync(join(app, 'node_modules', 'electron-builder'))) run('npm', ['ci'], { cwd: app });
if (!existsSync(join(app, 'node_modules', 'electron', 'dist'))) {
  run(process.execPath, [join(app, 'node_modules', 'electron', 'install.js')], { cwd: app });
}

// 3. Stage and build.
run(process.execPath, [join(app, 'scripts', 'stage.mjs'), `--site=${join(newest, 'site')}`], { cwd: app });
run('npx', ['electron-builder', ...builderArgs], { cwd: app });
// Beside the installer, so whoever installs it has the guide for that release.
copyFileSync(join(root, 'docs', 'staff-guide.md'), join(releases, 'app', 'STAFF-GUIDE.md'));
copyFileSync(join(root, 'docs', 'sign-off.md'), join(releases, 'app', 'sign-off.md'));

console.log(`\nKiosk app for ${target} written to ${join(releases, 'app')}`);
console.log('KIOSK ONLY: it carries kiosk-only films. Never publish it.\n');
