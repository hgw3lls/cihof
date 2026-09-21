import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import type { Inductee, RelationshipRecord } from '../../data/types';
import { archiveLinkNodes, archiveLinks, publishedRelationshipCounts, type Link, type LinkNode } from './archiveModel';
import { layoutLinks } from './linkLayout';

type Props = {
  people: Inductee[];
  matchingIds: ReadonlySet<string>;
  relationships: RelationshipRecord[];
  relationshipsLoading: boolean;
  relationshipsError: string;
  onRetryRelationships: () => Promise<void>;
  selected: Inductee | undefined;
  query: string;
  setQuery: (value: string) => void;
  activePersonId: string;
  setActivePersonId: (value: string) => void;
  onSelect: (id: string) => void;
  onRecord: (origin?: HTMLElement) => void;
  onPersonRecord: (id: string, origin: HTMLElement) => void;
  portrait: ComponentType<{ person: Inductee; eager?: boolean }>;
};

// Opening the list moves focus into it, but only if focus is still where the
// click left it. Without this the deferred focus lands after anything that moved
// focus in the same frame and pulls it back to the heading, which reads as an
// intermittent failure and is a real trap for anyone operating this by keyboard.
function focusListTitleUnlessMoved(toggle: HTMLElement) {
  window.requestAnimationFrame(() => {
    const active = document.activeElement;
    const untouched = active === toggle || active === document.body || active === document.documentElement || active === null;
    if (untouched) document.getElementById('linkRelationListTitle')?.focus();
  });
}

