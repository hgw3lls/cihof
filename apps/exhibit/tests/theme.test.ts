import assert from 'node:assert/strict';
import { test } from 'node:test';
import { otherTheme, readTheme } from '../src/app/theme.ts';

test('an installed display is dark unless its admin chose light', () => {
  assert.equal(readTheme('', 'kiosk'), 'dark');
  assert.equal(readTheme('?theme=light', 'kiosk'), 'light');
  assert.equal(readTheme('', 'kiosk', 'light'), 'dark', 'a visitor’s choice is never read on the display');
});

test('the public site starts light, and keeps a visitor’s own choice', () => {
  assert.equal(readTheme('', 'public'), 'light');
  assert.equal(readTheme('', 'public', 'dark'), 'dark');
  assert.equal(readTheme('', 'public', 'sepia'), 'light');
  assert.equal(readTheme('?theme=auto', 'public', 'dark'), 'auto', 'the address still decides first');
});

test('an unrecognised theme falls back to the default, silently', () => {
  assert.equal(readTheme('?theme=sepia', 'kiosk'), 'dark');
  assert.equal(readTheme('?theme=sepia', 'public'), 'light');
});

test('the switch offers the other colours from what is showing', () => {
  assert.equal(otherTheme('light', true), 'dark');
  assert.equal(otherTheme('dark', false), 'light');
  assert.equal(otherTheme('auto', true), 'light');
  assert.equal(otherTheme('auto', false), 'dark');
});
