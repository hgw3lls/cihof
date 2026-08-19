import { useEffect, useMemo, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { countryOrRegionLabel } from '../../data/inducteeLabels';
import {
  buildConnectionGraph,
  connectedPeopleForNode,
  findConnectionPath,
  type ConnectionEdge,
  type ConnectionNode,
  type ConnectionPath,
} from '../../data/connectionGraph';
import type { Inductee, RelationshipProvenance, RelationshipRecord, RelationshipType } from '../../data/types';

type ConnectionFinderProps = {
  open: boolean;
  inductees: Inductee[];
  relationships: RelationshipRecord[];
  seedPerson: Inductee | null;
  returnPerson: Inductee | null;
  onClose: () => void;
  onSelectPerson: (inductee: Inductee) => void;
};

type ConnectionStage = 'select-a' | 'select-b' | 'result';

const maxConnectionEdges = 6;

export function ConnectionFinder({
  open,
  inductees,
  relationships,
  seedPerson,
  returnPerson,
  onClose,
  onSelectPerson,
}: ConnectionFinderProps) {
  const graph = useMemo(() => buildConnectionGraph(inductees, relationships), [inductees, relationships]);
  const [stage, setStage] = useState<ConnectionStage>('select-a');
  const [personA, setPersonA] = useState<Inductee | null>(null);
  const [personB, setPersonB] = useState<Inductee | null>(null);
  const [query, setQuery] = useState('');
  const [revealedEdgeCount, setRevealedEdgeCount] = useState(0);
  const [activeNodeId, setActiveNodeId] = useState('');

  const path = useMemo(
    () => personA && personB ? findConnectionPath(graph, personA.id, personB.id, maxConnectionEdges) : null,
    [graph, personA, personB],
  );
  const activeNode = activeNodeId ? graph.nodes.get(activeNodeId) ?? null : null;
  const activeNodePeople = activeNode ? connectedPeopleForNode(graph, activeNode.id) : [];

  useEffect(() => {
    if (!open) return;
    setPersonA(seedPerson);
    setPersonB(null);
    setStage(seedPerson ? 'select-b' : 'select-a');
    setQuery('');
    setActiveNodeId('');
    setRevealedEdgeCount(0);
  }, [open, seedPerson]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (stage !== 'result' || !path) {
      setRevealedEdgeCount(0);
      return undefined;
    }

    setRevealedEdgeCount(0);
    let nextStep = 0;
    const interval = window.setInterval(() => {
      nextStep += 1;
      setRevealedEdgeCount(nextStep);
      if (nextStep >= path.edges.length) window.clearInterval(interval);
    }, 620);

    return () => window.clearInterval(interval);
  }, [path, stage]);

  if (!open) return null;

  function choosePerson(inductee: Inductee) {
    if (stage === 'select-a') {
      setPersonA(inductee);
      setPersonB(null);
      setStage('select-b');
      setQuery('');
      setActiveNodeId('');
      return;
    }

    if (stage === 'select-b') {
      setPersonB(inductee);
      setStage('result');
      setQuery('');
      setActiveNodeId('');
    }
  }

  function changePersonA() {
    setPersonA(null);
    setPersonB(null);
    setStage('select-a');
    setQuery('');
    setActiveNodeId('');
  }

  function changePersonB() {
    setPersonB(null);
    setStage('select-b');
    setQuery('');
    setActiveNodeId('');
  }

  function openPerson(inductee: Inductee) {
    onSelectPerson(inductee);
    onClose();
  }

  function handleNodeTap(node: ConnectionNode) {
    if (node.inductee) {
      openPerson(node.inductee);
      return;
    }

    setActiveNodeId((current) => current === node.id ? '' : node.id);
  }

  const selectedTitle = personA && personB ? `${personA.name} to ${personB.name}` : 'Six Degrees of Cleveland';

  return (
    <section className="connection-finder" role="dialog" aria-modal="true" aria-label="Six Degrees of Cleveland">
      <header className="connection-finder__header">
        <div>
          <p className="museum-kicker">Six Degrees of Cleveland</p>
          <h2>{selectedTitle}</h2>
        </div>
        <div className="connection-finder__controls">
          {returnPerson && (
            <button type="button" onClick={() => openPerson(returnPerson)}>
              Return to {returnPerson.name}
            </button>
          )}
          <button type="button" onClick={onClose}>Back to Wall</button>
        </div>
      </header>

      <div className="connection-finder__progress" aria-label="Connection steps">
        <span className={stage === 'select-a' ? 'connection-finder__step connection-finder__step--active' : 'connection-finder__step'}>Person A</span>
        <span className={stage === 'select-b' ? 'connection-finder__step connection-finder__step--active' : 'connection-finder__step'}>Person B</span>
        <span className={stage === 'result' ? 'connection-finder__step connection-finder__step--active' : 'connection-finder__step'}>Connection</span>
      </div>

      <main className="connection-finder__body">
        {stage !== 'result' && (
          <PersonConnectionPicker
            excludedId={stage === 'select-b' ? personA?.id ?? '' : ''}
            inductees={inductees}
            label={stage === 'select-a' ? 'Select Person A' : 'Select Person B'}
            query={query}
            selectedPerson={stage === 'select-b' ? personA : null}
            onChangePersonA={changePersonA}
            onQueryChange={setQuery}
            onSelect={choosePerson}
          />
        )}

        {stage === 'result' && personA && personB && (
          <ConnectionResult
            activeNode={activeNode}
            activeNodePeople={activeNodePeople}
            path={path}
            personA={personA}
            personB={personB}
            revealedEdgeCount={revealedEdgeCount}
            onChangePersonA={changePersonA}
            onChangePersonB={changePersonB}
            onNodeTap={handleNodeTap}
            onOpenPerson={openPerson}
          />
        )}
      </main>
    </section>
  );
}

