import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { measure, startMeasuring, summarise, summaryLines, visit } from '../../exhibit/tests/endurance/visit.ts';
import { appDir, connectExhibit, kill, launchApp, parseArgs, resolveApp, root, temporarySettings, wait } from './driver.mjs';

/**
 * An endurance run of the kiosk app itself: the Electron app the display
 * runs, with its own server, daily restart and recovery, rather than the
 * exhibit in a browser.
 *
 *   npm run endurance:app                          an hour of visits, on the app staged in apps/kiosk-app/stage
 *   npm run endurance:app -- --minutes=480         a working day
 *   npm run endurance:app -- --executable="C:\Program Files\CIHOF Exhibit\CIHOF Exhibit.exe"
 *                                                  the installed app, on the display PC
 *
 * In order, it checks that the app:
 *   1. starts on its attract screen, served from this computer;
 *   2. comes back by itself after its daily restart (set a couple of minutes ahead for the run);
 *   3. holds up under simulated visits for --minutes, measured as `npm run endurance` does;
 *   4. comes back by itself when the exhibit page crashes;
 *   5. comes back by itself when the exhibit page freezes, with nobody touching it;
 *   6. starts again as it was after being killed outright, as a power cut would;
 *   7. never reached beyond this computer, which is what unplugging the network must not change.
 *
 * It runs with settings of its own in a temporary folder, on its own port, so
 * the display's settings and passcode are never touched. Close the exhibit
 * app first on a display PC: two cannot run at once.
 *
 * Options: --restart-in=2 (minutes; 0 skips the restart check), --port=18080
 * (the exhibit's), --debug-port=19333 (to reach the app), --film-seconds=20,
 * --no-films (visits never open a film: for a machine without the videos,
 * such as CI; npm run films:check covers the films on the build machine),
 * --idle-wait-seconds=240, --out=<folder>. On Linux it needs a display
 * (xvfb-run -a).
 *
 * It writes endurance-app.json and endurance-app.md to reports/endurance/…
 * and exits with 1 if a check failed or the visits have anything to look
 * at. It is evidence for the administrator's endurance sign-off, which is
 * still five days on the display (docs/sign-off.md, section 4).
 */

const args = parseArgs(process.argv.slice(2));
const number = (key, fallback, { zero = false } = {}) => {
  const value = args[key] === undefined ? fallback : Number(args[key]);
  if (!Number.isFinite(value) || value < 0 || (!zero && value === 0)) { console.error(`--${key} must be a positive number.`); process.exit(2); }
  return value;
};
const minutes = number('minutes', 60);
const restartIn = number('restart-in', 2, { zero: true });
const port = number('port', 18080);
const debugPort = number('debug-port', 19333);
const filmMs = number('film-seconds', 20) * 1000;
// A machine without the video files (CI) says so, rather than reporting every film as missing.
const films = args['no-films'] !== 'true';
const idleWaitMs = number('idle-wait-seconds', 240) * 1000;

const { packaged, executable } = resolveApp(args);

const origin = `http://127.0.0.1:${port}`;
const began = Date.now();
const clock = () => new Date(Date.now() - began).toISOString().slice(11, 19);
const say = (line) => console.log(`${clock()}  ${line}`);

// Settings of the run's own, so the display's are never touched.
const restartAt = (() => {
  if (restartIn === 0) return 'off';
  // The minute after restartIn minutes from now, so it is never less than that away.
  const at = new Date(Date.now() + (restartIn + 1) * 60_000);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
})();
const { userData, settingsPath } = temporarySettings('cihof-endurance-', { port, restartAt });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = resolve(args.out ?? join(root, 'reports', 'endurance', `app-${stamp}`));
mkdirSync(out, { recursive: true });

// ------------------------------------------------------------ the app

let child = null;
const launch = () => { child = launchApp({ executable, packaged, debugPort, userData }); };

const errors = [];
const external = new Set();
let browser = null;
let page = null;
let appPid = null;
let viewportNote = '';

const note = (kind, text) => { errors.push({ atMs: Date.now() - began, kind, text: text.slice(0, 500) }); say(`! ${kind}: ${text.split('\n')[0]}`); };

/** Connects to the running app and waits for its exhibit page on the attract screen. */
async function connect(timeoutMs) {
  await browser?.close().catch(() => undefined);
  browser = null;
  page = null;
  const connected = await connectExhibit({ debugPort, origin, timeoutMs, watch: (exhibit) => {
    exhibit.on('pageerror', (error) => note('page error', error.message));
    // A file the page could not load is named by its response, below, not by the console's anonymous line.
    exhibit.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) note('console error', message.text());
    });
    exhibit.on('response', (response) => {
      if (response.status() >= 400) note('missing file', `${response.status()} ${new URL(response.url()).pathname}`);
    });
    exhibit.on('request', (request) => {
      const url = new URL(request.url());
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return;
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) external.add(`${url.origin}${url.pathname}`);
    });
  } });
  ({ browser, page } = connected);
  appPid = connected.pid;
  viewportNote ||= connected.viewportNote;
  return page;
}

