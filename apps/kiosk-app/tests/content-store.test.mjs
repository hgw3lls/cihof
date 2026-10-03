import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { makeUpdate } from '../src/content-package.mjs';
import { createContentStore, keptVersions, listSource } from '../src/content-store.mjs';
import { extractEntry, listZip, writeZip } from '../src/zip.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); return path; };
const person = (biography) => ({ id: 'a-2010', name: 'A', portrait: { src: '/media/images/a.webp' }, biography });
const exhibit = (biography, extra = {}) => JSON.stringify({ schemaVersion: 3, target: 'kiosk', preview: false, people: [person(biography)], ...extra });

/** A delivered exhibit, as the app carries it: a release manifest naming each file's checksum, and source data beside it. */
async function delivered() {
  const root = mkdtempSync(join(tmpdir(), 'cihof-content-'));
  const site = join(root, 'site');
  const files = {
    'index.html': '<!doctype html><title>CIHOF</title>',
    'assets/app.js': 'console.log("exhibit")',
    'data/exhibit.json': exhibit('Delivered words.'),
    'media/images/a.webp': 'portrait-bytes',
  };
  for (const [path, text] of Object.entries(files)) put(join(site, path), text);
  const revision = 'aaaaaaaaaaaaaaaa';
  writeFileSync(join(site, 'release.json'), JSON.stringify({
    revision, base: '/', assets: Object.entries(files).map(([path, text]) => ({ path: `/${path}`, sha256: sha(text), bytes: Buffer.byteLength(text) })),
  }));
  writeFileSync(join(site, 'sw.js'), `const RELEASE = '${revision}';\nself.addEventListener('install', () => {});\n`);
  const source = join(root, 'source');
  put(join(source, 'data/cihof_curated_metadata.json'), '{"inductees":{"a-2010":{"bio":"Delivered words."}}}');
  writeFileSync(join(source, 'content.json'), JSON.stringify({ source: await listSource(source) }));
  const store = createContentStore({ dir: join(root, 'store'), deliveredSite: site, deliveredSource: source });
  return { root, site, source, store, revision };
}

/** The list inside a zip the display exported: the base the portal makes an update from. */
async function exported(zip) {
  const entries = await listZip(zip);
  const out = `${zip}.content.json`;
  await extractEntry(zip, entries.find((entry) => entry.name === 'content.json'), out);
  return { manifest: JSON.parse(readFileSync(out, 'utf8')), entries };
}

/** An update changing the biography, made from what the display exported. */
async function update(fixture, { base, biography = 'Corrected words.', films = {}, data, name = 'update' } = {}) {
  const work = join(fixture.root, name);
  return makeUpdate({
    out: join(fixture.root, `${name}.zip`),
    base,
    createdBy: 'Test curator',
    summary: [`A: biography ${biography}`],
    site: {
      'data/exhibit.json': put(join(work, 'exhibit.json'), data ?? exhibit(biography)),
      'media/images/a.webp': join(fixture.site, 'media/images/a.webp'),
    },
    source: { 'data/cihof_curated_metadata.json': put(join(work, 'curated.json'), `{"inductees":{"a-2010":{"bio":"${biography}"}}}`) },
    films,
  });
}

test('the display starts on its delivered content, and serves it as delivered', async () => {
  const { store } = await delivered();
  const state = store.state();
  assert.equal(state.onDelivered, true);
  assert.equal(state.active, state.delivered.contentVersion);
  assert.match(state.delivered.contentVersion, /^content-[0-9a-f]{16}$/);
  assert.equal(store.serving(), null);
});

test('an update made from an export carries only what changed, and is served once applied', async () => {
  const fixture = await delivered();
  const zip = join(fixture.root, 'export.zip');
  const exportedVersion = await fixture.store.exportCurrent(zip);
  const { manifest: base, entries } = await exported(zip);
  assert.equal(base.contentVersion, exportedVersion.contentVersion);
  // The export carries every content file, display and source, for the portal to edit.
  assert.equal(entries.filter((entry) => entry.name.startsWith('blobs/')).length, 3);

  const made = await update(fixture, { base });
  // The exhibit data and the source changed; the portrait did not, and stays behind.
  assert.equal(made.carried, 2);
  const state = await fixture.store.apply(join(fixture.root, 'update.zip'));
  assert.equal(state.onDelivered, false);
  assert.equal(state.active, made.manifest.contentVersion);
  assert.deepEqual(state.history.map((entry) => entry.contentVersion), [made.manifest.contentVersion]);

  const serving = fixture.store.serving();
  assert.match(readFileSync(serving.site('data/exhibit.json'), 'utf8'), /Corrected words/);
  assert.equal(serving.site('media/images/a.webp'), join(fixture.site, 'media/images/a.webp'));
  assert.equal(serving.site('media/images/gone.webp'), null);

  // A release of its own, so the exhibit takes it over at its next reset.
  const release = JSON.parse(readFileSync(serving.releaseJson, 'utf8'));
  assert.notEqual(release.revision, fixture.revision);
  assert.deepEqual(release.assets.map((asset) => asset.path), ['/assets/app.js', '/data/exhibit.json', '/index.html', '/media/images/a.webp']);
  assert.equal(release.assets.find((asset) => asset.path === '/data/exhibit.json').sha256, made.manifest.site['data/exhibit.json'].sha256);
  const worker = readFileSync(serving.workerJs, 'utf8');
  assert.match(worker, new RegExp(`const RELEASE = '${release.revision}'`));
  assert.doesNotMatch(worker, new RegExp(fixture.revision));
});