function PersonConnectionPicker({
  inductees,
  excludedId,
  label,
  query,
  selectedPerson,
  onChangePersonA,
  onQueryChange,
  onSelect,
}: {
  inductees: Inductee[];
  excludedId: string;
  label: string;
  query: string;
  selectedPerson: Inductee | null;
  onChangePersonA: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (inductee: Inductee) => void;
}) {
  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    return inductees
      .filter((item) => item.id !== excludedId)
      .filter((item) => {
        if (!search) return item.featured || item.featuredCandidate || item.classYear !== null;
        return item.searchText.includes(search) || item.name.toLowerCase().includes(search);
      })
      .sort((a, b) => {
        if (!search) {
          const featuredA = a.featured || a.featuredCandidate ? 0 : 1;
          const featuredB = b.featured || b.featuredCandidate ? 0 : 1;
          if (featuredA !== featuredB) return featuredA - featuredB;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, search ? 30 : 24);
  }, [excludedId, inductees, query]);

  return (
    <section className="connection-picker" aria-label={label}>
      <div className="connection-picker__lead">
        <div>
          <p className="museum-kicker">{label}</p>
          <h3>{selectedPerson ? 'Choose the second portrait' : 'Choose the first portrait'}</h3>
        </div>
        {selectedPerson && (
          <div className="connection-picker__selected">
            <span>Person A</span>
            <strong>{selectedPerson.name}</strong>
            <button type="button" onClick={onChangePersonA}>Change</button>
          </div>
        )}
      </div>

      <label className="connection-picker__search">
        <span>Search</span>
        <input
          value={query}
          type="search"
          placeholder="Name, year, country, region, community, story"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="connection-picker__grid" aria-label="People">
        {results.map((inductee) => (
          <button className="connection-person" key={inductee.id} type="button" onClick={() => onSelect(inductee)}>
            <FallbackImage
              alt={inductee.imageAltText}
              className="connection-person__image"
              fallbackClassName="connection-person__fallback"
              fallbackLabel={initials(inductee.name)}
              src={inductee.primaryImageUrl}
            />
            <span>
              <strong>{inductee.name}</strong>
              <small>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'} / {countryOrRegionLabel(inductee)}</small>
            </span>
          </button>
        ))}
        {results.length === 0 && <div className="connection-picker__empty">No portraits match that search.</div>}
      </div>
    </section>
  );
}

