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
