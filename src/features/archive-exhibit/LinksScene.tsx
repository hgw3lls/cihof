import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import type { EntityRelationshipRecord, Inductee } from '../../data/types';
import { archiveLinks } from './archiveModel';
import { layoutLinks } from './linkLayout';

type Props = {
  people: Inductee[];
  relationships: EntityRelationshipRecord[];
  selected: Inductee | undefined;
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onRecord: () => void;
  portrait: ComponentType<{ person: Inductee; eager?: boolean }>;
};

export function LinksScene({ people, relationships, selected, query, setQuery, onSelect, onRecord, portrait: Portrait }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 760 });
  const [resolved, setResolved] = useState<{ key: string; points: Map<string, { x: number; y: number }> } | null>(null);
  const links = useMemo(() => selected ? archiveLinks(selected, people, relationships) : [], [selected, people, relationships]);
  const layout = useMemo(() => selected ? layoutLinks(selected.id, links, size.width, size.height) : null, [selected, links, size]);
  const layoutKey = `${selected?.id ?? ''}:${size.width}:${size.height}`;
  const points = resolved?.key === layoutKey ? resolved.points : layout?.points;
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const relation of relationships) {
      for (const id of [relation.sourceEntityId, relation.targetEntityId]) map.set(id.slice(7), (map.get(id.slice(7)) ?? 0) + 1);
    }
    return map;
  }, [relationships]);
  const matches = people.filter((person) => !query.trim() || person.name.toLowerCase().includes(query.trim().toLowerCase()) || String(person.classYear).includes(query.trim()));

  useEffect(() => {
    if (!selected || !stageRef.current || !viewportRef.current) return;
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    const update = () => {
      setSize({ width: stage.clientWidth, height: stage.clientHeight });
      viewport.scrollLeft = (stage.clientWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = (stage.clientHeight - viewport.clientHeight) / 2;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage); observer.observe(viewport);
    return () => observer.disconnect();
  }, [selected?.id]);

  useLayoutEffect(() => {
    if (!selected || !layout || !stageRef.current) return;
    const stage = stageRef.current;
    const buttons = new Map([...stage.querySelectorAll<HTMLButtonElement>('.map-node')].map((button) => [button.dataset.personId!, button]));
    const next = new Map([...layout.points].map(([id, point]) => [id, { ...point }]));
    const boxes = new Map([...buttons].map(([id, button]) => {
      const rect = button.getBoundingClientRect();
      return [id, { width: rect.width, height: rect.height }];
    }));
    const ids = [...next.keys()];
    const keepInside = (id: string) => {
      const point = next.get(id)!;
      const box = boxes.get(id)!;
      point.x = Math.max(box.width / 2 + 8, Math.min(stage.clientWidth - box.width / 2 - 8, point.x));
      point.y = Math.max(box.height / 2 + 8, Math.min(stage.clientHeight - box.height / 2 - 8, point.y));
    };
    for (let pass = 0; pass < 30; pass += 1) {
      let collisions = 0;
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
        const a = next.get(ids[i])!;
        const b = next.get(ids[j])!;
        const aBox = boxes.get(ids[i])!;
        const bBox = boxes.get(ids[j])!;
        const overlapX = (aBox.width + bBox.width) / 2 + 6 - Math.abs(a.x - b.x);
        const overlapY = (aBox.height + bBox.height) / 2 + 6 - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        collisions += 1;
        const aShare = ids[i] === selected.id ? 0 : ids[j] === selected.id ? 1 : 0.5;
        const directionX = a.x <= b.x ? -1 : 1;
        a.x += directionX * overlapX * aShare;
        b.x -= directionX * overlapX * (1 - aShare);
        keepInside(ids[i]); keepInside(ids[j]);
        if ((aBox.width + bBox.width) / 2 + 6 - Math.abs(a.x - b.x) <= 0) continue;
        const directionY = a.y <= b.y ? -1 : 1;
        a.y += directionY * overlapY * aShare;
        b.y -= directionY * overlapY * (1 - aShare);
        keepInside(ids[i]); keepInside(ids[j]);
      }
      if (!collisions) break;
    }
    setResolved({ key: layoutKey, points: next });
  }, [layout, layoutKey, selected]);

  if (!selected) return <section className="link-index" aria-label="Relationship index">
    <header className="link-index__header"><strong>RELATIONSHIP INDEX</strong><span>{matches.length} / {people.length}</span>
      <label><input type="search" aria-label="Find a person in the relationship index" placeholder="Find a person" value={query} onChange={(event) => setQuery(event.target.value)} /></label></header>
    <div className="link-index__grid">{matches.map((person) => <button key={person.id} className="link-index__person" type="button"
      aria-label={`Explore links for ${person.name}, Class of ${person.classYear}, ${counts.get(person.id) ?? 0} archive references`} onClick={() => onSelect(person.id)}>
      <strong>{person.name}</strong><span>CLASS OF {person.classYear}</span><small>{counts.get(person.id) ?? 0} ARCHIVE REFERENCES</small></button>)}
      {!matches.length && <p className="empty">NO MATCHING PEOPLE</p>}</div>
  </section>;

  const center = points?.get(selected.id);
  return <section className="link-map" aria-label="Portrait map of linked inductees">
    <header className="link-map__header"><strong>LINKED LIVES</strong><div className="link-map__legend">
      <span className="link-map__legend-item link-map__legend-item--archive">{links.filter((item) => item.kind === 'archive').length} ARCHIVE REFERENCES</span>
      <span className="link-map__legend-item link-map__legend-item--class">{links.filter((item) => item.kind === 'class').length} CLASSMATES</span>
    </div></header>
    <div className="link-map__viewport" ref={viewportRef}><div className="link-map__stage" ref={stageRef} style={{ '--map-scale': layout?.scale ?? 1 } as CSSProperties}>
      <svg className="link-map__edges" aria-hidden="true">{center && links.map((link) => {
        const point = points?.get(link.person.id);
        return point && <line key={link.person.id} className={`map-edge map-edge--${link.kind}`} x1={center.x} y1={center.y} x2={point.x} y2={point.y} />;
      })}</svg>
      <div className="link-map__nodes">{[{ person: selected, kind: 'center' as const, context: 'Open full record' }, ...links].map((item) => {
        const point = points?.get(item.person.id);
        return <button key={item.person.id} id={item.kind === 'center' ? 'mapCenterButton' : undefined}
          className={`map-node map-node--${item.kind}`} type="button" data-person-id={item.person.id} style={{ left: point?.x ?? size.width / 2, top: point?.y ?? size.height / 2 }}
          aria-label={item.kind === 'center' ? `Open full record for ${item.person.name}` : `Select ${item.person.name}. ${item.context}`}
          onClick={() => item.kind === 'center' ? onRecord() : onSelect(item.person.id)}>
          <Portrait person={item.person} eager={item.kind === 'center'} />
          <span className="map-node__caption"><strong>{item.person.name}</strong>{item.kind === 'center' && <small>READ RECORD</small>}</span>
        </button>;
      })}</div>
    </div></div>
  </section>;
}
