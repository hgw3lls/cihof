import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { makeUpdate } from '../../kiosk-app/src/content-package.mjs';
import { createContentStore, listSource } from '../../kiosk-app/src/content-store.mjs';
import { makeDisplayUpdate, openExport, portalState } from '../server/portal.mjs';
import { saveHere } from '../server/save.mjs';

/**
 * The staff portal from end to end, with no git: a display's export opened,
 * a correction saved into the copy, an update made, and a display's own
 * content store taking it in and serving the corrected words.
 */

const repo = resolve(import.meta.dirname, '../../..');
const films = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
let scratch;
let work;
let exportZip;
let deliveredSite;
let deliveredSource;
let person;

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const tracked = (...paths) => execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
const walk = (directory) => readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath ?? entry.path, entry.name));

before(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'cihof-portal-'));

  // The portal's working folder, as the app installs it: the review's code, and no git.
  work = join(scratch, 'work');
  const code = tracked('apps/review/server', 'apps/review/package.json', 'apps/kiosk-app/src/zip.mjs', 'apps/kiosk-app/src/content-store.mjs',
    'apps/kiosk-app/src/content-package.mjs', 'packages/content', 'packages/pipeline', 'scripts', 'package.json')
    .filter((path) => !/^packages\/[^/]+\/tests\//.test(path) && existsSync(join(repo, path)));
  for (const path of code) { mkdirSync(dirname(join(work, path)), { recursive: true }); cpSync(join(repo, path), join(work, path)); }
  for (const name of ['content', 'pipeline']) {
    mkdirSync(join(work, 'node_modules', '@cihof'), { recursive: true });
    symlinkSync(join('..', '..', 'packages', name), join(work, 'node_modules', '@cihof', name), 'dir');
  }

  // A display as delivered: its content, and the source it keeps for the portal.
  deliveredSite = join(scratch, 'site');
  const made = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', 'scripts/publish-display-content.mjs', `--out=${deliveredSite}`], { cwd: repo, encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const assets = walk(deliveredSite).map((file) => ({ path: `/${relative(deliveredSite, file).split('\\').join('/')}`, sha256: sha256(file), bytes: readFileSync(file).length }));
  writeFileSync(join(deliveredSite, 'index.html'), '<!doctype html><title>Exhibit</title>\n');
  assets.push({ path: '/index.html', sha256: sha256(join(deliveredSite, 'index.html')), bytes: 40 });
  writeFileSync(join(deliveredSite, 'release.json'), JSON.stringify({ revision: 'delivered00000000', base: '/', assets }));
  writeFileSync(join(deliveredSite, 'sw.js'), "const RELEASE = 'delivered00000000';\n");
  deliveredSource = join(scratch, 'content-source');
  for (const path of tracked('data', 'public/media').filter((each) => !films.test(each) && existsSync(join(repo, each)))) {
    mkdirSync(dirname(join(deliveredSource, path)), { recursive: true });
    linkSync(join(repo, path), join(deliveredSource, path));
  }
  writeFileSync(join(deliveredSource, 'content.json'), JSON.stringify({ source: await listSource(deliveredSource) }));

  // The display's export, as its admin panel writes it: its full list and every file.
  const store = createContentStore({ dir: join(scratch, 'display'), deliveredSite, deliveredSource });
  exportZip = join(scratch, 'export.cihof');
  await store.exportCurrent(exportZip);

  person = Object.keys(JSON.parse(readFileSync(join(repo, 'data', 'cihof_curated_metadata.json'), 'utf8')).inductees)[0];
  assert.ok(person, 'somebody to correct');
});

after(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });

test('a display\'s export opens as the working copy, and an update is refused until something changes', async () => {
  const state = await openExport({ root: work, file: exportZip });
  assert.match(state.opened.contentVersion, /^content-[0-9a-f]{16}$/);
  assert.equal(sha256(join(work, 'data', 'cihof_curated_metadata.json')), sha256(join(repo, 'data', 'cihof_curated_metadata.json')));
  assert.ok(existsSync(join(work, 'public', 'media', 'images')), 'the portraits came with it');

  const outcome = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Jane Smith' });
  assert.equal(outcome.ok, false);
  assert.match(outcome.problem, /Nothing has changed/);
});

test('an export from a display delivered before the portal is refused, with the reason', async () => {
  const site = join(scratch, 'older');
  const source = join(scratch, 'older-source');
  mkdirSync(join(source, 'data'), { recursive: true });
  cpSync(join(repo, 'data', 'cihof_curated_metadata.json'), join(source, 'data', 'cihof_curated_metadata.json'));
  writeFileSync(join(source, 'content.json'), JSON.stringify({ source: await listSource(source) }));
  cpSync(deliveredSite, site, { recursive: true });
  const older = join(scratch, 'older.cihof');
  await createContentStore({ dir: join(scratch, 'older-display'), deliveredSite: site, deliveredSource: source }).exportCurrent(older);
  await assert.rejects(openExport({ root: join(scratch, 'elsewhere'), file: older }), /delivered before the staff portal/);
});

