import { useCallback, useEffect, useRef, useState } from 'react';

export type SessionResetReason = 'manual' | 'idle';

type Options = {
  enabled: boolean;
  suspended: boolean;
  timeoutMs: number;
  warningMs: number;
  sessionVersion: number;
  onWarning?: () => void;
  onReset: (reason: SessionResetReason) => void;
};

type TimerHandles = {
  warning: number | null;
  reset: number | null;
};

export function useExhibitSessionTimeout({
  enabled,
  suspended,
  timeoutMs,
  warningMs,
  sessionVersion,
  onWarning,
  onReset,
}: Options) {
  const [warningActive, setWarningActive] = useState(false);
  const [extensionCount, setExtensionCount] = useState(0);
  const timers = useRef<TimerHandles>({ warning: null, reset: null });
  const resetRef = useRef(onReset);
  const warningRef = useRef(onWarning);
  resetRef.current = onReset;
  warningRef.current = onWarning;

  const effectiveWarningMs = Math.min(Math.max(0, warningMs), Math.max(0, timeoutMs - 1_000));

  const clearTimers = useCallback(() => {
    if (timers.current.warning !== null) window.clearTimeout(timers.current.warning);
    if (timers.current.reset !== null) window.clearTimeout(timers.current.reset);
    timers.current = { warning: null, reset: null };
  }, []);

  const schedule = useCallback(() => {
    clearTimers();
    setWarningActive((current) => current ? false : current);
    if (!enabled || suspended || timeoutMs <= 0) return;

    if (effectiveWarningMs > 0) {
      timers.current.warning = window.setTimeout(() => {
        timers.current.warning = null;
        warningRef.current?.();
        setWarningActive(true);
      }, Math.max(0, timeoutMs - effectiveWarningMs));
    }

    timers.current.reset = window.setTimeout(() => {
      timers.current.reset = null;
      setWarningActive(false);
      resetRef.current('idle');
    }, timeoutMs);
  }, [clearTimers, effectiveWarningMs, enabled, sessionVersion, suspended, timeoutMs]);

  const noteActivity = useCallback(() => schedule(), [schedule]);
  const extendSession = useCallback(() => {
    setExtensionCount((count) => count + 1);
    schedule();
  }, [schedule]);

  useEffect(() => {
    setExtensionCount(0);
  }, [sessionVersion]);

  useEffect(() => {
    const handleActivity = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.session-warning')) return;
      noteActivity();
    };
    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };

    schedule();
    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    document.addEventListener('scroll', handleActivity, scrollOptions);

    return () => {
      clearTimers();
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('scroll', handleActivity, true);
    };
  }, [clearTimers, noteActivity, schedule]);

  return {
    warningActive,
    warningMs: effectiveWarningMs,
    extensionCount,
    noteActivity,
    extendSession,
  };
}
