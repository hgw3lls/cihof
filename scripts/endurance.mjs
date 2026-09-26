import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createKioskServer } from '../apps/exhibit/kiosk/server.mjs';
import { measure, startMeasuring, summarise, visit } from '../apps/exhibit/tests/endurance/visit.ts';

/**
 * An endurance run: the display build, left running for hours, with simulated
 * visitors coming and going, and a record of what the page holds as it goes.
 *
 *   npm run endurance                                  an hour, on the newest package in release/
 *   npm run endurance -- --minutes=480                 a working day
 *   npm run endurance -- --url=http://localhost:8080/  a display already running
 *   npm run endurance -- --channel=msedge              in Microsoft Edge, as on the display
 *
 * Options: --site=<folder> serves another built site; --film-seconds=20 is how
 * long a visitor watches a film; --idle-wait-seconds=240 is how long to wait
 * for a visit left alone to end (the display waits 150); --headed shows the
 * browser; --executable=<path> runs a particular Chromium or Chrome;
 * --out=<folder> is where the report goes (reports/endurance/…).
 *
 * It writes endurance.json (every visit) as it goes, and endurance.md when it
 * finishes or is stopped with Ctrl+C. It exits with 1 if the report has
 * anything to look at.
 *
 * This is evidence for the administrator's endurance sign-off, not the
 * sign-off itself: the five days on the display, the nightly restarts and the
 * power cut are still to be done there (docs/sign-off.md, section 4).
 */

const root = resolve(import.meta.dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...rest] = argument.replace(/^--/, '').split('=');
  return [key, rest.length ? rest.join('=') : 'true'];
}));
const number = (key, fallback) => {
  const value = args[key] === undefined ? fallback : Number(args[key]);
  if (!Number.isFinite(value) || value <= 0) { console.error(`--${key} must be a positive number.`); process.exit(2); }
  return value;
};
const minutes = number('minutes', 60);
const filmMs = number('film-seconds', 20) * 1000;
const idleWaitMs = number('idle-wait-seconds', 240) * 1000;

function newestPackage() {
  const release = join(root, 'release');
  if (!existsSync(release)) return null;
  const packages = readdirSync(release)
    .filter((name) => name.startsWith('cihof-kiosk-') && existsSync(join(release, name, 'site', 'index.html')))
    .map((name) => join(release, name, 'site'))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return packages[0] ?? null;
}

let server = null;
let url = args.url;
if (!url) {
  const site = args.site ? resolve(args.site) : newestPackage();
  if (!site || !existsSync(join(site, 'index.html'))) {
    console.error('Nothing to run. Package the display build first (npm run package:kiosk), or pass --site=<built site> or --url=<a running display>.');
    process.exit(2);
  }
  server = createKioskServer({ root: site });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`Serving ${relative(root, site) || site} at ${url}`);
}
if (!url.endsWith('/')) url += '/';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = resolve(args.out ?? join(root, 'reports', 'endurance', stamp));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  ...(args.channel ? { channel: args.channel } : {}),
  ...(args.executable ? { executablePath: resolve(args.executable) } : {}),
  headless: args.headed !== 'true',
  // A display plays films without anyone having pressed anything first.
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
const note = (kind, text) => { errors.push({ atMs: Date.now() - began, kind, text: text.slice(0, 500) }); console.log(`  ! ${kind}: ${text.split('\n')[0]}`); };
page.on('pageerror', (error) => note('page error', error.message));
page.on('console', (message) => { if (message.type() === 'error') note('console error', message.text()); });
page.on('requestfailed', (request) => {
  const failure = request.failure()?.errorText ?? '';
  // A film closed mid-stream cancels its own request; that is not a fault.
  if (failure.includes('ERR_ABORTED') && ['media', 'image'].includes(request.resourceType())) return;
  note('request failed', `${request.url()} ${failure}`);
});
let crashed = false;
page.on('crash', () => { crashed = true; note('crash', 'the page crashed'); });

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) process.exit(130);
  stopping = true;
  console.log('\nStopping after this visit. Ctrl+C again to stop at once, without a report.');
});

const began = Date.now();
await page.goto(url);
const release = await page.evaluate(async () => {
  try { return await (await fetch('release.json', { cache: 'no-store' })).json(); } catch { return null; }
});
const session = await startMeasuring(page);
const samples = [];
const deadline = began + minutes * 60_000;
const save = (extra = {}) => writeFileSync(join(out, 'endurance.json'), `${JSON.stringify({
  url, release, minutes, filmMs, idleWaitMs, browser: `${args.channel ?? 'chromium'} ${browser.version()}`,
  startedAt: new Date(began).toISOString(), samples, errors, ...extra,
}, null, 2)}\n`);

