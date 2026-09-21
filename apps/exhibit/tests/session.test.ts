import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mediaCountsAsActivity, minimumIdleMs, minimumWarningMs, normaliseTiming, readSession,
} from '../src/state/session.ts';

const timing = { idleMs: 120_000, warningMs: 30_000 };

test('the phase is a pure reading of the clock', () => {
  const start = 1_000_000;
  assert.deepEqual(readSession(timing, start, start), { phase: 'active', nextChangeAt: start + 90_000, secondsRemaining: 120 });
  assert.equal(readSession(timing, start, start + 89_999).phase, 'active');
  assert.equal(readSession(timing, start, start + 90_000).phase, 'warning');
  assert.equal(readSession(timing, start, start + 119_999).phase, 'warning');
  assert.equal(readSession(timing, start, start + 120_000).phase, 'expired');
  assert.equal(readSession(timing, start, start + 500_000).phase, 'expired');
});

test('the warning counts down in whole seconds and never goes negative', () => {
  const start = 0;
  assert.equal(readSession(timing, start, start + 90_000).secondsRemaining, 30);
  assert.equal(readSession(timing, start, start + 119_500).secondsRemaining, 1);
  assert.equal(readSession(timing, start, start + 130_000).secondsRemaining, 0);
});

test('an expired session schedules nothing further', () => {
  assert.equal(readSession(timing, 0, 200_000).nextChangeAt, null);
});

test('production refuses the short timings tests rely on', () => {
  // A Playwright run uses a 1.6s idle. Shipping that would reset the display
  // under a visitor's hands, so a production build floors it.
  const production = normaliseTiming({ idleMs: 1_600, warningMs: 500 }, false);
  assert.equal(production.idleMs, minimumIdleMs);
  assert.ok(production.warningMs >= minimumWarningMs);

  const underTest = normaliseTiming({ idleMs: 1_600, warningMs: 500 }, true);
  assert.equal(underTest.idleMs, 1_600);
  assert.equal(underTest.warningMs, 500);
});

test('a warning always fits inside the idle period', () => {
  const silly = normaliseTiming({ idleMs: 60_000, warningMs: 90_000 }, false);
  assert.ok(silly.warningMs <= silly.idleMs / 2, 'the visitor must have time left to act on the warning');
  assert.equal(readSession(silly, 0, 0).phase, 'active');
});

test('only progressing playback holds a session open', () => {
  assert.equal(mediaCountsAsActivity({ paused: false, ended: false, progressing: true }), true);
  assert.equal(mediaCountsAsActivity({ paused: true, ended: false, progressing: true }), false, 'paused is not presence');
  assert.equal(mediaCountsAsActivity({ paused: false, ended: true, progressing: true }), false, 'a finished film is not presence');
  assert.equal(mediaCountsAsActivity({ paused: false, ended: false, progressing: false }), false, 'a stalled film is not presence');
});
