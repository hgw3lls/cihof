import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readTheme } from '../src/app/theme.ts';

test('an installed display is dark unless its admin chose light', () => {
  assert.equal(readTheme('', 'kiosk'), 'dark');
  assert.equal(readTheme('?theme=light', 'kiosk'), 'light');
});

test('the public site follows the visitor’s device unless the address says otherwise', () => {
  assert.equal(readTheme('', 'public'), 'auto');
  assert.equal(readTheme('?theme=dark', 'public'), 'dark');
});

test('an unrecognised theme falls back to the default, silently', () => {
  assert.equal(readTheme('?theme=sepia', 'kiosk'), 'dark');
  assert.equal(readTheme('?theme=sepia', 'public'), 'auto');
});
