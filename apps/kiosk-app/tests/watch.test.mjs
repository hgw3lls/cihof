import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freezeWatch, heartbeatWatch } from '../src/watch.mjs';

/** A page that freezes and recovers keeps its visitor; one that stays frozen is restarted. */

const clock = () => {
  const timers = new Map();
  let next = 1;
  return {
    setTimer: (fn, ms) => { const id = next++; timers.set(id, { fn, ms }); return id; },
    clearTimer: (id) => timers.delete(id),
    fire: () => { for (const [id, { fn }] of [...timers]) { timers.delete(id); fn(); } },
    pending: () => timers.size,
  };
};

test('a page that stays frozen through the grace period is restarted', () => {
  const time = clock();
  let restarts = 0;
  const watch = freezeWatch({ onFrozen: () => { restarts += 1; }, ...time });
  watch.unresponsive();
  time.fire();
  assert.equal(restarts, 1);
});

test('a page that recovers in time is left alone', () => {
  const time = clock();
  let restarts = 0;
  const watch = freezeWatch({ onFrozen: () => { restarts += 1; }, ...time });
  watch.unresponsive();
  watch.responsive();
  time.fire();
  assert.equal(restarts, 0);
  assert.equal(time.pending(), 0);
});

test('repeated freeze reports do not stack restarts, and a closed window cancels one', () => {
  const time = clock();
  let restarts = 0;
  const watch = freezeWatch({ onFrozen: () => { restarts += 1; }, ...time });
  watch.unresponsive();
  watch.unresponsive();
  assert.equal(time.pending(), 1);
  watch.dispose();
  time.fire();
  assert.equal(restarts, 0);
});

test('a page that stops checking in is restarted, whether or not anyone touched it', () => {
  const time = clock();
  let restarts = 0;
  const watch = heartbeatWatch({ onSilent: () => { restarts += 1; }, ...time });
  watch.beat();
  time.fire();
  assert.equal(restarts, 1);
});

test('a page that keeps checking in is left alone, and only one wait is ever pending', () => {
  const time = clock();
  let restarts = 0;
  const watch = heartbeatWatch({ onSilent: () => { restarts += 1; }, ...time });
  watch.beat();
  watch.beat();
  watch.beat();
  assert.equal(time.pending(), 1);
  assert.equal(restarts, 0);
});

test('silence while a page loads is not a freeze, and the watch starts again at the next check-in', () => {
  const time = clock();
  let restarts = 0;
  const watch = heartbeatWatch({ onSilent: () => { restarts += 1; }, ...time });
  watch.beat();
  watch.pause();
  time.fire();
  assert.equal(restarts, 0);
  watch.beat();
  watch.dispose();
  time.fire();
  assert.equal(restarts, 0);
});
