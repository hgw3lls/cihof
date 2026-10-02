import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { previewHash, targetsLabel } from '../../../scripts/preview-hash.js';

const root = resolve(import.meta.dirname, '../../..');

test('the preview token covers the audience as well as the sheet', () => {
  const sheet = 'placeId,approve\nplace:x,yes\n';
  assert.notEqual(previewHash(sheet, 'kiosk'), previewHash(sheet, 'kiosk,public-web'));
  // A tool with no audience keeps the sheet's own fingerprint.
  assert.equal(previewHash(sheet), previewHash(sheet, undefined));
  assert.equal(targetsLabel({ kiosk: true, publicWeb: true }), 'kiosk,public-web');
  assert.equal(targetsLabel(null), '');
});

test('places:apply will not publish to an audience nobody previewed', () => {
  // A real place, approved, as a sheet would approve it again. The refusal
  // comes before anything is read for writing, so nothing here can change the data.
  const place = JSON.parse(readFileSync(join(root, 'data/cihof_places.json'), 'utf8')).places.find((each) => each.review?.status === 'approved');
  const sheet = join(mkdtempSync(join(tmpdir(), 'cihof-places-')), 'places.csv');
  writeFileSync(sheet, `placeId,approve,contentVersion,newHistory,decisionReference,note\n${place.id},yes,${place.review.contentVersion},,test-reference,\n`);
  const run = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', join(root, 'scripts/apply-place-decisions.js'), `--input=${sheet}`, ...args], { cwd: root, encoding: 'utf8' });

  const preview = run();
  const token = /--expect-hash=([0-9a-f]{64})/.exec(preview.stdout)?.[1];
  assert.ok(token, preview.stdout + preview.stderr);
  const widened = run('--targets=kiosk,public-web', '--apply', `--expect-hash=${token}`);
  assert.equal(widened.status, 1);
  assert.match(widened.stderr, /has not been previewed, or it changed since it was/);
});
