import type { HallLens, HallLinkedPath } from '../../data/types';
import type { PortraitPosition } from './livingHallLayout';
import type { TraceContext } from './livingHallModes';

export type VisitJourneyWallStep = {
  connectionLabel: string;
  index: number;
  suggested: boolean;
};

export function ProjectionGeometryLayer({
  focusedPersonId,
  lens,
  linkedPath,
  positions,
  traceContext,
  visitJourneyOpen,
  visitJourneyWallSteps,
}: {
  focusedPersonId: string;
  lens: HallLens;
  linkedPath: HallLinkedPath | null;
  positions: Map<string, PortraitPosition>;
  traceContext: TraceContext;
  visitJourneyOpen: boolean;
  visitJourneyWallSteps: Map<string, VisitJourneyWallStep>;
}) {
  const origin = focusedPersonId ? positions.get(focusedPersonId) ?? null : null;
  const targets = projectionTargetIds({
    focusedPersonId,
    linkedPath,
    positions,
    traceContext,
    visitJourneyOpen,
    visitJourneyWallSteps,
  })
    .map((id) => ({ id, position: positions.get(id) }))
    .filter((item): item is { id: string; position: PortraitPosition } => Boolean(item.position));
  const active = Boolean(origin && targets.length > 0);
  const focusRadius = origin ? projectionFocusRadius(origin) : 0;

  return (
    <svg
      className="living-hall__projectionLayer"
      aria-hidden="true"
      data-projection-active={active ? 'true' : 'false'}
      data-projection-lens={lens}
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path className="living-hall__projectionHorizon" d="M 7 49.5 H 93" />
      <path className="living-hall__projectionHorizon living-hall__projectionHorizon--vertical" d="M 50 8 V 86" />
      <g className="living-hall__projectionRegisters">
        <path d="M 7 12 h 8 M 7 12 v 8" />
        <path d="M 93 12 h -8 M 93 12 v 8" />
        <path d="M 7 86 h 8 M 7 86 v -8" />
        <path d="M 93 86 h -8 M 93 86 v -8" />
      </g>

      {origin && (
        <g className="living-hall__projectionFocus">
          <circle cx={round(origin.x)} cy={round(origin.y)} r={round(focusRadius + 3.2)} />
          <circle cx={round(origin.x)} cy={round(origin.y)} r={round(focusRadius + 7.4)} />
          <path d={`M ${round(origin.x - focusRadius - 9)} ${round(origin.y)} H ${round(origin.x - focusRadius - 2.8)} M ${round(origin.x + focusRadius + 2.8)} ${round(origin.y)} H ${round(origin.x + focusRadius + 9)}`} />
          <path d={`M ${round(origin.x)} ${round(origin.y - focusRadius - 9)} V ${round(origin.y - focusRadius - 2.8)} M ${round(origin.x)} ${round(origin.y + focusRadius + 2.8)} V ${round(origin.y + focusRadius + 9)}`} />
        </g>
      )}

      {origin && targets.length > 0 && (
        <g className="living-hall__projectionLinks">
          {targets.map((target, index) => (
            <path
              key={target.id}
              className={index === 0 ? 'living-hall__projectionLink living-hall__projectionLink--primary' : 'living-hall__projectionLink'}
              d={projectionPath(origin, target.position, index)}
            />
          ))}
        </g>
      )}

      {targets.length > 0 && (
        <g className="living-hall__projectionNodes">
          {targets.map((target, index) => (
            <g
              key={target.id}
              className={index === 0 ? 'living-hall__projectionNode living-hall__projectionNode--primary' : 'living-hall__projectionNode'}
              transform={`translate(${round(target.position.x)} ${round(target.position.y)})`}
            >
              <circle r={index === 0 ? 0.9 : 0.68} />
              <path d="M -2.5 0 H -1.35 M 1.35 0 H 2.5 M 0 -2.5 V -1.35 M 0 1.35 V 2.5" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function projectionTargetIds({
  focusedPersonId,
  linkedPath,
  positions,
  traceContext,
  visitJourneyOpen,
  visitJourneyWallSteps,
}: {
  focusedPersonId: string;
  linkedPath: HallLinkedPath | null;
  positions: Map<string, PortraitPosition>;
  traceContext: TraceContext;
  visitJourneyOpen: boolean;
  visitJourneyWallSteps: Map<string, VisitJourneyWallStep>;
}) {
  const ids: string[] = [];
  if (visitJourneyOpen) ids.push(...Array.from(visitJourneyWallSteps.keys()));
  if (linkedPath) ids.push(...linkedPath.personIds);
  if (traceContext.activePerson?.id === focusedPersonId) {
    ids.push(...traceContext.visibleThreads.slice(0, 6).map((thread) => thread.person.id));
  }
  if (focusedPersonId && ids.length === 0) {
    positions.forEach((position, id) => {
      if (position.emphasis && id !== focusedPersonId) ids.push(id);
    });
  }

  const seen = new Set<string>();
  return ids.filter((id) => {
    if (!id || id === focusedPersonId || seen.has(id) || !positions.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 8);
}

function projectionPath(origin: PortraitPosition, target: PortraitPosition, index: number) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const bend = (index % 2 === 0 ? 1 : -1) * Math.min(14, Math.max(4, Math.abs(dx + dy) * 0.12));
  const c1x = origin.x + dx * 0.36;
  const c1y = origin.y + dy * 0.18 - bend;
  const c2x = origin.x + dx * 0.64;
  const c2y = origin.y + dy * 0.82 + bend;
  return `M ${round(origin.x)} ${round(origin.y)} C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(target.x)} ${round(target.y)}`;
}

function projectionFocusRadius(position: PortraitPosition) {
  return Math.max(3.8, Math.min(8.5, position.size / 23));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