test('a failed save keeps nothing of itself', () => {
  const before = sha256(join(work, 'data', 'cihof_curated_metadata.json'));
  const { results, draft } = saveHere({ root: work, draft: { reviewer: 'Jane Smith', bios: { 'nobody-by-this-name': { correctedText: 'Words.' } } } });
  assert.equal(results[0].ok, false);
  assert.ok(draft.bios['nobody-by-this-name'], 'the decision is still there to look at again');
  assert.equal(sha256(join(work, 'data', 'cihof_curated_metadata.json')), before);
  assert.equal(portalState(work).pending.length, 0);
});

test('a correction saved in the portal reaches the display through an update, and the next update follows it', async () => {
  const words = 'A correction made in the staff portal, to be shown on the display.';
  const saved = saveHere({ root: work, draft: { reviewer: 'Jane Smith', bios: { [person]: { correctedText: words, note: 'Checked against the Hall of Fame' } } } });
  assert.ok(saved.results.every((result) => result.ok), saved.results.map((result) => result.output).join('\n'));
  assert.equal(portalState(work).pending.length, 1);

  const update = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Jane Smith', note: 'One biography corrected.' });
  assert.equal(update.ok, true, update.output ?? update.problem);
  assert.ok(update.summary.includes('One biography corrected.'));
  assert.ok(update.summary.some((line) => line.startsWith('Biographies: 1 decision by Jane Smith')));
  assert.equal(portalState(work).pending.length, 0);

  // The display takes it in and serves the corrected words.
  const display = createContentStore({ dir: join(scratch, 'display'), deliveredSite, deliveredSource });
  const report = await display.inspect(update.file);
  assert.deepEqual(report.problems, []);
  assert.equal(report.stale, null);
  await display.apply(update.file);
  assert.match(readFileSync(display.serving().site('data/exhibit.json'), 'utf8'), new RegExp(words));

  // The next one follows it, and carries what the export lacks.
  const again = saveHere({ root: work, draft: { reviewer: 'Sam Lee', bios: { [person]: { correctedText: `${words} Twice.` } } } });
  assert.ok(again.results.every((result) => result.ok));
  const second = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Sam Lee' });
  assert.equal(second.ok, true);
  assert.equal(second.basedOn, update.contentVersion);
  const followed = await display.inspect(second.file);
  assert.deepEqual(followed.problems, []);
  assert.equal(followed.stale, null);

  // Refused while saved changes wait for an update, since opening would lose them.
  saveHere({ root: work, draft: { reviewer: 'Sam Lee', bios: { [person]: { correctedText: `${words} Three times.` } } } });
  await assert.rejects(openExport({ root: work, file: exportZip }), /not yet in a display update/);
});

test('a new portrait and a new film chosen in the portal reach the display, the film carried in the update', async () => {
  // Uploads as the portal's page sends them: kept by checksum.
  const uploads = join(work, '.review', 'uploads');
  mkdirSync(uploads, { recursive: true });
  const keep = (bytes, kind) => {
    const data = Buffer.from(bytes);
    const name = `${createHash('sha256').update(data).digest('hex')}.${kind}`;
    writeFileSync(join(uploads, name), data);
    return name;
  };
  const jpeg = (width, height, salt) => [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3, salt, 0, 0, 0, 0];
  const picture = keep(jpeg(400, 500, 1), 'jpg');
  const film = keep([0, 0, 0, 0x18, ...Buffer.from('ftypisom'), ...Buffer.alloc(4096, 7)], 'mp4');
  const poster = keep(jpeg(640, 360, 2), 'jpg');
  const captions = keep(Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nWelcome.\n'), 'vtt');
  const transcript = keep(Buffer.from('Welcome.\n'), 'txt');

  const versionNow = () => {
    // The pipeline reads the folder it is run from: the review's working copy.
    const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', '--input-type=module', '-e',
      `const { loadReview } = await import('./apps/review/server/data.mjs'); console.log(loadReview().media.find((p) => p.id === '${person}').contentVersion);`], { cwd: work, encoding: 'utf8' });
    return run.stdout.trim();
  };
  const saved = saveHere({
    root: work,
    draft: {
      reviewer: 'Jane Smith',
      portraits: { [person]: { seenVersion: versionNow(), upload: picture, portraitAlt: 'A new portrait.', focalPoint: 'center', rightsConfirmed: true, note: '' } },
      films: { [`add:${person}:${film.slice(0, 12)}`]: {
        decision: 'add', personId: person, film, poster, captions, transcript, durationSeconds: 2, title: 'A new film',
        rightsConfirmed: true, captionsChecked: true, transcriptChecked: true, note: '',
      } },
    },
  });
  assert.ok(saved.results.every((result) => result.ok), saved.results.map((result) => result.output).join('\n'));
  assert.equal(existsSync(join(uploads, film)), false, 'the film\'s upload is let go once it is saved');

  const update = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Jane Smith' });
  assert.equal(update.ok, true, update.output ?? update.problem);
  const display = createContentStore({ dir: join(scratch, 'display'), deliveredSite, deliveredSource });
  const report = await display.inspect(update.file);
  assert.deepEqual(report.problems, []);
  assert.equal(report.changes.newFilms, 1);
  await display.apply(update.file, { force: true });
  const shown = JSON.parse(readFileSync(display.serving().site('data/exhibit.json'), 'utf8')).people.find((each) => each.id === person);
  assert.equal(shown.portrait.src, `/media/images/${person}/portrait-${picture.slice(0, 12)}.jpg`);
  const added = shown.films.find((each) => each.title === 'A new film');
  assert.ok(added, 'the film is on the display, with its title');
  const path = added.source.src.slice('/media/videos/'.length);
  assert.equal(sha256(display.serving().film(path)), film.slice(0, 64), 'and the display plays the very file chosen');
});

