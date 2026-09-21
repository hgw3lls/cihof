import { readFileSync } from 'node:fs';
import { dataFile } from '../paths.ts';

/**
 * Place seeds.
 *
 * All 14 are staff review input: none carries a review record, so none is
 * publishable. They are read anyway so the count is real rather than assumed,
 * and so the Places lens turns itself on the day reviewers finish.
 */
export function readPlaceSeeds(): unknown[] {
  try {
    const document = JSON.parse(readFileSync(dataFile('cihof_places.json'), 'utf8')) as { places?: unknown[] };
    return Array.isArray(document.places) ? document.places : [];
  } catch {
    return [];
  }
}

/** Explicit relationships. Currently an empty list in the canonical source. */
export function readRelationships(): unknown[] {
  try {
    const parsed = JSON.parse(readFileSync(dataFile('cihof_relationships.json'), 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
