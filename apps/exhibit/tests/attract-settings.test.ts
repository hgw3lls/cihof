import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attractDefaults, nextAttractMode, readAttractSettings } from '../src/app/attract-settings.ts';

test('an address with no attract settings gets the defaults', () => {
  assert.deepEqual(readAttractSettings(''), attractDefaults);
});

test('each saved choice is read from the address', () => {
  assert.deepEqual(readAttractSettings('?attract=stacked&attractRotate=1&spotlight=10&motion=0'),
    { mode: 'stacked', rotate: true, spotlightMs: 10_000, motion: false });
});

test('anything unrecognised falls back rather than failing', () => {
  assert.deepEqual(readAttractSettings('?attract=carousel&attractRotate=maybe&spotlight=1&motion=yes'), attractDefaults);
  assert.equal(readAttractSettings('?spotlight=2').spotlightMs, 6000, 'the spotlight never moves faster than every four seconds');
});

test('rotating steps through every mode and comes round again', () => {
  assert.deepEqual(['mosaic', 'names', 'stacked'].map((mode) => nextAttractMode(mode as 'mosaic')), ['names', 'stacked', 'mosaic']);
});
