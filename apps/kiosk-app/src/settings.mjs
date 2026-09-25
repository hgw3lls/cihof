import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * The display's own settings, kept in a file beside the app's other data.
 *
 * Only lasting settings live here. Debug switches are deliberately not
 * settings: they live in memory and are gone at the next restart, so a
 * display cannot be left with developer tools open by accident.
 */

export const defaults = Object.freeze({
  /** Local port for the exhibit. Fixed, because the offline store belongs to it. */
  port: 8080,
  /** Daily restart, local time, or "off". */
  restartAt: '04:00',
  /** Start when this account signs in (Windows and macOS). */
  startAtLogin: true,
  /** scrypt hash of the admin passcode; null until staff set one. */
  passcode: null,
  /** Failed attempts and when the keypad unlocks again, to stop guessing. */
  lockout: { failures: 0, until: 0 },
  /** What the display shows while nobody is using it. */
  attractMode: 'mosaic',
  /** A different attract screen each time the display goes idle. */
  attractRotate: false,
  /** How often the spotlight moves, in seconds. Mosaic and Stacked only. */
  spotlightSeconds: 6,
  /** Off stops the drifting rows; the spotlight still moves, without animating. */
  motion: true,
  /** Dark, as designed, or light for a bright room. */
  theme: 'dark',
});

export const themes = Object.freeze(['dark', 'light']);
/** The window's colour before the exhibit paints, so a reload never flashes the other one. */
export const themeGround = Object.freeze({ dark: '#121211', light: '#f4f2ec' });

export const attractModes = Object.freeze(['mosaic', 'names', 'stacked']);
/** Settings may only lengthen timings, so nothing faster than every four seconds. */
export const spotlightChoices = Object.freeze([4, 6, 10]);

/**
 * The attract and appearance settings as they may be stored, each checked against a fixed
 * list. Anything else falls back to its default, so a damaged file can never
 * leave the wall blank.
 */
export function attractSettings(settings) {
  return {
    attractMode: attractModes.includes(settings?.attractMode) ? settings.attractMode : defaults.attractMode,
    attractRotate: typeof settings?.attractRotate === 'boolean' ? settings.attractRotate : defaults.attractRotate,
    spotlightSeconds: spotlightChoices.includes(settings?.spotlightSeconds) ? settings.spotlightSeconds : defaults.spotlightSeconds,
    motion: typeof settings?.motion === 'boolean' ? settings.motion : defaults.motion,
    theme: themes.includes(settings?.theme) ? settings.theme : defaults.theme,
  };
}

/** Why a value cannot be saved, or null. The admin panel shows the reason. */
export function attractProblem(name, value) {
  if (name === 'attractMode') return attractModes.includes(value) ? null : `Choose one of: ${attractModes.join(', ')}.`;
  if (name === 'spotlightSeconds') return spotlightChoices.includes(value) ? null : `Choose ${spotlightChoices.join(', ')} seconds.`;
  if (name === 'attractRotate' || name === 'motion') return typeof value === 'boolean' ? null : 'On or off.';
  if (name === 'theme') return themes.includes(value) ? null : `Choose ${themes.join(' or ')}.`;
  return `Unknown setting: ${name}`;
}

/** The exhibit's address with the attract settings on it, which the page reads. */
export function exhibitAddress(origin, settings, extra = {}) {
  const attract = attractSettings(settings);
  const params = new URLSearchParams({
    attract: attract.attractMode,
    attractRotate: attract.attractRotate ? '1' : '0',
    spotlight: String(attract.spotlightSeconds),
    motion: attract.motion ? '1' : '0',
    theme: attract.theme,
    ...extra,
  });
  return `${origin}/?${params}`;
}

export function loadSettings(path) {
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8'));
    return { ...defaults, ...stored, lockout: { ...defaults.lockout, ...(stored.lockout ?? {}) }, ...attractSettings(stored) };
  } catch {
    return { ...defaults, lockout: { ...defaults.lockout } };
  }
}

/** Written to a temporary file and renamed, so a power cut never leaves half a file. */
export function saveSettings(path, settings) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`);
  renameSync(temporary, path);
}

/** At least four digits, so a visitor cannot stumble on it. */
export function passcodeProblem(code) {
  if (typeof code !== 'string' || !/^\d{4,12}$/.test(code)) return 'Use 4 to 12 digits.';
  return null;
}

export function hashPasscode(code) {
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 32);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function passcodeMatches(code, stored) {
  if (typeof stored !== 'string' || typeof code !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(code, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Five wrong tries lock the keypad, for a minute and then longer. */
const lockoutAfter = 5;

/**
 * @returns {{ ok: boolean, settings: object, lockedForMs?: number }}
 */
export function attemptPasscode(settings, code, now = Date.now()) {
  if (settings.lockout.until > now) {
    return { ok: false, settings, lockedForMs: settings.lockout.until - now };
  }
  if (passcodeMatches(code, settings.passcode)) {
    return { ok: true, settings: { ...settings, lockout: { failures: 0, until: 0 } } };
  }
  const failures = settings.lockout.failures + 1;
  const locked = failures >= lockoutAfter;
  const until = locked ? now + 60_000 * 2 ** Math.min(failures - lockoutAfter, 5) : 0;
  return {
    ok: false,
    settings: { ...settings, lockout: { failures, until } },
    ...(locked ? { lockedForMs: until - now } : {}),
  };
}
