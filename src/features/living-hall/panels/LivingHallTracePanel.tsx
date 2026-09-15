import {
  relationshipLineLabel,
  type NetworkReason,
} from '../../../data/traceModel';
import type { TraceContext } from '../livingHallModes';

export function traceActiveTitle(context: TraceContext) {
  if (context.mode === 'concept') return context.activeConcept?.lens.label ?? 'Concept Trace';
  if (context.mode === 'place') return context.placeFocus.label;
  return 'Direct Ties';
}

export function traceReasonChipLabel(reason: NetworkReason, activeName: string) {
  return compactTraceText(relationshipLineLabel(reason, activeName), 30);
}

export function compactTraceText(value: string, maxLength = 82) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).replace(/[,;:\s]+$/, '')}...`;
}