export function LinksScene({ people, matchingIds, relationships, relationshipsLoading, relationshipsError, onRetryRelationships, selected, query, setQuery, activePersonId, setActivePersonId, onSelect, onRecord, onPersonRecord, portrait: Portrait }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [contextPosition, setContextPosition] = useState({ left: 12, top: 12 });
  const [size, setSize] = useState({ width: 960, height: 760 });
  const [resolved, setResolved] = useState<{ key: string; points: Map<string, { x: number; y: number }> } | null>(null);
  const links = useMemo(() => selected ? archiveLinks(selected, people, relationships) : [], [selected, people, relationships]);
  const nodes = useMemo(() => archiveLinkNodes(links), [links]);
  const nodeSignature = nodes.map((node) => `${node.person.id}:${node.kind}`).join('|');
  const layout = useMemo(() => selected ? layoutLinks(selected.id, nodes, size.width, size.height) : null, [selected, nodes, size]);
  const layoutKey = `${selected?.id ?? ''}:${nodeSignature}:${size.width}:${size.height}`;
  const points = resolved?.key === layoutKey ? resolved.points : layout?.points;
  const counts = useMemo(() => publishedRelationshipCounts(people, relationships), [people, relationships]);
  const matches = useMemo(() => people.filter((person) => matchingIds.has(person.id)), [people, matchingIds]);
  const activeNode = nodes.find((node) => node.person.id === activePersonId);
  const activeLinks = activeNode ? links.filter((link) => link.person.id === activeNode.person.id) : [];
  const previewNodes = useMemo(() => activeNode ? archiveLinkNodes(archiveLinks(activeNode.person, people, relationships)) : [], [activeNode, people, relationships]);
  const previewLayout = useMemo(() => {
    if (!activeNode) return null;
    const next = layoutLinks(activeNode.person.id, previewNodes, size.width, size.height);
    // Offset the decorative preview so shared neighbors do not duplicate live labels.
    const angle = 0.45;
    for (const [id, point] of next.points) {
      const x = point.x - size.width / 2;
      const y = point.y - size.height / 2;
      next.points.set(id, {
        x: Math.max(44, Math.min(size.width - 44, size.width / 2 + x * Math.cos(angle) - y * Math.sin(angle))),
        y: Math.max(44, Math.min(size.height - 44, size.height / 2 + x * Math.sin(angle) + y * Math.cos(angle))),
      });
    }
    return next;
  }, [activeNode, previewNodes, size]);
  const documentedCount = links.filter((link) => link.kind === 'documented').length;
  const contextCount = links.filter((link) => link.kind === 'class').length;

  // Nodes animate `left`/`top` for 650ms, so getBoundingClientRect reports
  // wherever the transition currently has a portrait rather than where it is
  // coming to rest. Placing the preview against those transient rectangles
  // drops it into a gap that closes underneath it, and the panel then
  // swallows the clicks and taps meant for the portrait now beneath it.
  function settledRect(control: HTMLElement) {
    const rect = control.getBoundingClientRect();
    const point = points?.get(control.dataset.personId ?? '');
    const stage = stageRef.current;
    if (!point || !stage) return rect;
    const stageBounds = stage.getBoundingClientRect();
    return new DOMRect(stageBounds.left + point.x - rect.width / 2, stageBounds.top + point.y - rect.height / 2, rect.width, rect.height);
  }

  function positionContext() {
    const viewport = viewportRef.current;
    const button = [...(stageRef.current?.querySelectorAll<HTMLElement>('button[data-person-id]') ?? [])]
      .find((element) => element.dataset.personId === activePersonId);
    if (!viewport || !button) return;
    const bounds = viewport.getBoundingClientRect();
    const anchor = settledRect(button);
    const width = Math.min(320, bounds.width - 24);
    const height = Math.min(260, bounds.height * 0.48);
    const right = anchor.right - bounds.left + 16;
    const left = right + width < bounds.width ? right : anchor.left - bounds.left - width - 16;
    const top = bounds.width < 600
      ? (anchor.bottom - bounds.top + height + 16 < bounds.height ? anchor.bottom - bounds.top + 12 : anchor.top - bounds.top - height - 12)
      : anchor.top - bounds.top;
    const clamp = (x: number, y: number) => ({ left: Math.max(12, Math.min(bounds.width - width - 12, x)), top: Math.max(12, Math.min(bounds.height - height - 12, y)) });
    const preferred = clamp(left, top);
    const candidates = [preferred];
    for (let y = 12; y <= bounds.height - height; y += 32) {
      for (let x = 12; x <= bounds.width - width; x += 32) candidates.push(clamp(x, y));
    }
    const controls = [...stageRef.current!.querySelectorAll<HTMLButtonElement>('button[data-person-id]')];
    const rectangles = controls.map((control) => ({ rect: settledRect(control), active: control === button }));
    const score = (candidate: typeof preferred) => rectangles.reduce((total, { rect, active }) => {
      const overlapX = Math.max(0, Math.min(candidate.left + width, rect.right - bounds.left + 8) - Math.max(candidate.left, rect.left - bounds.left - 8));
      const overlapY = Math.max(0, Math.min(candidate.top + height, rect.bottom - bounds.top + 8) - Math.max(candidate.top, rect.top - bounds.top - 8));
      return total + overlapX * overlapY * (active ? 100 : 1);
    }, Math.hypot(candidate.left - preferred.left, candidate.top - preferred.top) * 0.01);
    setContextPosition(candidates.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best));
  }

  useLayoutEffect(positionContext, [activePersonId, size, resolved, listOpen]);

  // Placement is only as good as the geometry it was computed against, and the
  // constellation keeps moving after a portrait is chosen: nodes ease into place
  // over 650ms, and late portraits and web fonts resize them again. Re-place the
  // preview once the movement stops, so it cannot be stranded on top of a
  // portrait and swallow the taps meant for it.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !activePersonId) return;
    let frame = 0;
    const settle = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(positionContext);
    };
    stage.addEventListener('transitionend', settle);
    return () => { stage.removeEventListener('transitionend', settle); window.cancelAnimationFrame(frame); };
  });

  function dismissContext() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('#linkConnectionDetail')) {
      const origin = [...(stageRef.current?.querySelectorAll<HTMLButtonElement>('button[data-person-id]') ?? [])]
        .find((element) => element.dataset.personId === activePersonId);
      origin?.focus({ preventScroll: true });
    }
    setActivePersonId('');
  }

  function previewFromList(id: string) {
    setActivePersonId(id);
    setListOpen(false);
    window.requestAnimationFrame(() => {
      const button = [...(stageRef.current?.querySelectorAll<HTMLButtonElement>('button[data-person-id]') ?? [])].find((element) => element.dataset.personId === id);
      button?.focus();
    });
  }

  useEffect(() => {
    if (activePersonId && !nodes.some((node) => node.person.id === activePersonId)) setActivePersonId('');
  }, [activePersonId, nodes, setActivePersonId]);

  useEffect(() => {
    if (!selected || !stageRef.current || !viewportRef.current) return;
    const stage = stageRef.current;
    const viewport = viewportRef.current;
    const update = () => {
      setSize({ width: stage.clientWidth, height: stage.clientHeight });
      viewport.scrollLeft = Math.max(0, (stage.clientWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (stage.clientHeight - viewport.clientHeight) / 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(viewport);
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
    const ids = [...next.keys()].filter((id) => boxes.has(id));
    const keepInside = (id: string) => {
      const point = next.get(id);
      const box = boxes.get(id);
      if (!point || !box) return;
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
        keepInside(ids[i]);
        keepInside(ids[j]);
        if ((aBox.width + bBox.width) / 2 + 6 - Math.abs(a.x - b.x) <= 0) continue;
        const directionY = a.y <= b.y ? -1 : 1;
        a.y += directionY * overlapY * aShare;
        b.y -= directionY * overlapY * (1 - aShare);
        keepInside(ids[i]);
        keepInside(ids[j]);
      }
      if (!collisions) break;
    }
    setResolved({ key: layoutKey, points: next });
  }, [layout, layoutKey, selected]);

  if (!selected) return <section className="link-index" aria-label="Relationship index">
    <header className="link-index__header">
      <strong>RELATIONSHIP INDEX</strong>
      <span>CHOOSE A PERSON: DOCUMENTED LINKS + SHARED INDUCTION YEAR</span>
      <label><input type="search" aria-label="Find a person in the relationship index" placeholder="Find a person" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </header>
    {relationshipsLoading && <p className="link-index__status" role="status">LOADING DOCUMENTED CONNECTIONS</p>}
    {relationshipsError && <div className="link-index__status is-error" role="alert"><span>{relationshipsError}</span><button type="button" onClick={() => void onRetryRelationships()}>RETRY</button></div>}
    <div className="link-index__grid">{matches.map((person) => {
      const count = counts.get(person.id) ?? 0;
      return <button key={person.id} className="link-index__person" type="button"
        aria-label={`Explore links for ${person.name}, ${inductionLabel(person)}, ${count} documented ${count === 1 ? 'relationship' : 'relationships'}`} onClick={() => onSelect(person.id)}>
        <strong>{person.name}</strong><span>{inductionLabel(person)}</span><small>{count} DOCUMENTED {count === 1 ? 'RELATIONSHIP' : 'RELATIONSHIPS'}</small>
      </button>;
    })}
      {!matches.length && <p className="empty">NO MATCHING PEOPLE</p>}</div>
  </section>;

  const center = points?.get(selected.id);
  return <section className="link-map" aria-label={`Cleveland constellation centered on ${selected.name}`}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); if (listOpen) { setListOpen(false); document.getElementById('connectionListToggle')?.focus(); } else dismissContext(); } }}>
    <header className="link-map__header">
      <div className="link-map__title"><strong>CLEVELAND CONSTELLATION</strong><span>{selected.name} AT THE CENTER</span></div>
      <button id="connectionListToggle" type="button" className="link-map__list-link" aria-expanded={listOpen} aria-controls="connectionList"
        onClick={(event) => { const toggle = event.currentTarget; setListOpen(!listOpen); if (!listOpen) focusListTitleUnlessMoved(toggle); }}>Connection list</button>
      <div className="link-map__legend">
        <span className="link-map__legend-item link-map__legend-item--documented" title="Solid lines mark separately approved relationship records">{documentedCount} DOCUMENTED {documentedCount === 1 ? 'RELATIONSHIP' : 'RELATIONSHIPS'}</span>
        <span className="link-map__legend-item link-map__legend-item--class" title="Dashed lines show shared induction-year context, not a personal relationship">{contextCount} HONORED IN THE SAME YEAR</span>
      </div>
    </header>
    <div className="link-map__body">
      <div className="link-map__viewport" ref={viewportRef} tabIndex={0} onScroll={positionContext} style={{ visibility: listOpen ? 'hidden' : undefined }}
        onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) dismissContext(); }}
        aria-label="Linked portrait field. Scroll to explore; use a portrait to show its connection details.">
        <div className="link-map__stage" ref={stageRef} style={{ '--map-scale': layout?.scale ?? 1 } as CSSProperties}>
          {activeNode && previewLayout && <div className="link-map__preview" aria-hidden="true">
            <svg className="link-map__edges">{previewNodes.map((node) => {
              const origin = previewLayout.points.get(activeNode.person.id)!;
              const point = previewLayout.points.get(node.person.id)!;
              return <line key={node.person.id} className={`map-edge map-edge--${node.kind}`} x1={origin.x} y1={origin.y} x2={point.x} y2={point.y} />;
            })}</svg>
            {[activeNode.person, ...previewNodes.map((node) => node.person)].map((person) => {
              const point = previewLayout.points.get(person.id)!;
              return <div key={person.id} className="network-preview-person" data-person-id={person.id} style={{ left: point.x, top: point.y }}><Portrait person={person} /></div>;
            })}
          </div>}
          <svg className="link-map__edges" aria-hidden="true">{center && nodes.map((node) => {
            const point = points?.get(node.person.id);
            return point && <line key={node.person.id} className={`map-edge map-edge--${node.kind}`} x1={center.x} y1={center.y} x2={point.x} y2={point.y} />;
          })}</svg>
          <div className="link-map__nodes">
            <button id="mapCenterButton" className="map-node map-node--center" type="button" data-person-id={selected.id}
              style={{ left: center?.x ?? size.width / 2, top: center?.y ?? size.height / 2 }}
              aria-label={`Open full record for ${selected.name}`} onClick={(event) => onRecord(event.currentTarget)}>
              <Portrait person={selected} eager />
              <span className="map-node__caption"><strong>{selected.name}</strong><small>READ RECORD</small></span>
            </button>
            {nodes.map((node) => {
              const point = points?.get(node.person.id);
              const active = activePersonId === node.person.id;
              return <button key={node.person.id} className={`map-node map-node--${node.kind}${active ? ' is-active' : ''}`} type="button"
                data-person-id={node.person.id} style={{ left: point?.x ?? size.width / 2, top: point?.y ?? size.height / 2 }}
                aria-pressed={active} aria-controls="linkConnectionDetail"
                aria-label={active ? `Center connections on ${node.person.name}` : nodeAriaLabel(node)}
                onClick={() => active ? onSelect(node.person.id) : setActivePersonId(node.person.id)}>
                <Portrait person={node.person} />
                <span className="map-node__caption"><strong>{node.person.name}</strong><small>{active ? 'CENTER CONNECTIONS' : nodeCaption(node)}</small></span>
              </button>;
            })}
          </div>
        </div>
      </div>
        <section className="link-connection-detail" id="linkConnectionDetail" aria-live="polite" hidden={!activeNode || listOpen} style={contextPosition}>
          <button className="link-context-close" type="button" aria-label="Dismiss connection preview" onClick={dismissContext}>×</button>
          <span className="link-connection-detail__kicker">CONNECTION PREVIEW</span>
          {activeNode && <>
            <h2>{activeNode.person.name}</h2>
            <div className="link-connection-detail__facts">{activeLinks.map((link) => <RelationText key={link.id} link={link} compact />)}</div>
            <div className="link-connection-detail__actions">
              <button type="button" onClick={() => onSelect(activeNode.person.id)}>CENTER ON {activeNode.person.name}</button>
              <button id={`link-active-record-${domId(activeNode.person.id)}`} type="button" onClick={(event) => onPersonRecord(activeNode.person.id, event.currentTarget)}>READ RECORD</button>
            </div>
          </>}
        </section>
        <section id="connectionList" className="link-relation-list" hidden={!listOpen} aria-labelledby="linkRelationListTitle">
          <header><h2 id="linkRelationListTitle" tabIndex={-1}>ALL CONNECTIONS</h2><span>{links.length}</span></header>
          {relationshipsLoading && <p className="link-relation-list__status" role="status">LOADING DOCUMENTED CONNECTIONS</p>}
          {relationshipsError && <div className="link-relation-list__status is-error" role="alert"><span>{relationshipsError}</span><button type="button" onClick={() => void onRetryRelationships()}>RETRY</button></div>}
          {!relationshipsLoading && !relationshipsError && documentedCount === 0 && <p className="link-relation-list__status">NO APPROVED DOCUMENTED RELATIONSHIPS. SHARED INDUCTION-YEAR CONTEXT IS SHOWN SEPARATELY.</p>}
          {!links.length && !relationshipsLoading && <p className="link-relation-list__status">NO DOCUMENTED CONNECTIONS OR SHARED INDUCTION-YEAR CONTEXT.</p>}
          <ol>{links.map((link) => <li key={link.id} className={activePersonId === link.person.id ? 'is-active' : undefined}>
            <button className="link-relation-list__select" type="button" aria-pressed={activePersonId === link.person.id} onClick={() => previewFromList(link.person.id)}>
              <strong>{link.person.name}</strong><span>{link.label}</span>
            </button>
            <RelationText link={link} />
            <div className="link-relation-list__actions">
              <button type="button" onClick={() => { setListOpen(false); onSelect(link.person.id); }}>CENTER</button>
              <button id={`link-record-${domId(link.id)}`} type="button" onClick={(event) => onPersonRecord(link.person.id, event.currentTarget)}>READ RECORD</button>
            </div>
          </li>)}</ol>
        </section>
      {!listOpen && relationshipsLoading && <p className="link-map__notice" role="status">LOADING DOCUMENTED CONNECTIONS</p>}
      {!listOpen && relationshipsError && <div className="link-map__notice" role="alert">{relationshipsError}<button type="button" onClick={() => void onRetryRelationships()}>RETRY</button></div>}
      {!listOpen && !relationshipsLoading && !relationshipsError && !links.length && <p className="link-map__notice">NO DOCUMENTED CONNECTIONS OR SHARED INDUCTION-YEAR CONTEXT.</p>}
    </div>
  </section>;
}