test('an update made from an older version is held back, unless staff apply it anyway', async () => {
  const fixture = await delivered();
  await fixture.store.exportCurrent(join(fixture.root, 'export.zip'));
  const { manifest: base } = await exported(join(fixture.root, 'export.zip'));
  await update(fixture, { base, biography: 'First.', name: 'first' });
  await update(fixture, { base, biography: 'Second.', name: 'second' });
  await fixture.store.apply(join(fixture.root, 'first.zip'));

  const report = await fixture.store.inspect(join(fixture.root, 'second.zip'));
  assert.deepEqual(report.problems, []);
  assert.match(report.stale, /would undo what changed since/);
  await assert.rejects(fixture.store.apply(join(fixture.root, 'second.zip')), /would undo what changed since/);
  const forced = await fixture.store.apply(join(fixture.root, 'second.zip'), { force: true });
  assert.match(readFileSync(fixture.store.serving().site('data/exhibit.json'), 'utf8'), /Second/);
  assert.equal(forced.history.length, 2);
});

test('any earlier version, or the delivered content, can be served again', async () => {
  const fixture = await delivered();
  await fixture.store.exportCurrent(join(fixture.root, 'export.zip'));
  const { manifest: base } = await exported(join(fixture.root, 'export.zip'));
  const first = await update(fixture, { base, biography: 'First.', name: 'first' });
  await fixture.store.apply(join(fixture.root, 'first.zip'));
  const second = await update(fixture, { base: first.manifest, biography: 'Second.', name: 'second' });
  await fixture.store.apply(join(fixture.root, 'second.zip'));

  await fixture.store.restore(first.manifest.contentVersion);
  assert.match(readFileSync(fixture.store.serving().site('data/exhibit.json'), 'utf8'), /First/);
  const back = await fixture.store.restore('delivered');
  assert.equal(back.onDelivered, true);
  assert.equal(fixture.store.serving(), null);
  // Going back keeps the history, so the newer version can be served again too.
  await fixture.store.restore(second.manifest.contentVersion);
  assert.match(readFileSync(fixture.store.serving().site('data/exhibit.json'), 'utf8'), /Second/);
  await assert.rejects(fixture.store.restore('content-0000000000000000'), /no version/);
  // A store opened afresh, as after a restart, serves what was chosen.
  const reopened = createContentStore({ dir: join(fixture.root, 'store'), deliveredSite: fixture.site, deliveredSource: fixture.source });
  assert.match(readFileSync(reopened.serving().site('data/exhibit.json'), 'utf8'), /Second/);
});

test('an update that is damaged, tampered with, or not for this display is refused, and nothing changes', async () => {
  const fixture = await delivered();
  await fixture.store.exportCurrent(join(fixture.root, 'export.zip'));
  const { manifest: base } = await exported(join(fixture.root, 'export.zip'));
  const refused = async (zip, pattern) => {
    const report = await fixture.store.inspect(zip);
    assert.match(report.problems.join(' '), pattern);
    await assert.rejects(fixture.store.apply(zip), pattern);
    assert.equal(fixture.store.state().onDelivered, true);
  };

  // Data for the website, an editor's preview, or a newer exhibit than this app shows.
  await update(fixture, { base, name: 'public', data: exhibit('x', { target: 'public' }) });
  await refused(join(fixture.root, 'public.zip'), /"public" target/);
  await update(fixture, { base, name: 'preview', data: exhibit('x', { preview: true }) });
  await refused(join(fixture.root, 'preview.zip'), /preview/);
  await update(fixture, { base, name: 'newer', data: exhibit('x', { schemaVersion: 4 }) });
  await refused(join(fixture.root, 'newer.zip'), /app needs updating/);
  // A portrait somebody shows that the update does not hold.
  await update(fixture, { base, name: 'portrait', data: JSON.stringify({ schemaVersion: 3, target: 'kiosk', people: [{ ...person('x'), portrait: { src: '/media/images/b.webp' } }] }) });
  await refused(join(fixture.root, 'portrait.zip'), /portrait\(s\) are not in the update/);

  // Its list changed after it was made.
  const made = await update(fixture, { base, name: 'tampered' });
  const tampered = { ...made.manifest, summary: ['Something else'], site: { ...made.manifest.site, 'data/extra.json': made.manifest.site['data/exhibit.json'] } };
  await writeZip(join(fixture.root, 'tampered2.zip'), [{ name: 'content.json', data: JSON.stringify(tampered) }]);
  await refused(join(fixture.root, 'tampered2.zip'), /does not match what it holds/);
  // Files neither in the update nor on the display: made from somewhere else.
  await writeZip(join(fixture.root, 'thin.zip'), [{ name: 'content.json', data: JSON.stringify(made.manifest) }]);
  await refused(join(fixture.root, 'thin.zip'), /neither in the update nor on this display/);
  // Not an update at all.
  writeFileSync(join(fixture.root, 'note.zip'), 'hello');
  await refused(join(fixture.root, 'note.zip'), /not a content update/);
  await writeZip(join(fixture.root, 'odd.zip'), [{ name: 'content.json', data: JSON.stringify(made.manifest) }, { name: 'readme.txt', data: 'hi' }]);
  await refused(join(fixture.root, 'odd.zip'), /files it should not/);
});