/**
 * Asks the exhibit page for the run's mark, outside Playwright, which does
 * not survive the page it is attached to being crashed or frozen under it.
 * Null when there is no answer within a moment: a frozen page, or none yet.
 */
async function askPage() {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    const target = targets.find((entry) => entry.type === 'page' && entry.url.startsWith(origin));
    if (!target) return null;
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    try {
      return await Promise.race([
        new Promise((done, fail) => {
          socket.onerror = () => fail(new Error('unreachable'));
          socket.onmessage = (message) => {
            const reply = JSON.parse(String(message.data));
            if (reply.id === 1) done({ mark: reply.result?.result?.value ?? 'none' });
          };
          socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'window.__endurance ?? "none"', returnByValue: true } }));
        }),
        wait(2_000).then(() => null),
      ]);
    } finally {
      socket.close();
    }
  } catch {
    return null;
  }
}

/** Waits for the page to be a fresh one (without the mark) on the attract screen. */
async function comesBack(mark, timeoutMs) {
  const since = Date.now();
  await browser?.close().catch(() => undefined);
  browser = null;
  while (Date.now() - since < timeoutMs) {
    const answer = await askPage();
    // Any fresh answer will do after a restart; after a crash or freeze, not the marked page's.
    if (answer && (mark === undefined || answer.mark !== mark)) {
      try {
        await connect(Math.max(5_000, timeoutMs - (Date.now() - since)));
        return Math.round((Date.now() - since) / 1000);
      } catch { /* not settled yet */ }
    }
    await wait(1_000);
  }
  throw new Error(`not back on the attract screen within ${Math.round(timeoutMs / 1000)} s`);
}

/** Sends one command straight to the exhibit page, outside Playwright (see askPage). */
async function sendToPage(method, params = {}) {
  await browser?.close().catch(() => undefined);
  browser = null;
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const target = targets.find((entry) => entry.type === 'page' && entry.url.startsWith(origin));
  if (!target) throw new Error('the exhibit page could not be found');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = () => fail(new Error('could not reach the exhibit page')); });
  socket.send(JSON.stringify({ id: 1, method, params }));
  await wait(500);
  socket.close();
}

// ------------------------------------------------------------ the checks

const checks = [];
async function check(name, run) {
  const started = Date.now();
  say(`${name}…`);
  try {
    const detail = await run();
    checks.push({ name, ok: true, detail: detail ?? '', seconds: Math.round((Date.now() - started) / 1000) });
    say(`✓ ${name}${detail ? ` (${detail})` : ''}`);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    checks.push({ name, ok: false, detail, seconds: Math.round((Date.now() - started) / 1000) });
    say(`✗ ${name}: ${detail}`);
    return false;
  }
}

// Playwright gives up on a page that crashes under it, and says so by throwing
// where nothing can catch it. A crash the run did not cause is a finding, not
// the end of the run.
process.on('uncaughtException', (error) => {
  if (!String(error?.message).includes('Target crashed')) throw error;
  note('crash', 'the exhibit page crashed');
  browser = null;
});

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) { if (appPid) kill(appPid); process.exit(130); }
  stopping = true;
  console.log('\nStopping after this step. Ctrl+C again to stop at once, without a report.');
});

const samples = [];
const save = (extra = {}) => writeFileSync(join(out, 'endurance-app.json'), `${JSON.stringify({
  app: packaged ?? 'staged (apps/kiosk-app/stage)', release: releaseInfo(), minutes, restartAt, port, films, filmMs, idleWaitMs,
  startedAt: new Date(began).toISOString(), checks, samples, errors, external: [...external], ...extra,
}, null, 2)}\n`);

function releaseInfo() {
  try {
    const site = packaged ? null : join(appDir, 'stage', 'site');
    return site ? JSON.parse(readFileSync(join(site, 'release.json'), 'utf8')).revision : 'as installed';
  } catch { return 'unknown'; }
}

console.log(`Kiosk app endurance run: ${packaged ?? 'the staged app'}, ${minutes} minute(s) of visits.\n`);
launch();

const started = await check('It starts on its attract screen, served from this computer', async () => {
  await connect(60_000);
  const url = new URL(page.url());
  if (url.origin !== origin) throw new Error(`the exhibit is at ${url.origin}`);
  return `${url.origin}, attract screen "${url.searchParams.get('attract')}"`;
});

if (started && restartIn > 0 && !stopping) {
  await check(`The daily restart (set for ${restartAt}) brings it back by itself`, async () => {
    const before = appPid;
    const exited = await Promise.race([child.exited.then(() => true), wait((restartIn + 2) * 60_000).then(() => false)]);
    if (!exited) throw new Error(`the app did not restart at ${restartAt}`);
    const seconds = await comesBack(undefined, 90_000);
    if (appPid === before) throw new Error('the same app process is still running');
    return `back on the attract screen ${seconds} s after it restarted`;
  });
}

