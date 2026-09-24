import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { repoFile } from '../src/paths.ts';
import { imageFacts, imageSize } from '../src/build/images.ts';

test('a PNG header gives its size', () => {
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(png.buffer).setUint32(16, 640);
  new DataView(png.buffer).setUint32(20, 480);
  assert.deepEqual(imageSize(png), { width: 640, height: 480 });
});

test('a portrait in the collection reads as the manifest records it', () => {
  const manifest = JSON.parse(readFileSync(repoFile('data/media_manifest.json'), 'utf8'));
  const primary = manifest.assets['jeanette-grasselli-brown-2010'].images.primary;
  const facts = imageFacts(readFileSync(repoFile(primary.filePath)));
  assert.deepEqual(facts, { checksumSha256: primary.checksumSha256, width: primary.width, height: primary.height });
});

test('something that is not an image has no size', () => {
  assert.equal(imageSize(new TextEncoder().encode('not an image at all')), null);
});
