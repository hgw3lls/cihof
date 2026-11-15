import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Builds the CIHOF Display Remote for Android (apps/display-remote): a phone
 * on the museum's network reaching a display's staff connection, to see what
 * it shows and put a display update on it. It edits nothing and carries no
 * content, but it is for staff: install it from the file, never a store.
 *
 *   npm run package:display-remote             a debug APK, signed with this computer's debug key
 *   npm run package:display-remote -- --release  signed with the museum's key (CIHOF_ANDROID_KEYSTORE…)
 *   npm run package:display-remote -- --test-only  only the tests
 *
 * The tests run first, against the display's own staff connection code. It
 * needs the Android SDK (ANDROID_HOME, or Homebrew's android-commandlinetools)
 * and Java 17. Written to release/display-remote/, which git ignores.
 */

const root = resolve(import.meta.dirname, '..');
const app = join(root, 'apps', 'display-remote');
const args = process.argv.slice(2);
const release = args.includes('--release');

const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, '/opt/homebrew/share/android-commandlinetools', '/usr/local/share/android-commandlinetools', join(homedir(), 'Library', 'Android', 'sdk'), join(homedir(), 'AppData', 'Local', 'Android', 'Sdk')]
  .find((folder) => folder && existsSync(join(folder, 'platforms')));
if (!sdk) {
  console.error('No Android SDK found. Install it (Android Studio, or brew install --cask android-commandlinetools and its platform), or set ANDROID_HOME.');
  process.exit(1);
}
writeFileSync(join(app, 'local.properties'), `sdk.dir=${sdk.replaceAll('\\', '\\\\')}\n`);
if (release && !process.env.CIHOF_ANDROID_KEYSTORE) {
  console.error('--release needs the museum\'s key: set CIHOF_ANDROID_KEYSTORE, CIHOF_ANDROID_KEYSTORE_PASSWORD, CIHOF_ANDROID_KEY_ALIAS and CIHOF_ANDROID_KEY_PASSWORD.');
  process.exit(1);
}

const gradlew = join(app, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const tasks = args.includes('--test-only') ? ['test'] : ['test', release ? 'assembleRelease' : 'assembleDebug'];
const result = spawnSync(gradlew, ['--no-daemon', `-Dcihof.node=${process.execPath}`, ...tasks], { cwd: app, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) { console.error('\nThe display remote did not build.'); process.exit(result.status ?? 1); }
if (args.includes('--test-only')) process.exit(0);

const kind = release ? 'release' : 'debug';
const built = join(app, 'app', 'build', 'outputs', 'apk', kind, `app-${kind}.apk`);
const version = /versionName = "([^"]+)"/.exec(readFileSync(join(app, 'app', 'build.gradle.kts'), 'utf8'))?.[1] ?? '0';
const out = join(root, 'release', 'display-remote');
mkdirSync(out, { recursive: true });
const name = `CIHOF-Display-Remote-${version}${release ? '' : '-debug'}.apk`;
copyFileSync(built, join(out, name));
copyFileSync(join(root, 'docs', 'training', 'display-remote.md'), join(out, 'DISPLAY-REMOTE-GUIDE.md'));
console.log(`\nCIHOF Display Remote written to ${join(out, name)}`);
if (!release) console.log('Debug-signed: an update to it installs only over one built on this same computer.');
