import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { browserArgs, findBrowser, keepBrowserRunning, msUntil } from '../kiosk/launch.mjs';

/**
 * The launcher that holds the exhibit on screen.
 *
 * What matters is what happens when things go wrong: the browser closes, keeps
 * crashing, or staff need the machine back.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for something the launcher does, rather than for a length of time. A
 * fixed wait is a race on a busy machine: a timer that is due runs before a
 * process's exit is reported (setImmediate), so a short wait could end before
 * the browser had even closed. The deadline is only there so a real failure
 * fails rather than hangs.
 */
async function until(condition: () => boolean, what: string, deadlineMs = 5000) {
  const giveUp = Date.now() + deadlineMs;
  while (!condition()) {
    if (Date.now() > giveUp) assert.fail(`timed out waiting until ${what}`);
    await wait(5);
  }
}

test('Edge is found first on Windows, then Chrome', () => {
  const env = { 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\kiosk\\AppData\\Local' };
  const both = findBrowser({ platform: 'win32', env, exists: () => true });
  assert.equal(both?.kind, 'edge');
  assert.match(both!.path, /msedge\.exe$/);
  const chromeOnly = findBrowser({ platform: 'win32', env, exists: (path) => path.endsWith('chrome.exe') });
  assert.equal(chromeOnly?.kind, 'chrome');
  assert.equal(findBrowser({ platform: 'win32', env, exists: () => false }), null);
});

test('macOS and Linux find their browsers where those systems put them', () => {
  const mac = findBrowser({ platform: 'darwin', env: {}, exists: (path) => path.includes('Microsoft Edge.app') });
  assert.equal(mac?.kind, 'edge');
  const linux = findBrowser({ platform: 'linux', env: { PATH: '/usr/local/bin:/usr/bin' }, exists: (path) => path === '/usr/bin/chromium' });
  assert.deepEqual(linux, { path: '/usr/bin/chromium', kind: 'chromium' });
});

test('the browser starts full screen, in its own profile, with nothing to wander off to', () => {
  const args = browserArgs({ url: 'http://localhost:8080/', profile: '/kiosk/browser-profile', kind: 'edge' });
  assert.deepEqual(args.slice(0, 2), ['--kiosk', 'http://localhost:8080/']);
  assert.ok(args.includes('--edge-kiosk-type=fullscreen'));
  assert.ok(args.includes('--user-data-dir=/kiosk/browser-profile'));
  assert.ok(args.includes('--disable-session-crashed-bubble'), 'no restore prompt after a power cut');
  assert.ok(args.includes('--overscroll-history-navigation=0'), 'no swipe back out of the exhibit');
  assert.ok(!browserArgs({ url: 'x', profile: 'p', kind: 'chrome' }).includes('--edge-kiosk-type=fullscreen'));
});

test('the daily restart comes at the next occurrence of its time', () => {
  const at = (hours: number, minutes = 0) => new Date(2026, 9, 1, hours, minutes);
  assert.equal(msUntil('04:00', at(3)), 60 * 60 * 1000);
  assert.equal(msUntil('04:00', at(5)), 23 * 60 * 60 * 1000);
  assert.equal(msUntil('04:00', at(4)), 24 * 60 * 60 * 1000, 'exactly on time means tomorrow, not now');
  assert.equal(msUntil('off'), null);
  assert.throws(() => msUntil('4am'), /Use a time like 04:00/);
});

/** A stand-in browser: a process that exits when told to, or by itself after `livesMs`. */
function fakeBrowsers(livesMs = Infinity) {
  const started: FakeBrowser[] = [];
  class FakeBrowser extends EventEmitter {
    timer: NodeJS.Timeout | null = null;
    constructor() {
      super();
      if (Number.isFinite(livesMs)) this.timer = setTimeout(() => this.emit('exit', 1), livesMs);
    }
    kill() { if (this.timer) clearTimeout(this.timer); setImmediate(() => this.emit('exit', null)); return true; }
  }
  const spawnBrowser = (() => {
    const browser = new FakeBrowser();
    started.push(browser);
    return browser as unknown as ChildProcess;
  }) as unknown as typeof spawn;
  return { started, spawnBrowser };
}

test('a browser that closes comes straight back, and a stopped one does not', async (t) => {
  const { started, spawnBrowser } = fakeBrowsers();
  const browser = keepBrowserRunning({ command: 'browser', args: [], spawnBrowser, log: () => {}, quickExitMs: 0 });
  // Stopped however the test ends: a launcher left running would keep the test process alive.
  t.after(() => browser.stop());
  assert.equal(started.length, 1);
  started[0]!.kill();
  await until(() => started.length === 2, 'it is relaunched after closing');
  browser.restart();
  await until(() => started.length === 3, 'the daily restart relaunches it');
  browser.stop();
  await until(() => !browser.running, 'the stopped browser has exited');
  // Long enough for a relaunch that should not happen to show itself.
  await wait(50);
  assert.equal(started.length, 3, 'stopped means stopped');
});

test('a browser that keeps dying at once is relaunched with a growing pause', async (t) => {
  const { started, spawnBrowser } = fakeBrowsers(5);
  const lines: string[] = [];
  const browser = keepBrowserRunning({
    command: 'browser', args: [], spawnBrowser, log: (line) => lines.push(line),
    quickExitMs: 1000, minBackoffMs: 20, maxBackoffMs: 80,
  });
  t.after(() => browser.stop());
  await until(() => lines.length >= 4, 'it has been relaunched four times');
  browser.stop();
  // The pause doubles from the least to the most, and stays there: a handful
  // of launches a second at worst, never hundreds.
  const pauses = lines.slice(0, 4).map((line) => line.match(/closed quickly\. Starting it again in ([\d.]+)s\./)?.[1]);
  assert.deepEqual(pauses, ['0.02', '0.04', '0.08', '0.08']);
});

test('the launcher serves the exhibit, holds a browser on it, and stop-kiosk ends both', { skip: process.platform === 'win32' && 'uses a shell script as the stand-in browser' }, async () => {
  const kiosk = fileURLToPath(new URL('../kiosk/', import.meta.url));
  const folder = mkdtempSync(join(tmpdir(), 'cihof-launch-'));
  for (const file of ['launch.mjs', 'server.mjs']) cpSync(join(kiosk, file), join(folder, file));
  mkdirSync(join(folder, 'site'));
  writeFileSync(join(folder, 'site', 'index.html'), '<!doctype html><title>exhibit</title>');

  // Records its arguments, then waits to be ended like a real browser.
  const log = join(folder, 'browser.log');
  const fake = join(folder, 'fake-browser');
  writeFileSync(fake, `#!/bin/sh\necho "$@" >> "${log}"\nexec sleep 30\n`);
  chmodSync(fake, 0o755);

  const port = 18000 + Math.floor(Math.random() * 1000);
  const launcher = spawn(process.execPath, [join(folder, 'launch.mjs'), `--browser=${fake}`, `--port=${port}`], { stdio: 'pipe' });
  const exited = new Promise<number | null>((resolve) => launcher.on('exit', resolve));
  try {
    for (let i = 0; i < 50 && !existsSync(log); i += 1) await wait(100);
    // The launcher is run through the folder as named, which on macOS is a link
    // (/var is /private/var), and keeps its profile beside its real self.
    assert.match(readFileSync(log, 'utf8'), new RegExp(`--kiosk http://localhost:${port}/ .*--user-data-dir=${realpathSync(folder)}/browser-profile`));
    assert.equal((await fetch(`http://localhost:${port}/`)).status, 200);

    spawn(process.execPath, [join(folder, 'launch.mjs'), '--stop']);
    const code = await Promise.race([exited, wait(8000).then(() => 'timeout')]);
    assert.equal(code, 0, 'a deliberate stop exits cleanly, so start-kiosk does not restart it');
    await assert.rejects(fetch(`http://localhost:${port}/`), 'the server is down');
  } finally {
    launcher.kill();
  }
});

test('a browser that cannot be started at all is retried, not left for dead', async (t) => {
  let attempts = 0;
  const spawnBrowser = (() => {
    attempts += 1;
    // Only an error, and no exit: what Node reports for a file it cannot run.
    // Like any child process it can be told to stop, which does nothing for a
    // process that never started.
    const failing = Object.assign(new EventEmitter(), { kill: () => false }) as unknown as ChildProcess;
    setImmediate(() => failing.emit('error', new Error('spawn EACCES')));
    return failing;
  }) as unknown as typeof spawn;
  const lines: string[] = [];
  const browser = keepBrowserRunning({
    command: 'browser', args: [], spawnBrowser, log: (line) => lines.push(line),
    quickExitMs: 1000, minBackoffMs: 10, maxBackoffMs: 40,
  });
  t.after(() => browser.stop());
  await until(() => attempts >= 3, 'it has tried three times');
  browser.stop();
  assert.ok(lines.some((line) => /could not be started \(spawn EACCES\)/.test(line)));
});
