import { useCallback, useEffect, useRef, useState } from 'react';
import { normaliseTiming, readSession, type SessionPhase, type SessionTiming } from '../state/session.ts';

const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Ends an unattended session and warns first.
 *
 * Everything it registers it removes, and every timer it sets it clears. A
 * display runs for weeks; a listener or timer left behind is a leak that only
 * shows up as a slow degradation nobody can reproduce.
 *
 * Off while the attract screen shows: there is no visit to end, and a warning
 * asking an empty room whether it is still there is noise.
 */
export function useSession(timing: SessionTiming, allowShortTimings: boolean, onExpire: () => void, enabled = true) {
  const effective = normaliseTiming(timing, allowShortTimings);
  const [phase, setPhase] = useState<SessionPhase>('active');
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(effective.idleMs / 1000));
  const lastActivity = useRef(Date.now());
  const timer = useRef<number | null>(null);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  const evaluate = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }

    const reading = readSession(effective, lastActivity.current, Date.now());
    setPhase(reading.phase);
    setSecondsRemaining(reading.secondsRemaining);

    if (reading.phase === 'expired') { expire.current(); return; }
    // Re-check at the next phase change, and once a second while warning so the
    // countdown a visitor is reading stays true.
    const delay = reading.phase === 'warning'
      ? Math.min(1_000, Math.max(50, (reading.nextChangeAt ?? 0) - Date.now()))
      : Math.max(50, (reading.nextChangeAt ?? 0) - Date.now());
    timer.current = window.setTimeout(evaluate, delay);
  }, [effective.idleMs, effective.warningMs]);

  const noteActivity = useCallback(() => {
    lastActivity.current = Date.now();
    evaluate();
  }, [evaluate]);

  useEffect(() => {
    if (!enabled) {
      setPhase('active');
      return undefined;
    }
    // A visit starts now, however long the attract screen was up.
    lastActivity.current = Date.now();
    const onActivity = (event: Event) => {
      // Acting inside the warning is handled by its own controls, so that the
      // dialog cannot be dismissed by a stray touch on the way past.
      if (event.target instanceof Element && event.target.closest('[data-session-warning]')) return;
      noteActivity();
    };

    evaluate();
    for (const name of activityEvents) window.addEventListener(name, onActivity, { passive: true });
    document.addEventListener('scroll', onActivity, { capture: true, passive: true });

    return () => {
      if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
      for (const name of activityEvents) window.removeEventListener(name, onActivity);
      document.removeEventListener('scroll', onActivity, true);
    };
  }, [evaluate, noteActivity, enabled]);

  return { phase, secondsRemaining, noteActivity, effective };
}
