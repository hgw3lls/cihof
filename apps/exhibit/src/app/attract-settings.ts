/**
 * The attract screen, as the display's admin chose it.
 *
 * The kiosk app passes its saved choice on the address it opens. Each value is
 * checked against a fixed list and anything else falls back to the default,
 * silently: a mistyped address must never leave a wall blank or throw.
 * Settings here may only lengthen timings, so the spotlight never moves more
 * often than every four seconds.
 */
export const attractModes = ['mosaic', 'names', 'stacked'] as const;
export type AttractMode = (typeof attractModes)[number];
export const spotlightChoices = [4, 6, 10] as const;

export type AttractSettings = {
  readonly mode: AttractMode;
  readonly rotate: boolean;
  readonly spotlightMs: number;
  readonly motion: boolean;
};

export const attractDefaults: AttractSettings = { mode: 'mosaic', rotate: false, spotlightMs: 6000, motion: true };

export function readAttractSettings(search: string): AttractSettings {
  const params = new URLSearchParams(search);
  const mode = params.get('attract');
  const seconds = Number(params.get('spotlight'));
  return {
    mode: (attractModes as readonly string[]).includes(mode ?? '') ? mode as AttractMode : attractDefaults.mode,
    rotate: flag(params.get('attractRotate'), attractDefaults.rotate),
    spotlightMs: (spotlightChoices as readonly number[]).includes(seconds) ? seconds * 1000 : attractDefaults.spotlightMs,
    motion: flag(params.get('motion'), attractDefaults.motion),
  };
}

/** The next mode when rotating, one step on from the one just shown. */
export function nextAttractMode(current: AttractMode): AttractMode {
  return attractModes[(attractModes.indexOf(current) + 1) % attractModes.length]!;
}

function flag(value: string | null, fallback: boolean): boolean {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return fallback;
}
