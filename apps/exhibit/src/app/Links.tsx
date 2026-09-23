import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublishedRelationship } from '@cihof/content';
import type { RuntimePerson } from '../data/runtime.ts';
import { connectionMap, connectionNodes } from '../state/selectors.ts';

type Props = {
  people: readonly RuntimePerson[];
  relationships: readonly PublishedRelationship[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

/** How long the map takes to settle after a new person is chosen. */
const settleMs = 620;

/**
 * The collection as a map of documented relationships.
 *
 * Only relationships a curator approved with evidence arrive here — the bundle
 * carries no others, and the lens is absent below its threshold. Every line is
 * a claim somebody signed.
 *
 * Choosing a person re-centres the map on them: the people a source says they
 * touched swing in around them, the rest of their island settles beyond, and
 * the other islands hold the rim. `connectionMap` decides all of it, so the
 * arrangement is testable and identical every time — a visitor who points at a
 * portrait and looks back should find it where it was.
 *
 * Three things this deliberately does not do.
 *
 * It does not draw shared context. Twelve dashed lines per person meaning
 * "inducted the same year" is what the previous Links scene showed, and beside
 * a documented relationship they were indistinguishable in shape.
 *
 * It does not take `discovery`. A search term narrowing a relationship graph
 * removes the people a visitor came to the graph to find.
 *
 * It does not run a physics simulation, and it stops moving once it arrives.
 * A force layout of this data — 16 islands, nobody holding more than four
 * ties — is a scatter of specks that jitters and never settles, and perpetual
 * motion on a display that runs for months is a heater and a burn-in risk.
 */
export function Links({ people, relationships, selectedId, onSelect, onOpen }: Props) {
  const nodes = useMemo(() => connectionNodes(people, relationships), [people, relationships]);
  const map = useMemo(() => connectionMap(nodes, selectedId), [nodes, selectedId]);
  const at = useSettling(map, selectedId);

  if (map.placed.length === 0) {
    return <p className="empty">No documented relationship is published in this release.</p>;
  }

  const focusId = map.focus?.id ?? null;
  // Unit space is -1.2..1.2 with the focus at the origin; the rim sits at 1.06.
  const toPercent = (value: number) => `${50 + (value / 2.4) * 100}%`;

  return (
    <div className="map">
      <p className="map__note">
        {relationships.length} documented {relationships.length === 1 ? 'relationship' : 'relationships'}.
        {' '}Touch anyone to bring them to the centre.
      </p>

      <div className="map__field">
        <svg className="map__ties" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {map.ties.map((tie) => {
            const a = at(tie.from);
            const b = at(tie.to);
            if (!a || !b) return null;
            return (
              <line
                key={tie.connectionId}
                className={tie.touchesFocus ? 'map__tie map__tie--focus' : 'map__tie'}
                x1={50 + (a.x / 2.4) * 100} y1={50 + (a.y / 2.4) * 100}
                x2={50 + (b.x / 2.4) * 100} y2={50 + (b.y / 2.4) * 100}
              />
            );
          })}
        </svg>

        {map.placed.map((entry) => {
          const position = at(entry.person.id) ?? entry;
          const isFocus = entry.person.id === focusId;
          // A name hung below a portrait that sits above the centre lands on
          // the centre. Hang it on whichever side faces away from the middle.
          const outward = position.y < -0.04 ? ' map__person--nameup' : '';
          return (
            <button
              key={entry.person.id}
              type="button"
              className={`map__person map__person--${entry.ring}${outward}`}
              style={{ left: toPercent(position.x), top: toPercent(position.y) }}
              aria-pressed={isFocus}
              // The approved wording, so a screen reader hears the claim rather
              // than two names and a line it cannot see.
              aria-label={entry.label ? `${entry.person.name} — ${entry.label}` : entry.person.name}
              onClick={() => onSelect(entry.person.id)}
              onDoubleClick={() => onOpen(entry.person.id)}
            >
              <span className="map__portrait">
                {entry.person.portrait
                  ? (
                    <img
                      src={asset(entry.person.portrait.src)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      {...(entry.person.portrait.focalPoint ? { style: { objectPosition: entry.person.portrait.focalPoint } } : {})}
                    />
                  )
                  : <img src={asset('media/placeholder.svg')} alt="" aria-hidden="true" />}
              </span>
              <span className="map__name">{entry.person.name}</span>
              {entry.label && <span className="map__label">{entry.label}</span>}
            </button>
          );
        })}
      </div>

      {map.focus && (
        <p className="map__reading">
          <strong>{map.focus.name}</strong>
          {map.clusterSize > 1
            ? ` connects to ${map.clusterSize - 1} ${map.clusterSize === 2 ? 'person' : 'people'} here.`
            : ' has no documented relationship in this release.'}
          {map.islands > 0 && ` ${map.islands} other ${map.islands === 1 ? 'group sits' : 'groups sit'} around the edge.`}
          {' '}
          <button type="button" className="map__open" onClick={() => onOpen(map.focus!.id)}>
            Read the record
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * Eases the map from where it was to where it is going.
 *
 * Positions are interpolated in one loop rather than left to CSS, because the
 * lines and the portraits have to arrive together — a transition on the
 * buttons alone would leave every tie detached from both ends for half a
 * second. The loop stops when it arrives.
 *
 * Somebody who has asked their system not to animate gets the destination.
 */
function useSettling(map: ReturnType<typeof connectionMap>, selectedId: string | null) {
  const targets = useMemo(
    () => new Map(map.placed.map((entry) => [entry.person.id, { x: entry.x, y: entry.y }])),
    [map],
  );
  const current = useRef(new Map<string, { x: number; y: number }>());
  const [, tick] = useState(0);

  useEffect(() => {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = new Map(current.current);
    // Somebody arriving from off the rim starts where they were, and somebody
    // new to the map grows out of the centre rather than flying in from 0,0.
    for (const [id, target] of targets) if (!from.has(id)) from.set(id, { x: target.x * 0.2, y: target.y * 0.2 });

    if (reduced) {
      current.current = new Map(targets);
      tick((value) => value + 1);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - started) / settleMs, 1);
      // Ease-out cubic: quick to leave, slow to arrive.
      const eased = 1 - (1 - progress) ** 3;
      const next = new Map<string, { x: number; y: number }>();
      for (const [id, target] of targets) {
        const origin = from.get(id) ?? target;
        next.set(id, {
          x: origin.x + (target.x - origin.x) * eased,
          y: origin.y + (target.y - origin.y) * eased,
        });
      }
      current.current = next;
      tick((value) => value + 1);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [targets, selectedId]);

  return (id: string) => current.current.get(id) ?? targets.get(id) ?? null;
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
