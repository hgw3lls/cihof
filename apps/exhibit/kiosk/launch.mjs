#!/usr/bin/env node
/**
 * Runs the installed exhibit: the local server, and a browser held full screen
 * on it that comes back whenever it closes.
 *
 *   node launch.mjs                      start (what start-kiosk runs)
 *   node launch.mjs --stop               stop a running exhibit cleanly
 *   node launch.mjs --browser=<path>     use this browser instead of finding one
 *   node launch.mjs --restart-at=04:00   daily browser restart (default); "off" to disable
 *   node launch.mjs --no-browser         the server only, for checking from another screen
 *   node launch.mjs --port=8080
 *
 * The same on Windows, macOS and Linux. It finds Edge or Chrome where each
 * system installs it and runs it with its own profile folder beside this file,
 * so the kiosk never shares state with anybody's everyday browser, and a
 * browser that is already open elsewhere cannot swallow the launch.
 *
 * What it guards against, and how:
 *
 *   the browser closes or crashes  relaunched, backing off if it keeps failing
 *   memory creeps over weeks       the browser restarts once a day, at night
 *   the server fails               this exits non-zero, and start-kiosk starts it again
 *   staff need the desktop         stop-kiosk, which ends everything and is not relaunched
 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKioskServer } from './server.mjs';

/**
 * Where each system puts the browsers worth trying, most suitable first. Edge
 * leads on Windows because every Windows machine has it.
 *
 * @param {{ platform?: string, env?: Record<string, string | undefined>, exists?: (path: string) => boolean }} [options]
 * @returns {{ path: string, kind: 'edge' | 'chrome' | 'chromium' } | null}
 */
export function findBrowser({ platform = process.platform, env = process.env, exists = existsSync } = {}) {
  /** @type {Array<[string, 'edge' | 'chrome' | 'chromium']>} */
  let candidates = [];
  if (platform === 'win32') {
    const roots = [env['ProgramFiles(x86)'], env.ProgramFiles, env.LOCALAPPDATA].filter(Boolean);
    candidates = [
      ...roots.map((root) => [join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), 'edge']),
      ...roots.map((root) => [join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'), 'chrome']),
    ];
  } else if (platform === 'darwin') {
    candidates = [
      ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'chrome'],
      ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'edge'],
      ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'chromium'],
    ];
  } else {
    const onPath = (name) => (env.PATH ?? '').split(delimiter).filter(Boolean).map((dir) => join(dir, name));
    candidates = [
      ...onPath('google-chrome').map((path) => [path, 'chrome']),
      ...onPath('google-chrome-stable').map((path) => [path, 'chrome']),
      ...onPath('chromium').map((path) => [path, 'chromium']),
      ...onPath('chromium-browser').map((path) => [path, 'chromium']),
      ...onPath('microsoft-edge').map((path) => [path, 'edge']),
    ];
  }
  const found = candidates.find(([path]) => exists(path));
  return found ? { path: found[0], kind: found[1] } : null;
}

/**
 * How the browser is started: full screen, nothing to click away to, no
 * restore-session prompt after a power cut, no swipe-to-go-back, no pinch zoom
 * and no update nags. Edge and Chrome read the same flags.
 *
 * @param {{ url: string, profile: string, kind: string }} options
 * @returns {string[]}
 */
export function browserArgs({ url, profile, kind }) {
  return [
    '--kiosk',
    url,
    ...(kind === 'edge' ? ['--edge-kiosk-type=fullscreen'] : []),
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--noerrdialogs',
    '--disable-session-crashed-bubble',
    '--disable-infobars',
    '--disable-pinch',
    '--overscroll-history-navigation=0',
    '--disable-features=Translate,TouchpadOverscrollHistoryNavigation',
    '--check-for-update-interval=31536000',
  ];
}

/**
 * Milliseconds until the next "HH:MM" in local time, or null for "off".
 *
 * @param {string} at
 * @param {Date} [now]
 * @returns {number | null}
 */
