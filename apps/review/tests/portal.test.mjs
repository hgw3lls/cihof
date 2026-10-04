import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
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
    'apps/kiosk-app/src/content-package.mjs', 'apps/kiosk-app/src/connection-auth.mjs', 'packages/content', 'packages/pipeline', 'scripts', 'package.json')
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

test('over a staff connection, the portal starts from what the display shows and sends it an update', async () => {
  const { createStaffConnection } = await import('../../kiosk-app/src/connection.mjs');
  const { applyUpdate, connectToDisplay, sendUpdate } = await import('../server/display-connection.mjs');
  const display = createContentStore({ dir: join(scratch, 'display'), deliveredSite, deliveredSource });
  const connection = createStaffConnection({
    content: () => display,
    apply: (file, { force }) => display.apply(file, { force }),
    describe: () => ({ name: 'Test display' }),
    scratch: join(scratch, 'connection'),
  });
  try {
    const opened = await connection.open({ minutes: 15, port: 0, name: 'Test display' });
    const address = `127.0.0.1:${opened.port}`;

    // Start from what it shows, as the app's Connect to a display does.
    // Run alongside: this same process is the display answering it.
    const fetched = await new Promise((done) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', 'apps/review/server/portal.mjs', `--from-display=${address}`, '--replace'],
        { cwd: work, env: { ...process.env, CIHOF_PAIRING_CODE: opened.code } });
      let errors = '';
      child.stderr.on('data', (chunk) => { errors += chunk; });
      child.on('exit', (status) => done({ status, stderr: errors }));
    });
    assert.equal(fetched.status, 0, fetched.stderr);
    assert.equal(portalState(work).opened.contentVersion, display.state().active);

    const saved = saveHere({ root: work, draft: { reviewer: 'Sam Lee', bios: { [person]: { correctedText: 'Corrected over the staff connection.' } } } });
    assert.ok(saved.results.every((result) => result.ok));
    const update = await makeDisplayUpdate({ root: work, outDir: join(scratch, 'updates'), by: 'Sam Lee' });
    assert.equal(update.ok, true);

    const { display: link } = await connectToDisplay({ address, code: opened.code });
    const sent = await sendUpdate(link, update.file);
    assert.deepEqual(sent.problems, []);
    assert.equal(sent.stale, null, 'it follows what the display shows');
    await applyUpdate(link, sent.id, { now: false });
    assert.equal(display.state().active, update.contentVersion);
    assert.match(readFileSync(display.serving().site('data/exhibit.json'), 'utf8'), /Corrected over the staff connection/);
  } finally {
    await connection.close();
  }
});