console.log(`Running for ${minutes} minute(s). Ctrl+C stops early and still writes the report.\n`);
for (let index = 0; Date.now() < deadline && !stopping && !crashed; index += 1) {
  const result = await visit(page, index, { filmMs, idleWaitMs });
  if (crashed) break;
  const sample = { ...result, ...(await measure(session)), atMs: Date.now() - began };
  samples.push(sample);
  save();
  const clock = new Date(sample.atMs).toISOString().slice(11, 19);
  console.log(`${clock}  visit ${index + 1}: ${result.lenses.join(', ')}${result.opened ? `, ${result.opened}` : ''}${result.film ? ', film' : ''}${result.share ? ', take it with you' : ''}; ${result.ended}; ${result.returned ? 'back on the attract screen' : 'NOT back on the attract screen'}. ${sample.heapMB} MB, ${sample.nodes} elements, ${sample.listeners} listeners`);
  for (const problem of result.problems) console.log(`  ! ${problem}`);
  // A visit that could not get back leaves the next one nowhere to start.
  if (!result.returned) await page.goto(url).catch(() => undefined);
}

const summary = summarise(samples, errors.filter((error) => error.kind !== 'request failed').length + (crashed ? 1 : 0));
const failedRequests = errors.filter((error) => error.kind === 'request failed').length;
const concerns = [...summary.concerns, ...(failedRequests ? [`${failedRequests} request(s) failed.`] : [])];
save({ summary: { ...summary, concerns }, finishedAt: new Date().toISOString() });
writeFileSync(join(out, 'endurance.md'), report(summary, concerns));
await browser.close();
server?.close();

console.log(`\n${concerns.length === 0 ? 'Nothing to look at.' : concerns.map((concern) => `! ${concern}`).join('\n')}`);
console.log(`\nReport: ${relative(root, join(out, 'endurance.md'))}`);
process.exit(concerns.length === 0 ? 0 : 1);

function report(summary, concerns) {
  const lines = [
    '# Endurance run',
    '',
    `- Build: ${release ? `release ${release.revision ?? '?'}${release.target ? `, ${release.target}` : ''}` : 'release not reported'}, at ${url}`,
    `- Browser: ${args.channel ?? 'chromium'} ${browser.version()}, 1920 × 1080`,
    `- Started ${new Date(began).toLocaleString()}, ran ${summary.hours} hour(s), ${summary.visits} simulated visits`,
    '',
    concerns.length === 0 ? '**Nothing to look at.**' : '**To look at:**',
    ...concerns.map((concern) => `- ${concern}`),
    '',
    '| | At the start | At the end | Highest |',
    '| --- | ---: | ---: | ---: |',
    `| Memory the page keeps (MB) | ${summary.heap.startMB} | ${summary.heap.endMB} | ${summary.heap.peakMB} |`,
    `| Elements | ${summary.nodes.start} | ${summary.nodes.end} | ${summary.nodes.peak} |`,
    `| Event listeners | ${summary.listeners.start} | ${summary.listeners.end} | ${summary.listeners.peak} |`,
    '',
    `Memory trend: ${summary.heap.mbPerHour} MB an hour. Measured after each visit, back on the attract screen, after a garbage collection; the start is after the first few visits have warmed the page up.`,
    '',
    `- Visits that did not end on the attract screen: ${summary.notReturned}`,
    `- Visits that could not do something a visitor would: ${summary.visitProblems}`,
    `- Errors the page reported: ${summary.pageErrors}`,
    '',
    'Every visit, with its measurements, is in `endurance.json` beside this report.',
    '',
    'This run is evidence for the endurance sign-off (docs/sign-off.md, section 4), not the sign-off:',
    'the days on the display itself, the nightly restarts and the power cut are still to be checked there.',
    '',
  ];
  if (errors.length) {
    lines.splice(lines.length - 5, 0, '## Errors', '', ...errors.slice(0, 50).map((error) => `- ${new Date(error.atMs).toISOString().slice(11, 19)} ${error.kind}: ${error.text.split('\n')[0]}`), ...(errors.length > 50 ? [`- … and ${errors.length - 50} more in endurance.json`] : []), '');
  }
  return lines.join('\n');
}