test('a new inductee added in the portal is on the display after the update', async () => {
  const uploads = join(work, '.review', 'uploads');
  mkdirSync(uploads, { recursive: true });
  const data = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xf4, 0x01, 0x90, 3, 9, 0, 0, 0, 0]);
  const portrait = `${createHash('sha256').update(data).digest('hex')}.jpg`;
  writeFileSync(join(uploads, portrait), data);
  const saved = saveHere({
    root: work,
    draft: {
      reviewer: 'Jane Smith',
      newClass: { first: {
        name: 'Ada Example', classYear: 2027, displayName: '', sortName: 'Example, Ada', region: 'Europe', profileUrl: '', inductedBy: 'Bo Example',
        biography: 'Ada Example founded a school for newcomers to Cleveland.', themeTags: ['Education'], countryTags: [], communityTags: [],
        portrait, portraitAltText: 'Ada Example, smiling.', rightsConfirmed: true, note: '',
      } },
    },
  });
  assert.ok(saved.results.every((result) => result.ok), saved.results.map((result) => result.output).join('\n'));
  const update = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Jane Smith' });
  assert.equal(update.ok, true, update.output ?? update.problem);
  const display = createContentStore({ dir: join(scratch, 'display'), deliveredSite, deliveredSource });
  assert.deepEqual((await display.inspect(update.file)).problems, []);
  await display.apply(update.file, { force: true });
  const added = JSON.parse(readFileSync(display.serving().site('data/exhibit.json'), 'utf8')).people.find((each) => each.id === 'ada-example-2027');
  assert.ok(added, 'the new inductee is on the display');
  assert.equal(added.classYear, 2027);
  assert.match(added.biography?.text ?? JSON.stringify(added), /founded a school/);
  assert.equal(added.portrait?.src, '/media/images/ada-example-2027/primary.jpg');
});

test('a place renamed and a new place added in the portal are on the display after the update', async () => {
  // The places as the working copy has them now.
  const places = JSON.parse(readFileSync(join(work, 'data', 'cihof_places.json'), 'utf8'));
  const ties = JSON.parse(readFileSync(join(work, 'data', 'cihof_place_associations.json'), 'utf8')).associations;
  const gardens = places.places.find((place) => place.id === 'place:cleveland-cultural-gardens');
  const { placeTextVersion } = await import('../../../packages/pipeline/src/build/place-text.ts');
  const someone = Object.keys(JSON.parse(readFileSync(join(work, 'data', 'cihof_curated_metadata.json'), 'utf8')).inductees)
    .find((id) => !ties.some((tie) => tie.person === id && tie.place === gardens.id));
  const saved = saveHere({
    root: work,
    draft: {
      reviewer: 'Jane Smith',
      placeEdits: {
        [gardens.id]: { decision: 'edit', placeId: gardens.id, seenVersion: placeTextVersion(gardens), name: 'The Cleveland Cultural Gardens', neighborhood: gardens.neighborhood, type: gardens.type, shortHistory: gardens.shortHistory, people: [], audience: 'kiosk' },
        'new-1': { decision: 'create', placeId: '', seenVersion: '', name: 'West Side Market', neighborhood: 'Ohio City', type: 'business', shortHistory: 'A public market since 1912.', people: [{ personId: someone, role: 'worked' }], audience: 'kiosk' },
      },
    },
  });
  assert.ok(saved.results.every((result) => result.ok), saved.results.map((result) => result.output).join('\n'));
  const update = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Jane Smith' });
  assert.equal(update.ok, true, update.output ?? update.problem);
  const display = createContentStore({ dir: join(scratch, 'display'), deliveredSite, deliveredSource });
  await display.apply(update.file, { force: true });
  const shown = JSON.parse(readFileSync(display.serving().site('data/exhibit.json'), 'utf8')).places;
  assert.equal(shown.find((place) => place.id === gardens.id)?.name, 'The Cleveland Cultural Gardens');
  const market = shown.find((place) => place.id === 'place:west-side-market');
  assert.ok(market, 'the new place is on the display');
  assert.deepEqual(market.personIds, [someone]);
});
