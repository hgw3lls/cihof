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
