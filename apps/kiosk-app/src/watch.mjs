/**
 * Restarts a page only if it stays frozen.
 *
 * Chromium reports a page as unresponsive after a few seconds of being busy,
 * and many recover by themselves. Crashing one that has recovered would reset
 * a visitor's session for nothing, so the restart waits out a grace period and
 * is called off the moment the page responds again.
 *
 * @param {{ onFrozen: () => void, graceMs?: number, setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} options
 */
export function freezeWatch({ onFrozen, graceMs = 30_000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  const cancel = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  return {
    unresponsive() {
      if (timer !== null) return;
      timer = setTimer(() => { timer = null; onFrozen(); }, graceMs);
    },
    responsive: cancel,
    dispose: cancel,
  };
}

/**
 * Restarts a page that has stopped checking in.
 *
 * The browser only calls a page unresponsive when it is given input it cannot
 * answer, so a display that froze with nobody touching it would stay frozen
 * until the nightly restart (the kiosk app's endurance run found this). The
 * exhibit's preload checks in every few seconds from the page's own thread,
 * which a frozen page stops. Silence while a page loads is not a freeze, so
 * the watch pauses then and starts again at the next check-in.
 *
 * @param {{ onSilent: () => void, silenceMs?: number, setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} options
 */
export function heartbeatWatch({ onSilent, silenceMs = 30_000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  const cancel = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  return {
    beat() {
      cancel();
      timer = setTimer(() => { timer = null; onSilent(); }, silenceMs);
    },
    pause: cancel,
    dispose: cancel,
  };
}
