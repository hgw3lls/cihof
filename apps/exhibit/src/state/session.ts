/**
 * Idle-session timing for an unattended display.
 *
 * The timing decision is a pure function of "when did something last happen"
 * and "what time is it now", so it can be tested without waiting and without
 * fake timers. The hook around it only schedules.
 */

export type SessionPhase = 'active' | 'warning' | 'expired';

export type SessionTiming = {
  /** Silence after which the session ends. */
  readonly idleMs: number;
  /** How long the visitor is warned before that happens. */
  readonly warningMs: number;
};

export type SessionReading = {
  readonly phase: SessionPhase;
  /** When the phase next changes. Null once expired. */
  readonly nextChangeAt: number | null;
  /** Whole seconds left before the session ends, for the warning copy. */
  readonly secondsRemaining: number;
};

/**
 * Production floors. A display that resets after a couple of seconds is
 * unusable, and short timings exist only so tests do not take minutes.
 */
export const minimumIdleMs = 30_000;
export const minimumWarningMs = 5_000;

export function normaliseTiming(timing: SessionTiming, allowShortTimings: boolean): SessionTiming {
  const idleMs = allowShortTimings ? Math.max(200, timing.idleMs) : Math.max(minimumIdleMs, timing.idleMs);
  const warningFloor = allowShortTimings ? 100 : minimumWarningMs;
  // The warning has to fit inside the idle period with time left to act.
  const warningMs = Math.min(Math.max(warningFloor, timing.warningMs), Math.floor(idleMs / 2));
  return { idleMs, warningMs };
}

export function readSession(timing: SessionTiming, lastActivityAt: number, now: number): SessionReading {
  const endsAt = lastActivityAt + timing.idleMs;
  const warnsAt = endsAt - timing.warningMs;
  const secondsRemaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  if (now >= endsAt) return { phase: 'expired', nextChangeAt: null, secondsRemaining: 0 };
  if (now >= warnsAt) return { phase: 'warning', nextChangeAt: endsAt, secondsRemaining };
  return { phase: 'active', nextChangeAt: warnsAt, secondsRemaining };
}

/**
 * Whether a media element's state counts as someone being present.
 *
 * Progressing playback does. Paused, ended, stalled or errored media does not:
 * a film left on a broken network would otherwise hold a session open all day.
 */
export function mediaCountsAsActivity(media: { paused: boolean; ended: boolean; progressing: boolean }): boolean {
  return media.progressing && !media.paused && !media.ended;
}
