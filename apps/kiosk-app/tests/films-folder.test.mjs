import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { filmsState } from '../src/films-folder.mjs';

test('the admin panel is told how many films can be played, and from where', () => {
  const site = mkdtempSync(join(tmpdir(), 'cihof-site-'));
  const folder = mkdtempSync(join(tmpdir(), 'cihof-films-'));
  const film = (person, id) => ({ id, source: { kind: 'local-file', src: `/media/videos/${person}/${person}_${id}.mp4` } });
  mkdirSync(join(site, 'data'), { recursive: true });
  writeFileSync(join(site, 'data', 'exhibit.json'), JSON.stringify({ people: [
    { films: [film('a', 'one'), film('a', 'two')] },
    // A ceremony film shared by two people counts once.
    { films: [film('b', 'three')] }, { films: [film('b', 'three')] },
  ] }));
  const put = (root, path) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), 'x'); };

  assert.deepEqual(filmsState(site, null), { folder: null, folderFound: false, total: 3, inFolder: 0, inApp: 0, missing: ['a_one.mp4', 'a_two.mp4', 'b_three.mp4'] });
  put(folder, 'a/a_one.mp4');
  put(folder, 'b/b_three.mp4');
  put(site, 'media/videos/a/a_two.mp4');
  const state = filmsState(site, folder);
  assert.equal(state.inFolder, 2);
  assert.equal(state.inApp, 1);
  assert.deepEqual(state.missing, []);
  assert.equal(filmsState(site, join(folder, 'gone')).folderFound, false);
});
