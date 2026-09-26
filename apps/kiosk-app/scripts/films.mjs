import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { connectExhibit, kill, launchApp, parseArgs, resolveApp, root, temporarySettings, wait } from './driver.mjs';
import { clock, judgeFilm } from './film-judge.mjs';

/**
 * Plays every film on the display, in the kiosk app, the way a visitor would
 * reach it: the person's record, then Watch the film.
 *
 *   npm run films:check                        every film, in the app staged in apps/kiosk-app/stage
 *   npm run films:check -- --executable="C:\Program Files\CIHOF Exhibit\CIHOF Exhibit.exe"
 *   npm run films:check -- --only=berj-shakarian-2020   one person, or one film by its id
 *
 * For each film it checks that the video is there and plays with a picture
 * and sound, is as long as the exhibit expects, opens where a ceremony film
 * should, has its captions shown and fitting the film, and has a transcript.
 * The kiosk app plays films the way the display will; a test browser without
 * the MP4 codecs cannot, which is why this runs in the app.
 *
 * Run it on the build machine, with the videos, on the release about to be
 * handed over (Windows checklist A). It writes films-check.md and
 * films-check.json to reports/films/… and exits with 1 if any film has a
 * problem. Options: --play-seconds=4, --port=18090, --debug-port=19334,
 * --out=<folder>. On Linux it needs a display (xvfb-run -a).
 *
 * It checks what a machine can. Whether the captions say what is said, and
 * whether the sound is right in the gallery, is for people (sign-off 2).
 */

const args = parseArgs(process.argv.slice(2));
const positive = (key, fallback) => {
  const value = args[key] === undefined ? fallback : Number(args[key]);
  if (!Number.isFinite(value) || value <= 0) { console.error(`--${key} must be a positive number.`); process.exit(2); }
  return value;
};
const playMs = positive('play-seconds', 4) * 1000;
const port = positive('port', 18090);
const debugPort = positive('debug-port', 19334);
const { packaged, executable } = resolveApp(args);
const origin = `http://127.0.0.1:${port}`;

const { userData } = temporarySettings('cihof-films-', { port, restartAt: 'off' });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = resolve(args.out ?? join(root, 'reports', 'films', stamp));
mkdirSync(out, { recursive: true });

const child = launchApp({ executable, packaged, debugPort, userData });
let missing = [];
const { browser, page, pid, viewportNote } = await connectExhibit({ debugPort, origin, timeoutMs: 60_000, watch: (exhibit) => {
  exhibit.on('response', (response) => {
    if (response.status() >= 400) missing.push(new URL(response.url()).pathname);
  });
} });

const bundle = await page.evaluate(async () => (await fetch('/data/exhibit.json', { cache: 'no-store' })).json());
const release = await page.evaluate(async () => {
  try { return (await (await fetch('/release.json', { cache: 'no-store' })).json()).revision; } catch { return 'unknown'; }
});
const holdings = bundle.people
  .flatMap((person) => person.films.map((film, index) => ({ person, film, index })))
  .filter(({ person, film }) => !args.only || args.only === person.id || args.only === film.id);
if (holdings.length === 0) {
  console.error(args.only ? `No person or film "${args.only}" on this release.` : 'This release has no films.');
  await finish(2);
}

console.log(`Checking ${holdings.length} film(s) on release ${release}, in the kiosk app.\n`);

const results = [];
for (const [position, { person, film, index }] of holdings.entries()) {
  missing = [];
  let seen = null;
  let problems;
  try {
    seen = await watch(person, index, person.films.length);
    problems = judgeFilm(film, { ...seen, missing: [...new Set(missing)] });
  } catch (error) {
    problems = [`The check could not open it: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`];
  }
  results.push({ person: person.id, name: person.name, film: film.id, source: film.source?.src ?? null, seen, problems });
  console.log(`${String(position + 1).padStart(3)}/${holdings.length}  ${problems.length ? '✗' : '✓'} ${person.name}, ${person.films.length > 1 ? `film ${index + 1}` : 'film'} ${film.id}${seen?.duration ? ` (${clock(seen.duration)})` : ''}`);
  for (const problem of problems) console.log(`         ${problem}`);
  await backToStart();
}

