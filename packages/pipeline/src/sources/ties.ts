import { readFileSync } from 'node:fs';
import { dataFile } from '../paths.ts';

/**
 * Review decisions on the ties the HOF World corpus proposes.
 *
 * Written only by `npm run ties:apply`, from the proposed-ties sheet, so every
 * decision arrives as a diff with the signed sheet archived beside it. Read
 * defensively: a missing or half-written file yields no decisions, never a
 * crash or a partial list.
 */
export type TieDecision = {
  /** The preview's id for the tie, which the sheet and the map share. */
  readonly tieId: string;
  readonly corpusIds: readonly string[];
  readonly personA: string;
  readonly personB: string;
  readonly sourceType: string;
  readonly decision: 'relationship' | 'context' | 'reject';
  /** For a relationship. */
  readonly kind?: string;
  /** Reads from person A. For context, the statement shown. */
  readonly label?: string;
  /** Reads from person B. Required for a directional kind. */
  readonly inverseLabel?: string;
  readonly evidence: readonly string[];
  readonly sourceUrls: readonly string[];
  readonly verificationLayer: string;
  readonly decisionReference: string;
  /** Identifies the wording decided on, derived from it by the apply step. */
  readonly contentVersion: string;
  readonly reviewedAt: string;
  readonly publication: { readonly publicWeb: boolean; readonly kiosk: boolean };
  readonly note?: string;
};

export function readTieDecisions(): TieDecision[] {
  try {
    const document = JSON.parse(readFileSync(dataFile('cihof_tie_decisions.json'), 'utf8')) as { decisions?: unknown };
    return Array.isArray(document.decisions) ? (document.decisions as TieDecision[]) : [];
  } catch {
    return [];
  }
}
