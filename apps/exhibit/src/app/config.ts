/**
 * Build-time configuration, read by explicit key.
 *
 * Never index import.meta.env with a variable: a computed lookup defeats the
 * static replacement and inlines the whole env object into the bundle, which is
 * how a staff passcode once reached a public artifact.
 */
const raw = {
  idleMs: import.meta.env.VITE_CIHOF_IDLE_MS,
  warningMs: import.meta.env.VITE_CIHOF_WARNING_MS,
  testMode: import.meta.env.VITE_CIHOF_TEST_MODE,
  invitationMs: import.meta.env.VITE_CIHOF_INVITATION_MS,
};

/**
 * Short timings are only honoured when the build says it is a test build, and
 * a test build says so on screen. A production build floors them instead, so a
 * 1.6-second idle cannot ship to a wall by way of a stray environment variable.
 */
export const isTestBuild = raw.testMode === '1';

const minimumInvitationMs = 6_000;

/**
 * A visitor who has stopped touching the display is asked whether they are
 * still there after a minute, and the display starts over twenty seconds
 * later. A film playing counts as somebody there.
 */
export const configuredTiming = {
  idleMs: toMs(raw.idleMs, 80_000),
  warningMs: toMs(raw.warningMs, 20_000),
};

/**
 * How long the offer of How this works stays on screen for a visitor who has
 * just come in and has not touched anything yet. Their first touch retires it
 * sooner; the key on the bar stays either way, so missing it costs nothing.
 * A production build keeps it up long enough to read.
 */
export const invitationMs = isTestBuild
  ? toMs(raw.invitationMs, 12_000)
  : Math.max(minimumInvitationMs, toMs(raw.invitationMs, 12_000));

function toMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