function RelationText({ link, compact = false }: { link: Link; compact?: boolean }) {
  return <div className={`link-relation-text link-relation-text--${link.kind}`}>
    <div><span>{link.label}</span><small>{directionLabel(link)}</small></div>
    <p>{link.context}</p>
    {compact ? <details><summary>Source</summary><dl><dt>SOURCE</dt><dd>{link.source}</dd><dt>STATUS</dt><dd>{provenanceLabel(link)}</dd></dl></details>
      : <dl><dt>SOURCE</dt><dd>{link.source}</dd><dt>STATUS</dt><dd>{provenanceLabel(link)}</dd></dl>}
  </div>;
}

function nodeAriaLabel(node: LinkNode) {
  const parts = [`Show connection details for ${node.person.name}`];
  if (node.documentedCount) parts.push(`${node.documentedCount} documented ${node.documentedCount === 1 ? 'relationship' : 'relationships'}`);
  if (node.contextCount) parts.push('honored in the same year');
  return parts.join('. ');
}

function nodeCaption(node: LinkNode) {
  if (node.documentedCount && node.contextCount) return `${node.documentedCount} DOCUMENTED + SAME YEAR`;
  if (node.documentedCount) return `${node.documentedCount} DOCUMENTED`;
  return 'HONORED IN THE SAME YEAR';
}

function directionLabel(link: Link) {
  if (link.direction === 'forward') return 'FROM CENTER RECORD';
  if (link.direction === 'reverse') return 'TO CENTER RECORD';
  return 'SHARED CONTEXT';
}

function provenanceLabel(link: Link) {
  if (link.provenance === 'documented') return 'DOCUMENTED SOURCE';
  if (link.provenance === 'curated') return 'CURATOR-APPROVED';
  return 'INDUCTION RECORDS';
}

function inductionLabel(person: Inductee) {
  return person.classYear === null ? 'INDUCTION YEAR NOT RECORDED' : `CLASS OF ${person.classYear}`;
}

function domId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}