const failed = results.filter((result) => result.problems.length > 0);
writeFileSync(join(out, 'films-check.json'), `${JSON.stringify({ release, app: packaged ?? 'staged (apps/kiosk-app/stage)', checkedAt: new Date().toISOString(), playMs, results }, null, 2)}\n`);
writeFileSync(join(out, 'films-check.md'), [
  '# Film check',
  '',
  `- Release ${release}, in ${packaged ?? 'the staged app (apps/kiosk-app/stage)'}`,
  `- Checked ${new Date().toLocaleString()}: ${results.length} film(s), each played for ${playMs / 1000} s`,
  ...(viewportNote ? [`- ${viewportNote}`] : []),
  '',
  failed.length === 0
    ? `**All ${results.length} films play, with picture, sound, captions and a transcript.**`
    : `**${failed.length} of ${results.length} films have a problem.**`,
  '',
  ...(failed.length ? [
    '| Person | Film | Problem |',
    '| --- | --- | --- |',
    ...failed.flatMap((result) => result.problems.map((problem, line) => `| ${line ? '' : result.name} | ${line ? '' : `\`${result.film}\``} | ${problem.replace(/\|/g, '\\|')} |`)),
    '',
  ] : []),
  'Every film, with what was seen, is in `films-check.json` beside this report.',
  '',
  'This checks what a machine can. Whether the captions say what is said, and whether the sound',
  'is right in the gallery, is for people: sign-off 2 in docs/sign-off.md.',
  '',
].join('\n'));
console.log(`\n${failed.length === 0 ? `All ${results.length} films play.` : `${failed.length} of ${results.length} films have a problem.`}`);
console.log(`Report: ${relative(root, join(out, 'films-check.md'))}`);
await finish(failed.length === 0 ? 0 : 1);

// ------------------------------------------------------------------ steps

/** Opens the person's record and their film, plays it, and reports what it saw. */
async function watch(person, index, count) {
  await page.locator('[data-begin]').first().click({ timeout: 10_000 });
  const found = await page.evaluate((name) => {
    const tile = [...document.querySelectorAll('.tile')].find((button) => button.querySelector('.caption')?.textContent?.trim() === name);
    tile?.click();
    return Boolean(tile);
  }, person.name);
  if (!found) throw new Error(`no portrait for ${person.name}`);
  await page.getByRole('button', { name: 'Read the record' }).click({ timeout: 10_000 });
  await page.getByRole('button', { name: count > 1 ? new RegExp(`^Watch film ${index + 1}\\b`) : /^Watch the film/ }).click({ timeout: 10_000 });
  await page.locator('dialog.film').waitFor({ state: 'visible', timeout: 10_000 });

  // Loaded enough to know its length and picture, or the display has given up on it.
  await page.waitForFunction(() => {
    const video = document.querySelector('dialog.film video');
    return !video || video.readyState >= 1 || video.error;
  }, null, { timeout: 30_000 }).catch(() => undefined);
  const shown = await page.locator('dialog.film .film__problem[role="alert"] p').first().textContent({ timeout: 500 }).catch(() => null);
  const openedAt = await page.evaluate(() => document.querySelector('dialog.film video')?.currentTime ?? null);

  let played = 0;
  let audioBytes = null;
  if (!shown && await page.locator('dialog.film video').count()) {
    const before = await page.evaluate(() => document.querySelector('dialog.film video').currentTime);
    await page.evaluate(() => document.querySelector('dialog.film video').play().catch(() => undefined));
    await wait(playMs);
    ({ played, audioBytes } = await page.evaluate((from) => {
      const video = document.querySelector('dialog.film video');
      video.pause();
      return { played: video.currentTime - from, audioBytes: typeof video.webkitAudioDecodedByteCount === 'number' ? video.webkitAudioDecodedByteCount : null };
    }, before));
  }

  // The captions and the transcript load on their own; give them a moment.
  await page.waitForFunction(() => {
    const track = document.querySelector('dialog.film track');
    return !track || track.readyState >= 2;
  }, null, { timeout: 15_000 }).catch(() => undefined);
  await page.locator('dialog.film .film__loading').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);

  const rest = await page.evaluate(() => {
    const video = document.querySelector('dialog.film video');
    const track = video?.textTracks[0];
    const cues = track?.cues ? [...track.cues] : [];
    const transcript = document.querySelector('dialog.film .film__transcript');
    const problem = transcript?.querySelector('.film__problem')?.textContent?.trim() ?? null;
    const words = [...(transcript?.querySelectorAll('p:not(.film__problem):not(.film__loading)') ?? [])].map((p) => p.textContent ?? '').join(' ');
    return {
      width: video?.videoWidth ?? 0,
      duration: video ? video.duration : null,
      captionsShowing: track?.mode === 'showing',
      cues: cues.length,
      lastCueEnd: cues.length ? Math.max(...cues.map((cue) => cue.endTime)) : null,
      transcriptChars: words.trim().length,
      transcriptProblem: problem,
    };
  });
  return { shown: shown?.trim() || null, openedAt, played, audioBytes, ...rest };
}

/** Closes whatever is open and goes back to the attract screen. */
async function backToStart() {
  for (let layer = 0; layer < 3 && await page.locator('dialog[open]').count(); layer += 1) {
    await page.keyboard.press('Escape');
    await wait(200);
  }
  const startOver = page.getByRole('button', { name: 'Start over' });
  if (await startOver.isVisible().catch(() => false)) await startOver.click().catch(() => undefined);
  if (!await page.locator('.attract').isVisible().catch(() => false)) {
    await page.reload();
  }
  await page.locator('.attract').waitFor({ state: 'visible', timeout: 20_000 });
}

async function finish(code) {
  await browser?.close().catch(() => undefined);
  if (pid) kill(pid);
  if (child.pid) kill(child.pid);
  await Promise.race([child.exited, wait(5_000)]);
  // The app may still be writing its last files as it goes.
  try { rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* a temporary folder */ }
  process.exit(code);
}
