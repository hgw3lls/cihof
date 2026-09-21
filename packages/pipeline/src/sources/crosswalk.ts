import { readFileSync } from 'node:fs';
import type { InductionCrosswalk } from '@cihof/content';
import { dataFile } from '../paths.ts';

/**
 * The induction crosswalk, as curators have left it.
 *
 * Hand-edited between runs, so it is read defensively: a file that is missing,
 * unparseable or half-written yields no crosswalk rather than a crash or, far
 * worse, a partial one that quietly drops resolved rows. Every entry that does
 * survive still passes through the publication rules before it reaches anyone.
 */
export function readInductionCrosswalk(): InductionCrosswalk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(dataFile('cihof_induction_crosswalk.json'), 'utf8'));
  } catch {
    return null;
  }
  const document = parsed as Partial<InductionCrosswalk>;
  if (!document || typeof document !== 'object') return null;
  if (!Array.isArray(document.entries)) return null;
  return document as InductionCrosswalk;
}