function ConnectionResult({
  activeNode,
  activeNodePeople,
  path,
  personA,
  personB,
  revealedEdgeCount,
  onChangePersonA,
  onChangePersonB,
  onNodeTap,
  onOpenPerson,
}: {
  activeNode: ConnectionNode | null;
  activeNodePeople: Inductee[];
  path: ConnectionPath | null;
  personA: Inductee;
  personB: Inductee;
  revealedEdgeCount: number;
  onChangePersonA: () => void;
  onChangePersonB: () => void;
  onNodeTap: (node: ConnectionNode) => void;
  onOpenPerson: (inductee: Inductee) => void;
}) {
  if (!path) {
    return (
      <section className="connection-result connection-result--empty" aria-label="No documented connection">
        <div className="connection-empty">
          <p className="museum-kicker">Connection</p>
          <h3>WE HAVEN'T DOCUMENTED THE CONNECTION YET</h3>
          <div className="connection-empty__people">
            <PersonPill inductee={personA} onOpenPerson={onOpenPerson} />
            <PersonPill inductee={personB} onOpenPerson={onOpenPerson} />
          </div>
          <div className="connection-result__actions">
            <button type="button" onClick={onChangePersonA}>Change Person A</button>
            <button type="button" onClick={onChangePersonB}>Change Person B</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="connection-result" aria-label="Connection path">
      <div className="connection-result__summary">
        <div>
          <p className="museum-kicker">Connection</p>
          <h3>{path.edges.length} {path.edges.length === 1 ? 'step' : 'steps'}</h3>
        </div>
        <div className="connection-result__actions">
          <button type="button" onClick={onChangePersonA}>Change Person A</button>
          <button type="button" onClick={onChangePersonB}>Change Person B</button>
          <button type="button" onClick={() => onOpenPerson(personA)}>Open {personA.name}</button>
        </div>
      </div>

      <div className="connection-result__stage">
        <div className="connection-path" aria-live="polite">
          {path.nodes.map((node, index) => {
            const visible = index <= revealedEdgeCount;
            if (!visible) return null;
            const edge = path.edges[index];
            const showEdge = edge && index < revealedEdgeCount;

            return (
              <div className="connection-path__pair" key={`${node.id}-${index}`}>
                <ConnectionNodeButton node={node} position={index} total={path.nodes.length} onNodeTap={onNodeTap} />
                {showEdge && <ConnectionEdgeLabel edge={edge} />}
              </div>
            );
          })}
        </div>

        {activeNode && !activeNode.inductee && (
          <aside className="connection-node-panel" aria-label={`${activeNode.label} connections`}>
            <p className="museum-kicker">{nodeKindLabel(activeNode.kind)}</p>
            <h3>{activeNode.label}</h3>
            <div className="connection-node-panel__people">
              {activeNodePeople.map((inductee) => (
                <button key={inductee.id} type="button" onClick={() => onOpenPerson(inductee)}>
                  <FallbackImage
                    alt={inductee.imageAltText}
                    className="connection-node-panel__image"
                    fallbackClassName="connection-node-panel__fallback"
                    fallbackLabel={initials(inductee.name)}
                    src={inductee.primaryImageUrl}
                  />
                  <span>
                    <strong>{inductee.name}</strong>
                    <small>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}</small>
                  </span>
                </button>
              ))}
              {activeNodePeople.length === 0 && <span className="connection-node-panel__empty">No people are attached to this node yet.</span>}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

function ConnectionNodeButton({
  node,
  position,
  total,
  onNodeTap,
}: {
  node: ConnectionNode;
  position: number;
  total: number;
  onNodeTap: (node: ConnectionNode) => void;
}) {
  const role = position === 0 ? 'Start' : position === total - 1 ? 'End' : nodeKindLabel(node.kind);

  return (
    <button className={`connection-node connection-node--${node.kind}`} type="button" onClick={() => onNodeTap(node)}>
      <span className="connection-node__marker">{position + 1}</span>
      {node.inductee ? (
        <FallbackImage
          alt={node.inductee.imageAltText}
          className="connection-node__image"
          fallbackClassName="connection-node__fallback"
          fallbackLabel={initials(node.inductee.name)}
          src={node.inductee.primaryImageUrl}
        />
      ) : (
        <span className="connection-node__entity">{entityInitials(node.label)}</span>
      )}
      <span className="connection-node__label">
        <strong>{node.label}</strong>
        <small>{role}</small>
      </span>
    </button>
  );
}

function ConnectionEdgeLabel({ edge }: { edge: ConnectionEdge }) {
  return (
    <div className={`connection-edge connection-edge--${edge.provenance}`}>
      <span>{edge.label}</span>
      <small>
        {relationshipTypeLabel(edge.type)}
        <em>{provenanceLabel(edge.provenance)}</em>
      </small>
      {edge.referenceNote && <strong>{edge.referenceNote}</strong>}
    </div>
  );
}

function PersonPill({ inductee, onOpenPerson }: { inductee: Inductee; onOpenPerson: (inductee: Inductee) => void }) {
  return (
    <button className="connection-person-pill" type="button" onClick={() => onOpenPerson(inductee)}>
      <FallbackImage
        alt={inductee.imageAltText}
        className="connection-person-pill__image"
        fallbackClassName="connection-person-pill__fallback"
        fallbackLabel={initials(inductee.name)}
        src={inductee.primaryImageUrl}
      />
      <span>
        <strong>{inductee.name}</strong>
        <small>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}</small>
      </span>
    </button>
  );
}

function relationshipTypeLabel(type: RelationshipType) {
  const labels: Record<RelationshipType, string> = {
    inducted_by: 'Inducted by',
    same_class: 'Same class',
    shared_theme: 'Shared theme',
    shared_organization: 'Shared organization',
    shared_community: 'Shared community',
    civic_collaboration: 'Civic collaboration',
    mentor: 'Mentor',
    colleague: 'Colleague',
    family: 'Family',
    related_place: 'Related place',
    related_event: 'Related event',
  };
  return labels[type];
}

function provenanceLabel(provenance: RelationshipProvenance) {
  const labels: Record<RelationshipProvenance, string> = {
    documented: 'Documented',
    curated: 'Curated',
    inferred: 'Inferred',
  };
  return labels[provenance];
}

function nodeKindLabel(kind: ConnectionNode['kind']) {
  const labels: Record<ConnectionNode['kind'], string> = {
    person: 'Person',
    organization: 'Organization',
    place: 'Place',
    community: 'Community',
    event: 'Event',
    theme: 'Theme',
    media: 'Media',
  };
  return labels[kind];
}

function entityInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
