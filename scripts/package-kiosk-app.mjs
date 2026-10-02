import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/**
 * Builds the installed exhibit as a desktop app.
 *
 *   npm run package:kiosk-app                  for this computer's system
 *   npm run package:kiosk-app -- --target=win  a Windows installer (build on Windows)
 *   npm run package:kiosk-app -- --target=win-zip   a portable Windows folder, from any system
 *   npm run package:kiosk-app -- --target=mac | linux
 *   npm run package:kiosk-app -- --with-films  carry the films inside the app, as before
 *   npm run package:kiosk-app -- --keep-package  keep the kiosk package it is built from
 *
 * By default the app carries no films, so the installer is small: the display
 * plays them from a folder chosen in its admin panel (a copy of the project's
 * public/media/videos, on the display's own drive). With --with-films it
 * carries all of them, about 20 GB, and needs no folder.
 *
 * It is built from a kiosk package (npm run package:kiosk), which it makes
 * first in release/cihof-kiosk-<revision>/. Once the app is built, that
 * package has served its purpose, so it is removed, unless --keep-package is
 * given or the build fails. Only the package this run wrote is removed; every
 * other package in release/ is left alone. (The packaging step replaces a
 * package of the same release, so one by that name is this run's either way.)
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
const withFilms = process.argv.includes('--with-films');
const releases = join(root, 'release');
const packages = () => (existsSync(releases) ? readdirSync(releases).filter((name) => name.startsWith('cihof-kiosk-')) : []);
const started = Date.now();
run(process.execPath, [join(root, 'scripts', 'package-kiosk.mjs'), ...(withFilms ? [] : ['--without-films'])]);
const newest = packages()
  .map((name) => join(releases, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
// Written by this run: the packaging step deletes and recreates its folder,
// so this holds even when a package by that name was there before, as after
// a failed build or one run with --keep-package. Only that package is removed.
const madeHere = Boolean(newest) && statSync(newest).mtimeMs >= started - 1000;

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
copyFileSync(join(root, 'docs', 'opening-plan.md'), join(releases, 'app', 'opening-plan.md'));
cpSync(join(root, 'docs', 'training'), join(releases, 'app', 'training'), { recursive: true });
// What the release holds, films included or not, kept beside the installer.
if (existsSync(join(newest, 'MANIFEST.json'))) copyFileSync(join(newest, 'MANIFEST.json'), join(releases, 'app', 'MANIFEST.json'));

// The app carries the package's site, so the package itself is no longer needed.
if (madeHere && !process.argv.includes('--keep-package')) {
  rmSync(newest, { recursive: true, force: true });
  console.log(`\nRemoved the kiosk package it was built from (${basename(newest)}); pass --keep-package to keep it.`);
} else if (!madeHere) {
  console.log(`\nLeft ${basename(newest)} in place: this build did not write it.`);
}

console.log(`\nKiosk app for ${target} written to ${join(releases, 'app')}`);
console.log(withFilms
  ? 'It carries the films.'
  : 'It carries no films: on the display, choose the films folder in the admin panel (Films).');
console.log(withFilms
  ? 'KIOSK ONLY: it carries kiosk-only films. Never publish it.\n'
  : 'KIOSK ONLY: it carries the films\' kiosk-only captions and transcripts. Never publish it.\n');