if (started && !stopping) {
  await check(`It holds up under ${minutes} minute(s) of simulated visits${films ? '' : ', without films'}`, async () => {
    const session = await startMeasuring(page);
    const deadline = Date.now() + minutes * 60_000;
    for (let index = 0; Date.now() < deadline && !stopping; index += 1) {
      const result = await visit(page, index, { filmMs, idleWaitMs, films });
      const sample = { ...result, ...(await measure(session)), atMs: Date.now() - began };
      samples.push(sample);
      save();
      say(`visit ${index + 1}: ${result.lenses.join(', ')}${result.opened ? `, ${result.opened}` : ''}${result.film ? ', film' : ''}${result.share ? ', take it with you' : ''}; ${result.ended}; ${result.returned ? 'back on the attract screen' : 'NOT back on the attract screen'}. ${sample.heapMB} MB, ${sample.nodes} elements, ${sample.listeners} listeners`);
      for (const problem of result.problems) say(`! ${problem}`);
    }
    const concerns = summarise(samples, errors.length).concerns;
    if (concerns.length) throw new Error(concerns.join(' '));
    return `${samples.length} visits, nothing to look at`;
  });
}

if (started && !stopping) {
  await check('A crashed exhibit page comes back by itself', async () => {
    await page.evaluate(() => { window.__endurance = 'crash'; });
    await sendToPage('Page.crash');
    const seconds = await comesBack('crash', 60_000);
    return `back on the attract screen after ${seconds} s`;
  });
}

if (started && !stopping) {
  await check('A frozen exhibit page comes back by itself, with nobody touching it', async () => {
    await page.evaluate(() => { window.__endurance = 'freeze'; });
    // A page stuck in a loop. It stops checking in with the app, which
    // restarts it after 30 seconds of silence.
    await sendToPage('Runtime.evaluate', { expression: 'setTimeout(() => { for (;;) {} }, 0)' });
    const seconds = await comesBack('freeze', 150_000);
    return `back on the attract screen after ${seconds} s`;
  });
}

if (started && !stopping) {
  await check('Killed outright, as a power cut would, it starts again as it was', async () => {
    const settingsBefore = readFileSync(settingsPath, 'utf8');
    const pid = appPid;
    if (!pid) throw new Error('the app process could not be found');
    await browser?.close().catch(() => undefined);
    kill(pid);
    await wait(3_000);
    launch();
    const seconds = await comesBack(undefined, 90_000);
    const settingsAfter = readFileSync(settingsPath, 'utf8');
    JSON.parse(settingsAfter);
    if (settingsAfter !== settingsBefore) throw new Error('its settings changed');
    return `back on the attract screen ${seconds} s after it was started again, with its settings as they were`;
  });
}

await check('It never reached beyond this computer', async () => {
  if (external.size) throw new Error(`it asked for ${[...external].slice(0, 5).join(', ')}${external.size > 5 ? ` and ${external.size - 5} more` : ''}`);
  return 'every request was to this computer';
});

// ------------------------------------------------------------ the report

if (appPid) kill(appPid);
if (child?.pid) kill(child.pid);
await browser?.close().catch(() => undefined);

const summary = summarise(samples, errors.length);
const failed = checks.filter((entry) => !entry.ok);
save({ summary, finishedAt: new Date().toISOString() });
writeFileSync(join(out, 'endurance-app.md'), [
  '# Kiosk app endurance run',
  '',
  `- App: ${packaged ?? 'the staged app (apps/kiosk-app/stage)'}, release ${releaseInfo()}`,
  `- Started ${new Date(began).toLocaleString()}, took ${Math.round((Date.now() - began) / 60_000)} minute(s), ${samples.length} simulated visits`,
  ...(viewportNote ? [`- ${viewportNote}`] : []),
  '',
  failed.length === 0 ? '**Every check passed.**' : `**${failed.length} check(s) failed.**`,
  '',
  '| Check | | What happened |',
  '| --- | --- | --- |',
  ...checks.map((entry) => `| ${entry.name} | ${entry.ok ? 'Passed' : '**Failed**'} | ${entry.detail.replace(/\|/g, '\\|')} |`),
  '',
  '## The visits',
  '',
  ...(samples.length ? summaryLines(summary) : ['No visits were made.']),
  '',
  ...(errors.length ? ['## Errors', '', ...errors.slice(0, 50).map((error) => `- ${new Date(error.atMs).toISOString().slice(11, 19)} ${error.kind}: ${error.text.split('\n')[0]}`), ''] : []),
  'Every visit, with its measurements, is in `endurance-app.json` beside this report.',
  '',
  'This run is evidence for the endurance sign-off (docs/sign-off.md, section 4), not the sign-off.',
  'It kills the app to stand in for a power cut; it cannot switch the PC off, so whether Windows',
  'starts the app again after a real power cut is still to be checked on the display, with the',
  'five days, the nightly restarts and the network unplugged.',
  '',
].join('\n'));
rmSync(userData, { recursive: true, force: true });

console.log(`\n${failed.length === 0 ? 'Every check passed.' : `${failed.length} check(s) failed.`}`);
console.log(`Report: ${relative(root, join(out, 'endurance-app.md'))}`);
process.exit(failed.length === 0 ? 0 : 1);