test('the portal\'s server keeps making display updates and connecting to a display apart', async () => {
  const { createReviewServer } = await import('../server/server.mjs');
  // A free port first: the server answers only its own host, by the port it is told.
  const { createServer: createNetServer } = await import('node:net');
  const probe = createNetServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const { port } = probe.address();
  await new Promise((done) => probe.close(done));
  const real = createReviewServer({ root: work, dist: join(scratch, 'no-pages'), port, updatesDir: join(scratch, 'updates') });
  await new Promise((done) => real.listen(port, '127.0.0.1', done));
  try {
    const post = (path) => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const update = await (await post('/api/display-update')).json();
    assert.doesNotMatch(String(update.problem ?? update.error ?? ''), /Connect to the display/);
    assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/display`)).json()).connected, false);
    assert.equal((await post('/api/display/send')).status, 409, 'sending needs a connection');
  } finally {
    real.closeAllConnections();
    await new Promise((done) => real.close(done));
  }
});

test('in the studio, a change is saved and shown at once, waits for approval before it can be published, and can be undone', async () => {
  const { createServer: createNetServer } = await import('node:net');
  const probe = createNetServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const { port } = probe.address();
  await new Promise((done) => probe.close(done));
  mkdirSync(join(work, '.review'), { recursive: true });
  writeFileSync(join(work, '.review', 'draft.json'), JSON.stringify({ reviewer: 'Jane Smith' }));
  // As the app runs it: its own process, in the portal's copy, which it reads its records from.
  mkdirSync(join(work, 'apps', 'review', 'dist'), { recursive: true });
  writeFileSync(join(work, 'apps', 'review', 'dist', 'index.html'), '<!doctype html><title>Review</title>');
  const server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', 'apps/review/server/server.mjs', '--no-open', `--port=${port}`, `--updates-dir=${join(scratch, 'updates')}`], { cwd: work, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await fetch(`http://127.0.0.1:${port}/api/studio`).then((response) => response.ok, () => false)) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  const call = async (path, value) => (await fetch(`http://127.0.0.1:${port}${path}`, value === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) })).json();
  try {
    const review = await call('/api/review');
    const profile = review.profiles.find((each) => each.id === person);
    const saved = await call('/api/studio/save', { kind: 'profile', id: person, seenVersion: profile.contentVersion, name: profile.name, edit: { ...profile.edit, name: `${profile.edit.name} Junior` }, biography: null });
    assert.equal(saved.ok, true, JSON.stringify(saved.results));
    assert.equal(saved.preview.ok, true);
    const shown = JSON.parse(readFileSync(join(work, '.portal', 'preview', 'data', 'exhibit.json'), 'utf8')).people.find((each) => each.id === person);
    assert.equal(shown.name, `${profile.edit.name} Junior`, 'the preview shows it at once');

    const held = await call('/api/display-update', {});
    assert.equal(held.ok, false);
    assert.match(held.problem, /waiting for approval/);

    // Undone, and saved again, then approved: the profile is approved as it now reads, and can be published.
    const undone = await call('/api/studio/undo', {});
    assert.equal(undone.ok, true);
    assert.equal(JSON.parse(readFileSync(join(work, '.portal', 'preview', 'data', 'exhibit.json'), 'utf8')).people.find((each) => each.id === person).name, profile.name);

    // A change saving two kinds at once (the name and the biography), undone: both its records go.
    const recorded = JSON.parse(readFileSync(join(work, '.portal', 'state.json'), 'utf8')).changes.length;
    const both = await call('/api/studio/save', { kind: 'profile', id: person, seenVersion: profile.contentVersion, name: profile.name, edit: { ...profile.edit, name: `${profile.edit.name} II` }, biography: 'A biography written in the studio.' });
    assert.equal(both.ok, true, JSON.stringify(both.results));
    assert.equal(JSON.parse(readFileSync(join(work, '.portal', 'state.json'), 'utf8')).changes.length, recorded + 2);
    assert.equal((await call('/api/studio/undo', {})).ok, true);
    assert.equal(JSON.parse(readFileSync(join(work, '.portal', 'state.json'), 'utf8')).changes.length, recorded);
    const again = await call('/api/studio/save', { kind: 'profile', id: person, seenVersion: profile.contentVersion, name: profile.name, edit: { ...profile.edit, name: `${profile.edit.name} Junior` }, biography: null });
    const approved = await call('/api/studio/approve', { id: again.change.id });
    assert.equal(approved.ok, true, JSON.stringify(approved.results));
    assert.equal((await call('/api/review')).profiles.find((each) => each.id === person).state, 'approved');
    const published = await call('/api/display-update', {});
    assert.equal(published.ok, true, published.problem ?? published.output);
    assert.equal((await call('/api/studio')).changes.at(-1).status, 'published');
  } finally {
    server.kill();
  }
});

test('in the studio, a portrait, a film and a new inductee are each saved and shown at once, and undone cleanly', async () => {
  const { createServer: createNetServer } = await import('node:net');
  const probe = createNetServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const { port } = probe.address();
  await new Promise((done) => probe.close(done));
  const server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', 'apps/review/server/server.mjs', '--no-open', `--port=${port}`, `--updates-dir=${join(scratch, 'updates')}`], { cwd: work, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await fetch(`http://127.0.0.1:${port}/api/studio`).then((response) => response.ok, () => false)) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  const call = async (path, value) => (await fetch(`http://127.0.0.1:${port}${path}`, value === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) })).json();
  const upload = async (bytes, kind) => (await fetch(`http://127.0.0.1:${port}/api/uploads?kind=${kind}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from(bytes) })).json();
  const jpeg = (width, height, salt) => [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3, salt, 0, 0, 0, 0];
  const shown = () => JSON.parse(readFileSync(join(work, '.portal', 'preview', 'data', 'exhibit.json'), 'utf8')).people;
  try {
    const review = await call('/api/review');
    const someone = review.media.find((each) => each.id !== person && each.films.length === 0);

    // A portrait.
    const picture = await upload(jpeg(420, 520, 41), 'jpg');
    const portrait = await call('/api/studio/save', { kind: 'portrait', id: someone.id, name: someone.name, choice: { seenVersion: someone.contentVersion, upload: picture.name, portraitAlt: 'A new portrait.', focalPoint: 'center', rightsConfirmed: true } });
    assert.equal(portrait.ok, true, JSON.stringify(portrait.results));
    assert.equal(shown().find((each) => each.id === someone.id).portrait.src, `/media/images/${someone.id}/portrait-${picture.name.slice(0, 12)}.jpg`);

    // A film.
    const parts = {
      film: await upload([0, 0, 0, 0x18, ...Buffer.from('ftypisom'), ...Buffer.alloc(1024, 3)], 'mp4'),
      poster: await upload(jpeg(640, 360, 42), 'jpg'),
      captions: await upload(Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello.\n'), 'vtt'),
      transcript: await upload(Buffer.from('Hello.\n'), 'txt'),
    };
    const film = await call('/api/studio/save', { kind: 'film', key: `add:${someone.id}:x`, name: someone.name, film: {
      decision: 'add', personId: someone.id, film: parts.film.name, poster: parts.poster.name, captions: parts.captions.name, transcript: parts.transcript.name,
      durationSeconds: 2, title: 'A studio film', rightsConfirmed: true, captionsChecked: true, transcriptChecked: true,
    } });
    assert.equal(film.ok, true, JSON.stringify(film.results));
    assert.ok(shown().find((each) => each.id === someone.id).films.some((each) => each.title === 'A studio film'));

    // A new inductee, then undone: gone from the preview, and their portrait file with them.
    const face = await upload(jpeg(400, 500, 43), 'jpg');
    const added = await call('/api/studio/save', { kind: 'new-inductee', key: 'new-1', person: {
      name: 'Bea Example', classYear: 2027, displayName: '', sortName: 'Example, Bea', region: 'Europe', profileUrl: '', inductedBy: 'Cy Example',
      biography: 'Bea Example taught newcomers English.', themeTags: ['Education'], countryTags: [], communityTags: [], portrait: face.name, portraitAltText: 'Bea Example.', rightsConfirmed: true,
    } });
    assert.equal(added.ok, true, JSON.stringify(added.results));
    assert.equal(added.change.subject.id, 'bea-example-2027');
    assert.ok(shown().some((each) => each.id === 'bea-example-2027'));
    assert.equal((await call('/api/studio')).changes.filter((each) => each.status === 'waiting').length, 3);
    const portalChanges = () => JSON.parse(readFileSync(join(work, '.portal', 'state.json'), 'utf8')).changes.length;
    const listed = portalChanges();
    const undone = await call('/api/studio/undo', {});
    assert.equal(undone.ok, true);
    assert.equal(shown().some((each) => each.id === 'bea-example-2027'), false);
    assert.equal(existsSync(join(work, 'public', 'media', 'images', 'bea-example-2027', 'primary.jpg')), false);
    assert.equal(portalChanges(), listed - 1, 'its record for the next display update goes with it');

    // The film, undone too: its file goes, not only its record.
    const filmFile = join(work, 'public', 'media', 'videos', someone.id, `${someone.id}_${parts.film.name.slice(0, 12)}.mp4`);
    assert.equal(existsSync(filmFile), true);
    assert.equal((await call('/api/studio/undo', {})).ok, true);
    assert.equal(existsSync(filmFile), false, 'the film the undone change added is removed');
  } finally {
    server.kill();
  }
});

test('in the studio, the attract words, a tour and a place are each changed in place, and a profile approved', async () => {
  const { createServer: createNetServer } = await import('node:net');
  const probe = createNetServer();
  await new Promise((done) => probe.listen(0, '127.0.0.1', done));
  const { port } = probe.address();
  await new Promise((done) => probe.close(done));
  const server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', 'apps/review/server/server.mjs', '--no-open', `--port=${port}`, `--updates-dir=${join(scratch, 'updates')}`], { cwd: work, stdio: 'ignore' });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await fetch(`http://127.0.0.1:${port}/api/studio`).then((response) => response.ok, () => false)) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  const call = async (path, value) => (await fetch(`http://127.0.0.1:${port}${path}`, value === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) })).json();
  const bundle = () => JSON.parse(readFileSync(join(work, '.portal', 'preview', 'data', 'exhibit.json'), 'utf8'));
  try {
    const review = await call('/api/review');

    const attract = await call('/api/studio/save', { kind: 'attract', headline: 'Welcome to the Hall of Fame.', tagline: 'Meet the people who built Cleveland.' });
    assert.equal(attract.ok, true, JSON.stringify(attract.results));
    assert.equal(bundle().attract.headline, 'Welcome to the Hall of Fame.');

    const tour = review.tours.find((each) => each.state === 'approved');
    const edited = await call('/api/studio/save', { kind: 'tour', tourId: tour.tourId, decision: { decision: 'edit', seenVersion: tour.contentVersion, changes: { ...tour.changes, label: `${tour.changes.label} (edited)` }, audience: tour.shownOn.publicWeb ? 'kiosk-and-web' : 'kiosk' } });
    assert.equal(edited.ok, true, JSON.stringify(edited.results));
    assert.equal(bundle().tours.find((each) => each.id === tour.tourId)?.label, `${tour.changes.label} (edited)`, 'it stays on the exhibit, as edited');

    const place = review.places.find((each) => each.words === 'current');
    const renamed = await call('/api/studio/save', { kind: 'place', key: place.placeId, edit: {
      decision: 'edit', placeId: place.placeId, seenVersion: place.contentVersion, name: `${place.name} (renamed)`, neighborhood: place.neighborhood,
      type: place.type, shortHistory: place.shortHistory, people: [], audience: place.publication.publicWeb ? 'kiosk-and-web' : 'kiosk',
    } });
    assert.equal(renamed.ok, true, JSON.stringify(renamed.results));
    assert.equal(bundle().places.find((each) => each.id === place.placeId)?.name, `${place.name} (renamed)`);

    // One with no change of its own waiting: approving one that has is refused, since approving that change approves it.
    const busy = new Set((await call('/api/studio')).changes.filter((each) => each.status === 'waiting').map((each) => each.subject.id));
    const unapproved = (await call('/api/review')).profiles.find((each) => each.state !== 'approved' && each.id !== person && !busy.has(each.id));
    if (unapproved) {
      const approved = await call('/api/studio/approve-profile', { id: unapproved.id });
      assert.equal(approved.ok, true, JSON.stringify(approved.results));
      assert.equal((await call('/api/review')).profiles.find((each) => each.id === unapproved.id).state, 'approved');
    }
  } finally {
    server.kill();
  }
});
