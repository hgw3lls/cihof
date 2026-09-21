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
};

/**
 * Short timings are only honoured when the build says it is a test build, and
 * a test build says so on screen. A production build floors them instead, so a
 * 1.6-second idle cannot ship to a wall by way of a stray environment variable.
 */
export const isTestBuild = raw.testMode === '1';

export const configuredTiming = {
  idleMs: toMs(raw.idleMs, 120_000),
  warningMs: toMs(raw.warningMs, 30_000),
};

function toMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
