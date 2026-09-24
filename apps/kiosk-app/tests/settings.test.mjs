import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { attemptPasscode, defaults, hashPasscode, loadSettings, passcodeMatches, passcodeProblem, saveSettings } from '../src/settings.mjs';

/**
 * The display's settings and the admin passcode. The passcode is the only
 * thing between a visitor and the desktop, so it is stored hashed, checked in
 * constant time, and guessing is slowed down.
 */

test('a missing or damaged settings file gives the defaults', () => {
  const folder = mkdtempSync(join(tmpdir(), 'cihof-settings-'));
  assert.deepEqual(loadSettings(join(folder, 'none.json')), { ...defaults, lockout: { ...defaults.lockout } });
  writeFileSync(join(folder, 'bad.json'), '{ half a fi');
  assert.equal(loadSettings(join(folder, 'bad.json')).port, 8080);
});

test('settings survive a save and load, and never hold the passcode in the clear', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'cihof-settings-')), 'settings.json');
  saveSettings(path, { ...defaults, restartAt: '03:30', passcode: hashPasscode('482910') });
  const loaded = loadSettings(path);
  assert.equal(loaded.restartAt, '03:30');
  assert.equal(passcodeMatches('482910', loaded.passcode), true);
  assert.equal(readFileSync(path, 'utf8').includes('482910'), false);
});

test('a passcode is 4 to 12 digits', () => {
  assert.equal(passcodeProblem('1234'), null);
  assert.ok(passcodeProblem('123'));
  assert.ok(passcodeProblem('12ab'));
  assert.ok(passcodeProblem('1234567890123'));
});

test('two hashes of the same passcode differ, and both verify', () => {
  const a = hashPasscode('2468');
  const b = hashPasscode('2468');
  assert.notEqual(a, b);
  assert.equal(passcodeMatches('2468', a), true);
  assert.equal(passcodeMatches('2469', a), false);
  assert.equal(passcodeMatches('2468', null), false);
});

test('five wrong tries lock the keypad, and the right code after the lock clears it', () => {
  let settings = { ...defaults, passcode: hashPasscode('1357'), lockout: { failures: 0, until: 0 } };
  const now = 1_000_000;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = attemptPasscode(settings, '0000', now);
    assert.equal(result.ok, false);
    assert.equal(result.lockedForMs, undefined, `not locked after ${attempt}`);
    settings = result.settings;
  }
  const fifth = attemptPasscode(settings, '0000', now);
  assert.equal(fifth.lockedForMs, 60_000);
  settings = fifth.settings;

  assert.equal(attemptPasscode(settings, '1357', now + 1000).ok, false, 'even the right code waits out the lock');
  const later = attemptPasscode(settings, '1357', now + 61_000);
  assert.equal(later.ok, true);
  assert.deepEqual(later.settings.lockout, { failures: 0, until: 0 });
});

test('the lock grows with repeated guessing', () => {
  let settings = { ...defaults, passcode: hashPasscode('1357'), lockout: { failures: 5, until: 0 } };
  const result = attemptPasscode(settings, '0000', 0);
  assert.equal(result.lockedForMs, 120_000);
});
