import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Starting the kiosk app and reaching its exhibit page, for the scripts that
 * check the app as the display runs it (endurance.mjs, films.mjs).
 *
 * The app is started with settings of its own, in a temporary folder and on
 * its own port, so a display's settings and passcode are never touched. It is
 * reached over a fixed remote-debugging port, which survives the app
 * relaunching itself.
 */

export const appDir = resolve(import.meta.dirname, '..');
export const root = resolve(appDir, '../..');
export const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** --key=value arguments, and --flag as "true". */
export function parseArgs(argv) {
  return Object.fromEntries(argv.map((argument) => {
    const [key, ...rest] = argument.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : 'true'];
  }));
}

/** The app to run: the installed one (--executable) or the one staged here. Exits with a reason if there is none. */
export function resolveApp(args) {
  const packaged = args.executable ? resolve(args.executable) : null;
  const executable = packaged ?? join(appDir, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  if (!existsSync(executable)) {
    console.error(packaged
      ? `No app at ${packaged}.`
      : 'Electron is not installed here. Run npm install in apps/kiosk-app, or pass --executable=<the installed app>.');
    process.exit(2);
  }
  if (!packaged && !existsSync(join(appDir, 'stage', 'site', 'index.html'))) {
    console.error('No app staged. Run: npm run package:kiosk, then in apps/kiosk-app: npm run stage -- --site=../../release/cihof-kiosk-<release>/site');
    process.exit(2);
  }
  return { packaged, executable };
}

/** A temporary settings folder holding these settings. */
export function temporarySettings(prefix, settings) {
  const userData = mkdtempSync(join(tmpdir(), prefix));
  const settingsPath = join(userData, 'settings.json');
  writeFileSync(settingsPath, `${JSON.stringify({ startAtLogin: false, ...settings }, null, 2)}\n`);
  return { userData, settingsPath };
}

/** Starts the app; the child process carries an `exited` promise. */
export function launchApp({ executable, packaged, debugPort, userData }) {
  const child = spawn(executable, [
    // Running as root (a container) needs this; a display PC never runs as root.
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    `--remote-debugging-port=${debugPort}`,
    ...(packaged ? [] : [join(appDir, 'stage')]),
  ], { env: { ...process.env, CIHOF_USER_DATA: userData }, stdio: 'ignore' });
  child.exited = new Promise((done) => child.once('exit', done));
  return child;
}

/**
 * Connects to the running app and waits for its exhibit page on the attract
 * screen. `watch(page)` is called on the page before anything else happens
 * on it, to attach listeners.
 */
export async function connectExhibit({ debugPort, origin, timeoutMs, watch = () => {} }) {
  const deadline = Date.now() + timeoutMs;
  let browser = null;
  let page = null;
  while (Date.now() < deadline && !page) {
    try {
      browser ??= await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 5_000 });
      page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().startsWith(origin)) ?? null;
    } catch {
      browser = null;
    }
    if (!page) await wait(1_000);
  }
  if (!page) {
    await browser?.close().catch(() => undefined);
    throw new Error(`no exhibit page at ${origin} within ${Math.round(timeoutMs / 1000)} s`);
  }
  watch(page);
  try {
    await page.locator('.attract').waitFor({ state: 'visible', timeout: Math.max(5_000, deadline - Date.now()) });
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
  // A display window is the whole screen. One run without a window manager
  // (xvfb) is smaller, and the exhibit would lay itself out for a phone.
  let viewportNote = '';
  const size = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  if (size[0] < 1280) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    viewportNote = `The app's window was ${size[0]} × ${size[1]} (no window manager), so the exhibit was laid out at 1920 × 1080.`;
  }
  const session = await browser.newBrowserCDPSession();
  const { processInfo } = await session.send('SystemInfo.getProcessInfo');
  const pid = processInfo.find((entry) => entry.type === 'browser')?.id ?? null;
  return { browser, page, pid, viewportNote };
}

export function kill(pid) {
  try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
}