export function msUntil(at, now = new Date()) {
  if (at === 'off') return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(at);
  if (!match) throw new Error(`--restart-at is "${at}". Use a time like 04:00, or off.`);
  const next = new Date(now);
  next.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Keeps one browser process running until stopped.
 *
 * A browser that exits is started again. One that dies within seconds, again
 * and again, is started with a growing pause (up to a minute) so a broken
 * install does not spin the machine; one that ran properly resets the pause.
 *
 * @param {{
 *   command: string, args: string[],
 *   spawnBrowser?: typeof spawn,
 *   log?: (line: string) => void,
 *   quickExitMs?: number, minBackoffMs?: number, maxBackoffMs?: number,
 * }} options
 */
export function keepBrowserRunning({
  command, args, spawnBrowser = spawn, log = console.log,
  quickExitMs = 10_000, minBackoffMs = 1000, maxBackoffMs = 60_000,
}) {
  let child = null;
  let stopped = false;
  let backoff = 0;
  let timer = null;
  let launches = 0;

  const launch = () => {
    if (stopped) return;
    launches += 1;
    const started = Date.now();
    child = spawnBrowser(command, args, { stdio: 'ignore' });
    child.on('error', (error) => log(`The browser could not be started: ${error.message}`));
    child.on('exit', () => {
      child = null;
      if (stopped) return;
      backoff = Date.now() - started < quickExitMs ? Math.min(Math.max(backoff * 2, minBackoffMs), maxBackoffMs) : 0;
      log(backoff > 0 ? `The browser closed quickly. Starting it again in ${backoff / 1000}s.` : 'The browser closed. Starting it again.');
      timer = setTimeout(launch, backoff);
    });
  };

  launch();

  return {
    /** Ends the current browser; it comes straight back, as after a crash. */
    restart() { if (child) child.kill(); },
    /** Ends the browser for good. */
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (child) child.kill();
    },
    get launches() { return launches; },
    get running() { return child !== null; },
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (const argument of argv) {
    if (!argument.startsWith('--')) continue;
    const [key, ...rest] = argument.slice(2).split('=');
    parsed[key] = rest.length > 0 ? rest.join('=') : true;
  }
  return parsed;
}

async function main() {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const stopFile = join(here, '.kiosk-stop');
  const args = parseArgs(process.argv.slice(2));

  if (args.stop) {
    // A file rather than a signal: on Windows a signal ends a process without
    // letting it close the browser it started, and the kiosk would stay up.
    writeFileSync(stopFile, new Date().toISOString());
    console.log('Asked the exhibit to stop. It will close within a few seconds.');
    return;
  }
  rmSync(stopFile, { force: true });

  const root = join(here, 'site');
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`No exhibit found at ${root}. Run this from the kiosk package folder.`);
    process.exit(1);
  }
  const port = Number(args.port || 8080);
  const url = `http://localhost:${port}/`;
  const restartAt = typeof args['restart-at'] === 'string' ? args['restart-at'] : '04:00';
  msUntil(restartAt); // Refuse a bad time now rather than at midnight.

  const server = createKioskServer({ root });
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Is the exhibit already running?`
      : `The exhibit server failed: ${error.message}`);
    process.exit(1);
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  console.log('Cleveland International Hall of Fame exhibit');
  console.log(`  serving ${url}`);

  let browser = null;
  if (!args['no-browser']) {
    const chosen = typeof args.browser === 'string'
      ? { path: resolve(args.browser), kind: /edge/i.test(args.browser) ? 'edge' : 'chrome' }
      : findBrowser();
    if (!chosen || !existsSync(chosen.path)) {
      console.error('No Edge or Chrome was found. Install one, or pass --browser=<path to the browser>.');
      process.exit(1);
    }
    console.log(`  browser ${chosen.path}`);
    browser = keepBrowserRunning({
      command: chosen.path,
      args: browserArgs({ url, profile: join(here, 'browser-profile'), kind: chosen.kind }),
    });

    const scheduleRestart = () => {
      const wait = msUntil(restartAt);
      if (wait === null) return;
      setTimeout(() => {
        console.log(`Daily browser restart (${restartAt}).`);
        browser.restart();
        scheduleRestart();
      }, wait);
    };
    scheduleRestart();
  }
  console.log('  stop    run stop-kiosk (or press Ctrl+C here)');

  const shutdown = (code) => {
    browser?.stop();
    server.close();
    rmSync(stopFile, { force: true });
    setTimeout(() => process.exit(code), 200);
  };
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  setInterval(() => {
    if (existsSync(stopFile) && statSync(stopFile).isFile()) {
      console.log('Stopped by stop-kiosk.');
      shutdown(0);
    }
  }, 1000);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
