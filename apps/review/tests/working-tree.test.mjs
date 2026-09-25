import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { workingTreeChanges } from '../server/save.mjs';

test('old folders git never tracked do not block saving; changes to the project still do', () => {
  const root = mkdtempSync(join(tmpdir(), 'cihof-tree-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '-q');
    mkdirSync(join(root, 'data'));
    writeFileSync(join(root, 'data', 'roster.json'), '{}\n');
    writeFileSync(join(root, 'README.md'), 'x\n');
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.org', 'commit', '-qm', 'start');

    // Leftovers of an earlier layout, as found on the staff computer.
    mkdirSync(join(root, 'dist-portal'));
    writeFileSync(join(root, 'dist-portal', 'index.html'), 'old\n');
    writeFileSync(join(root, 'notes.txt'), 'old\n');
    assert.deepEqual(workingTreeChanges(root), []);

    // A new file inside a folder the project keeps may be read, so it counts.
    writeFileSync(join(root, 'data', 'stray.csv'), 'a\n');
    assert.deepEqual(workingTreeChanges(root), ['?? data/stray.csv']);
    rmSync(join(root, 'data', 'stray.csv'));

    // So does any change to a tracked file.
    writeFileSync(join(root, 'README.md'), 'changed\n');
    assert.deepEqual(workingTreeChanges(root), [' M README.md']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
