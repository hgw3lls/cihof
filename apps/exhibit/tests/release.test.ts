import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, openSync, ftruncateSync, closeSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

test('release excludes films larger than the whole-file buffer limit before hashing', () => {
  const root = mkdtempSync(join(tmpdir(), 'cihof-release-'));
  try {
    mkdirSync(join(root, 'dist'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'dist', 'index.html'), '<main>Exhibit</main>');
    writeFileSync(join(root, 'src', 'sw.js'), 'const release = "__CIHOF_RELEASE__";');
    const film = openSync(join(root, 'dist', 'film.mp4'), 'w');
    try { ftruncateSync(film, 2 ** 31 + 1); } finally { closeSync(film); }
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/release.mjs', import.meta.url))], { cwd: root });
    const release = JSON.parse(readFileSync(join(root, 'dist', 'release.json'), 'utf8'));
    assert.deepEqual(release.assets.map((asset: { path: string }) => asset.path), ['/cihof/index.html']);
    assert.match(release.assets[0].sha256, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
