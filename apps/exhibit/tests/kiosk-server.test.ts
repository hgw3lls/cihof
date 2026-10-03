import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createKioskServer } from '../kiosk/server.mjs';

/**
 * The display's own server.
 *
 * It must hand the exhibit the right types, answer the range requests a video
 * player seeks with, and never serve anything outside the site folder.
 */

const root = mkdtempSync(join(tmpdir(), 'cihof-kiosk-'));
const site = join(root, 'site');
mkdirSync(join(site, 'media'), { recursive: true });
writeFileSync(join(site, 'index.html'), '<!doctype html><title>exhibit</title>');
writeFileSync(join(site, 'media', 'clip.mp4'), Buffer.alloc(1000, 7));
writeFileSync(join(site, 'media', 'clip.en.vtt'), 'WEBVTT\n');
writeFileSync(join(root, 'secret.txt'), 'outside the site');

const server = createKioskServer({ root: site });
let base = '';
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('the exhibit is served at the root, with the right types', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /text\/html/);
  assert.match((await fetch(`${base}/media/clip.en.vtt`)).headers.get('content-type') ?? '', /text\/vtt/);
  assert.equal((await fetch(`${base}/media/clip.mp4`)).headers.get('content-type'), 'video/mp4');
});

test('a video player gets the byte range it asks for', async () => {
  const middle = await fetch(`${base}/media/clip.mp4`, { headers: { Range: 'bytes=100-199' } });
  assert.equal(middle.status, 206);
  assert.equal(middle.headers.get('content-range'), 'bytes 100-199/1000');
  assert.equal((await middle.arrayBuffer()).byteLength, 100);

  const tail = await fetch(`${base}/media/clip.mp4`, { headers: { Range: 'bytes=-10' } });
  assert.equal(tail.headers.get('content-range'), 'bytes 990-999/1000');
  await tail.arrayBuffer();

  const beyond = await fetch(`${base}/media/clip.mp4`, { headers: { Range: 'bytes=5000-' } });
  assert.equal(beyond.status, 416);
  await beyond.arrayBuffer();
});

test('nothing outside the site folder is reachable', async () => {
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/media/..%2f..%2fsecret.txt', '/%00']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    await response.arrayBuffer();
  }
});

test('only reading is allowed', async () => {
  const response = await fetch(`${base}/`, { method: 'POST' });
  assert.equal(response.status, 405);
  await response.arrayBuffer();
});

test('a cancelled video request closes its file', { skip: !existsSync('/proc/self/fd') && 'needs /proc to count open files' }, async () => {
  // Large enough that no response can finish before it is cancelled.
  writeFileSync(join(site, 'media', 'long.mp4'), Buffer.alloc(8 * 1024 * 1024, 1));
  const openFiles = () => readdirSync('/proc/self/fd').length;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

  await settle();
  const before = openFiles();
  // A visitor seeking back and forth: every request is abandoned mid-stream.
  for (let index = 0; index < 40; index += 1) {
    const controller = new AbortController();
    const response = await fetch(`${base}/media/long.mp4`, {
      headers: { Range: `bytes=${index * 1024}-` },
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    await reader.read().catch(() => {});
  }
  await settle();
  assert.ok(openFiles() - before < 10, `${openFiles() - before} files left open after 40 cancelled requests`);
});

test('films can be played from a folder of their own, first, and nothing else can be reached through it', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'cihof-films-'));
  mkdirSync(join(folder, 'someone-2020'), { recursive: true });
  writeFileSync(join(folder, 'someone-2020', 'someone-2020_abc.mp4'), Buffer.alloc(2000, 9));
  writeFileSync(join(folder, 'someone-2020', 'notes.txt'), 'not a film');
  mkdirSync(join(site, 'media', 'videos', 'other-2021'), { recursive: true });
  writeFileSync(join(site, 'media', 'videos', 'other-2021', 'other-2021_def.mp4'), Buffer.alloc(300, 1));

  let chosen: string | null = folder;
  const films = createKioskServer({ root: site, videos: () => chosen });
  await new Promise<void>((resolve) => films.listen(0, '127.0.0.1', resolve));
  const at = `http://127.0.0.1:${(films.address() as AddressInfo).port}`;
  try {
    const film = await fetch(`${at}/media/videos/someone-2020/someone-2020_abc.mp4`, { headers: { Range: 'bytes=0-99' } });
    assert.equal(film.status, 206);
    assert.equal(film.headers.get('content-range'), 'bytes 0-99/2000');
    // Not in the folder: from the site, as before.
    assert.equal((await fetch(`${at}/media/videos/other-2021/other-2021_def.mp4`)).headers.get('content-length'), '300');
    // Only films, and never outside the folder.
    assert.equal((await fetch(`${at}/media/videos/someone-2020/notes.txt`)).status, 404);
    assert.equal((await fetch(`${at}/media/videos/..%2F..%2Fsecret.mp4`)).status, 404);
    // Chosen while running: used at once; cleared: the site's own.
    chosen = null;
    assert.equal((await fetch(`${at}/media/videos/someone-2020/someone-2020_abc.mp4`)).status, 404);
  } finally {
    films.close();
  }
});

