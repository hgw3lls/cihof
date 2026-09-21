import type { Inductee } from './types';

export function inducteeContextLabel(inductee: Inductee) {
  return inductee.documentedContextLine.trim();
}

export function honoredForSummary(inductee: Inductee) {
  if (inductee.honoredForSummary.trim()) return inductee.honoredForSummary.trim();
  return inductee.storySummarySource === 'curated' ? inductee.storySummary.trim() : '';
}