test('a film an update brings is served from the display', async () => {
  const fixture = await delivered();
  await fixture.store.exportCurrent(join(fixture.root, 'export.zip'));
  const { manifest: base } = await exported(join(fixture.root, 'export.zip'));
  const film = put(join(fixture.root, 'films', 'new.mp4'), 'film-bytes');
  await update(fixture, { base, films: { 'a-2010/new.mp4': film } });
  await fixture.store.apply(join(fixture.root, 'update.zip'));
  assert.equal(readFileSync(fixture.store.serving().film('a-2010/new.mp4'), 'utf8'), 'film-bytes');
  assert.equal(fixture.store.serving().film('a-2010/other.mp4'), null);
  assert.equal(fixture.store.state().history[0].films, 1);
  // A film an update brought exists only on the display, so the display's export carries it.
  await fixture.store.exportCurrent(join(fixture.root, 'with-film.zip'));
  const { entries } = await exported(join(fixture.root, 'with-film.zip'));
  assert.ok(entries.some((entry) => entry.name === `blobs/${sha('film-bytes')}`));
});

test('an export restores a display from nothing: a fresh install takes it in', async () => {
  const fixture = await delivered();
  await fixture.store.exportCurrent(join(fixture.root, 'export.zip'));
  const { manifest: base } = await exported(join(fixture.root, 'export.zip'));
  const film = put(join(fixture.root, 'films', 'new.mp4'), 'film-bytes');
  await update(fixture, { base, films: { 'a-2010/new.mp4': film } });
  await fixture.store.apply(join(fixture.root, 'update.zip'));
  await fixture.store.exportCurrent(join(fixture.root, 'backup.zip'));
  // A new display, as delivered, given the backup.
  const fresh = createContentStore({ dir: join(fixture.root, 'fresh-store'), deliveredSite: fixture.site, deliveredSource: fixture.source });
  const report = await fresh.inspect(join(fixture.root, 'backup.zip'));
  assert.deepEqual(report.problems, []);
  // Its version was made from the delivered content, which a fresh display shows, so nothing is overwritten.
  assert.equal(report.stale, null);
  await fresh.apply(join(fixture.root, 'backup.zip'));
  assert.match(readFileSync(fresh.serving().site('data/exhibit.json'), 'utf8'), /Corrected words/);
  assert.equal(readFileSync(fresh.serving().film('a-2010/new.mp4'), 'utf8'), 'film-bytes');
});

test(`only the newest ${keptVersions} versions are kept, with the files they use`, async () => {
  const fixture = await delivered();
  await fixture.store.exportCurrent(join(fixture.root, 'export.zip'));
  let { manifest: base } = await exported(join(fixture.root, 'export.zip'));
  for (let index = 0; index < keptVersions + 2; index += 1) {
    const made = await update(fixture, { base, biography: `Version ${index}.`, name: `v${index}` });
    await fixture.store.apply(join(fixture.root, `v${index}.zip`));
    base = made.manifest;
  }
  const state = fixture.store.state();
  assert.equal(state.history.length, keptVersions);
  assert.match(readFileSync(fixture.store.serving().site('data/exhibit.json'), 'utf8'), new RegExp(`Version ${keptVersions + 1}`));
  // Two files a version (exhibit data and source) for each kept version, and nothing for the ones let go.
  assert.equal(readdirSync(join(fixture.root, 'store', 'blobs')).length, keptVersions * 2);
  assert.equal(existsSync(join(fixture.root, 'store', 'versions')), true);
});
