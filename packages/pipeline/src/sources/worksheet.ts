import { readFileSync } from 'node:fs';
import type { ContributionWorksheet } from '@cihof/content';
import { dataFile } from '../paths.ts';

/**
 * The contribution worksheet, as curators have left it.
 *
 * Hand-edited between runs, so it is read defensively: a file that is missing,
 * unparseable or half-written yields no worksheet rather than a crash or a
 * partial one. Everything it does carry still passes the publication rules
 * before it reaches anyone.
 */
export function readContributionWorksheet(): ContributionWorksheet | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(dataFile('cihof_contributions.json'), 'utf8'));
  } catch {
    return null;
  }
  const document = parsed as Partial<ContributionWorksheet>;
  if (!document || typeof document !== 'object') return null;
  if (!Array.isArray(document.entries)) return null;
  return document as ContributionWorksheet;
}