test('with a content version served, its content and release come from the version, and the app from the site', async () => {
  // A version's files, kept wherever the desktop app's content store keeps them.
  const store = join(root, 'store');
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, 'release.json'), '{"revision":"bbbbbbbbbbbbbbbb"}');
  writeFileSync(join(store, 'sw.js'), "const RELEASE = 'bbbbbbbbbbbbbbbb';");
  writeFileSync(join(store, 'exhibit.json'), '{"people":["updated"]}');
  writeFileSync(join(store, 'new.mp4'), Buffer.alloc(50, 9));
  writeFileSync(join(site, 'sw.js'), "const RELEASE = 'aaaaaaaaaaaaaaaa';");
  mkdirSync(join(site, 'data'), { recursive: true });
  writeFileSync(join(site, 'data', 'exhibit.json'), '{"people":["delivered"]}');
  writeFileSync(join(site, 'data', 'dropped.json'), '{}');
  let serving: object | null = {
    releaseJson: join(store, 'release.json'),
    workerJs: join(store, 'sw.js'),
    site: (path: string) => (path === 'data/exhibit.json' ? join(store, 'exhibit.json') : null),
    film: (path: string) => (path === 'someone/new.mp4' ? join(store, 'new.mp4') : null),
  };
  const versioned = createKioskServer({ root: site, content: () => serving as never });
  await new Promise<void>((resolve) => versioned.listen(0, '127.0.0.1', resolve));
  const at = `http://127.0.0.1:${(versioned.address() as AddressInfo).port}`;
  try {
    assert.equal(await (await fetch(`${at}/data/exhibit.json`)).text(), '{"people":["updated"]}');
    assert.match(await (await fetch(`${at}/sw.js`)).text(), /bbbbbbbbbbbbbbbb/);
    assert.match(await (await fetch(`${at}/release.json`)).text(), /bbbbbbbbbbbbbbbb/);
    // Content the version does not hold is gone, not the delivered copy.
    const dropped = await fetch(`${at}/data/dropped.json`);
    assert.equal(dropped.status, 404);
    await dropped.arrayBuffer();
    // A film it brought plays, with ranges; one it did not falls back to the site.
    const film = await fetch(`${at}/media/videos/someone/new.mp4`, { headers: { Range: 'bytes=0-9' } });
    assert.equal(film.status, 206);
    assert.equal((await film.arrayBuffer()).byteLength, 10);
    // The app itself is the delivered site.
    assert.match(await (await fetch(`${at}/`)).text(), /exhibit/);
    for (const path of ['/data/..%2f..%2fsecret.txt', '/media/videos/..%2f..%2fsecret.mp4']) {
      const response = await fetch(`${at}${path}`);
      assert.equal(response.status, 404, path);
      await response.arrayBuffer();
    }
    // Back on the delivered content, everything is as delivered.
    serving = null;
    assert.equal(await (await fetch(`${at}/data/exhibit.json`)).text(), '{"people":["delivered"]}');
    assert.match(await (await fetch(`${at}/sw.js`)).text(), /aaaaaaaaaaaaaaaa/);
  } finally {
    versioned.close();
  }
});
