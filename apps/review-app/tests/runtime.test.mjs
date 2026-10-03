import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { dataFolderProblem, installRuntime, isExportedFile, isUpdateFile, isOwnPage, isWebAddress, syncDataFolder } from '../src/runtime.mjs';

const place = (root, files) => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
};
const temp = () => mkdtempSync(join(tmpdir(), 'cihof-review-app-'));

test('a data folder has the records in it, or the app says what is wrong', () => {
  const folder = temp();
  assert.match(dataFolderProblem(null), /No data folder/);
  assert.match(dataFolderProblem(join(folder, 'gone')), /cannot be reached/);
  assert.match(dataFolderProblem(folder), /not a review data folder/);
  place(folder, { 'data/cihof_curated_metadata.json': '{}' });
  assert.equal(dataFolderProblem(folder), null);
});

test('the records, portraits and captions are copied in; films and stray files never are; what went is removed', () => {
  const from = temp();
  const to = temp();
  place(from, {
    'data/cihof_curated_metadata.json': '{}',
    'public/media/images/a/primary.jpg': 'jpg',
    'public/media/videos/a/a_x.en.vtt': 'WEBVTT',
    'public/media/videos/a/a_x.mp4': 'a film',
    'public/media/videos/a/.DS_Store': 'x',
    'data/cihof_film_titles.json.backup-2026': 'old',
    'apps/exhibit/src/secret.ts': 'not data',
  });
  place(to, { 'data/removed.json': 'gone from the folder', '.review/draft.json': 'the reviewer\'s own' });
  const first = syncDataFolder(from, to);
  assert.equal(first.copied, 3);
  assert.ok(existsSync(join(to, 'public/media/videos/a/a_x.en.vtt')));
  assert.ok(!existsSync(join(to, 'public/media/videos/a/a_x.mp4')), 'never a film');
  assert.ok(!existsSync(join(to, 'public/media/videos/a/.DS_Store')));
  assert.ok(!existsSync(join(to, 'data/cihof_film_titles.json.backup-2026')));
  assert.ok(!existsSync(join(to, 'apps/exhibit/src/secret.ts')), 'only the data parts');
  assert.ok(!existsSync(join(to, 'data/removed.json')), 'what the folder no longer has');
  assert.equal(readFileSync(join(to, '.review/draft.json'), 'utf8'), 'the reviewer\'s own', 'the draft is never touched');

  // Only what changed is copied the next time.
  assert.equal(syncDataFolder(from, to).copied, 0);
  writeFileSync(join(from, 'data/cihof_curated_metadata.json'), '{"changed":true}');
  utimesSync(join(from, 'data/cihof_curated_metadata.json'), new Date(), new Date(Date.now() + 10_000));
  assert.equal(syncDataFolder(from, to).copied, 1);
});

test('the review\'s code is installed once per build, with the project\'s packages found by name', () => {
  const runtime = temp();
  const work = temp();
  place(runtime, {
    'apps/review/server/server.mjs': '// v1',
    'apps/kiosk-app/src/content-package.mjs': '',
    'packages/content/package.json': '{"name":"@cihof/content"}',
    'packages/pipeline/package.json': '{"name":"@cihof/pipeline"}',
    'scripts/a.js': '',
    'docs/sign-off.md': '',
    'package.json': '{"workspaces":[]}',
  });
  place(work, { '.review/draft.json': 'kept', '.portal/state.json': 'kept', 'data/x.json': 'kept' });
  assert.equal(installRuntime(runtime, work, 'build-1'), true);
  assert.ok(existsSync(join(work, 'node_modules/@cihof/content/package.json')));
  assert.equal(installRuntime(runtime, work, 'build-1'), false, 'the same build is not installed again');
  place(runtime, { 'apps/review/server/server.mjs': '// v2' });
  assert.equal(installRuntime(runtime, work, 'build-2'), true);
  assert.equal(readFileSync(join(work, 'apps/review/server/server.mjs'), 'utf8'), '// v2');
  assert.equal(readFileSync(join(work, '.review/draft.json'), 'utf8'), 'kept');
  assert.equal(readFileSync(join(work, '.portal/state.json'), 'utf8'), 'kept');
  assert.equal(readFileSync(join(work, 'data/x.json'), 'utf8'), 'kept');
  assert.ok(existsSync(join(work, 'apps/kiosk-app/src/content-package.mjs')), 'with how display updates are made');
});

test('only the review\'s own pages stay in the window, and only an exported file or a display update can be shown', () => {
  assert.equal(isOwnPage('http://localhost:5180/', 5180), true);
  assert.equal(isOwnPage('http://localhost:5181/', 5180), false);
  assert.equal(isOwnPage('https://www.youtube.com/watch?v=x', 5180), false);
  assert.equal(isWebAddress('https://www.youtube.com/watch?v=x'), true);
  assert.equal(isWebAddress('file:///etc/passwd'), false);
  const exports = temp();
  place(exports, { 'cihof-decisions-jane-2026-10-01-090000.json': '{}', 'other.json': '{}' });
  assert.equal(isExportedFile(join(exports, 'cihof-decisions-jane-2026-10-01-090000.json'), exports), true);
  assert.equal(isExportedFile(join(exports, 'other.json'), exports), false);
  assert.equal(isExportedFile('/etc/passwd', exports), false);
  const updates = temp();
  place(updates, { 'cihof-update-2026-10-03-1015.cihof': 'zip', 'cihof-update-notes.txt': '' });
  assert.equal(isUpdateFile(join(updates, 'cihof-update-2026-10-03-1015.cihof'), updates), true);
  assert.equal(isUpdateFile(join(updates, 'cihof-update-notes.txt'), updates), false);
  assert.equal(isUpdateFile(join(exports, 'cihof-decisions-jane-2026-10-01-090000.json'), updates), false);
});
