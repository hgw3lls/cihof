import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { rankStoryLensMatches, useStoryLenses, type StoryLensMatch } from '../../data/storyLenses';
import {
  buildConceptNetwork as buildSharedConceptNetwork,
  buildConceptThreads as buildSharedConceptThreads,
  buildHumanNetwork as buildSharedHumanNetwork,
  mostConnectedPerson as sharedMostConnectedPerson,
} from '../../data/traceModel';
import type { Inductee, RelationshipProvenance, RelationshipRecord, RelationshipType, StoryLensConfig } from '../../data/types';

type ConnectionFinderProps = {
  open: boolean;
  inductees: Inductee[];
  relationships: RelationshipRecord[];
  seedPerson: Inductee | null;
  returnPerson: Inductee | null;
  closeLabel?: string;
  presentation?: 'dialog' | 'scene' | 'hall-panel';
  onClose: () => void;
  onSelectPerson: (inductee: Inductee) => void;
};

type NetworkReason = {
  type: RelationshipType;
  label: string;
  detail: string;
  provenance: RelationshipProvenance;
  score: number;
};

type NetworkThread = {
  person: Inductee;
  reasons: NetworkReason[];
  score: number;
};

type PositionedThread = NetworkThread & {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
};

type ConceptThread = {
  lens: StoryLensConfig;
  activeMatch: StoryLensMatch;
  matches: StoryLensMatch[];
  people: StoryLensMatch[];
  score: number;
};

const initialThreadCount = 5;
const initialConceptThreadCount = 4;
const revealIncrement = 4;
const maxThreadCount = 8;
const maxConceptThreadChoices = 4;
const centerPoint = { x: 50, y: 45 };
const orbitAngles = [-160, -125, -50, 0, 50, 125, -88, -25, 82, 158];

export function ConnectionFinder({
  open,
  inductees,
  relationships,
  seedPerson,
  returnPerson,
  closeLabel = 'Portraits',
  presentation = 'dialog',
  onClose,
  onSelectPerson,
}: ConnectionFinderProps) {
  const { lenses: storyLenses } = useStoryLenses();
  const peopleById = useMemo(() => new Map(inductees.map((item) => [item.id, item])), [inductees]);
  const defaultPerson = useMemo(
    () => seedPerson ?? returnPerson ?? sharedMostConnectedPerson(inductees, relationships) ?? inductees[0] ?? null,
    [inductees, relationships, returnPerson, seedPerson],
  );
  const [activePersonId, setActivePersonId] = useState('');
  const [activeThreadId, setActiveThreadId] = useState('');
  const [revealedCount, setRevealedCount] = useState(initialThreadCount);
  const [threadTrail, setThreadTrail] = useState<Inductee[]>([]);

  const activePerson = activePersonId ? peopleById.get(activePersonId) ?? defaultPerson : defaultPerson;
  const directThreads = useMemo(
    () => activePerson ? buildSharedHumanNetwork(activePerson, inductees, relationships) : [],
    [activePerson, inductees, relationships],
  );
  const allConceptThreads = useMemo(
    () => activePerson ? buildSharedConceptThreads(activePerson, inductees, storyLenses) : [],
    [activePerson, inductees, storyLenses],
  );
  const activeConceptThread = useMemo(
    () => activeThreadId ? allConceptThreads.find((thread) => thread.lens.id === activeThreadId) ?? null : null,
    [activeThreadId, allConceptThreads],
  );
  const conceptThreads = useMemo(
    () => selectConceptThreadChoices(allConceptThreads, activeThreadId),
    [activeThreadId, allConceptThreads],
  );
  const allThreads = useMemo(
    () => activePerson && activeConceptThread
      ? buildSharedConceptNetwork(activePerson, activeConceptThread, directThreads)
      : directThreads,
    [activeConceptThread, activePerson, directThreads],
  );
  const visibleThreads = useMemo(
    () => positionThreads(allThreads.slice(0, Math.min(revealedCount, maxThreadCount))),
    [allThreads, revealedCount],
  );
  const hiddenThreadCount = Math.max(0, Math.min(allThreads.length, maxThreadCount) - visibleThreads.length);
  const followingThread = Boolean(activeConceptThread);

  useEffect(() => {
    if (!open || !defaultPerson) return;
    setActivePersonId(defaultPerson.id);
    setActiveThreadId('');
    setRevealedCount(initialThreadCount);
    setThreadTrail([defaultPerson]);
  }, [defaultPerson, open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  function focusPerson(inductee: Inductee) {
    setActivePersonId(inductee.id);
    setRevealedCount(activeThreadId ? initialConceptThreadCount : initialThreadCount);
    setThreadTrail((current) => appendTrail(current, inductee));
  }

  function followConceptThread(threadId: string) {
    setActiveThreadId(threadId);
    setRevealedCount(initialConceptThreadCount);
  }

  function returnToDirectLinks() {
    setActiveThreadId('');
    setRevealedCount(initialThreadCount);
  }

  function openActiveProfile() {
    if (activePerson) onSelectPerson(activePerson);
  }

  if (!activePerson) {
    return (
      <section
        className={`connection-finder human-network human-network--${presentation}`}
        role={presentation === 'dialog' ? 'dialog' : 'region'}
        aria-modal={presentation === 'dialog' ? 'true' : undefined}
        aria-label="Documented relationships"
      >
        <div className="human-network__empty">
          <p className="museum-kicker">In Common</p>
          <h2>NO PEOPLE LOADED</h2>
          <button type="button" onClick={onClose}>{closeLabel}</button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={[
        'connection-finder human-network',
        `human-network--${presentation}`,
        followingThread ? 'human-network--threading' : '',
      ].filter(Boolean).join(' ')}
      role={presentation === 'dialog' ? 'dialog' : 'region'}
      aria-modal={presentation === 'dialog' ? 'true' : undefined}
      aria-label={`${activePerson.name} documented relationships`}
    >
      <header className="human-network__header">
        <div>
          <p className="museum-kicker">{followingThread ? 'Following The Trace' : 'In Common'}</p>
          <h2>{followingThread ? activeConceptThread?.lens.label ?? 'Follow The Trace' : 'IN COMMON'}</h2>
          <p className="human-network__thesis">
            {followingThread
              ? 'A trace through people, work, communities, and civic memory.'
              : 'What these lives share, and where their work intersects.'}
          </p>
        </div>
        <div className="human-network__headerActions">
          <button type="button" onClick={openActiveProfile}>Open Portrait</button>
          <button type="button" onClick={onClose}>{closeLabel}</button>
        </div>
      </header>

      <div className="human-network__trail" aria-label="Trace path">
        <span>{followingThread ? 'Following' : 'Trace'}</span>
        {threadTrail.slice(-5).map((person, index, people) => (
          <button
            aria-current={person.id === activePerson.id ? 'true' : undefined}
            key={`${person.id}-${index}`}
            type="button"
            onClick={() => focusPerson(person)}
          >
            {person.name}
            {index < people.length - 1 && <em aria-hidden="true">/</em>}
          </button>
        ))}
      </div>

      <main className="human-network__field" aria-label={`${activePerson.name} documented relationships`}>
        <svg className="human-network__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {visibleThreads.map((thread) => (
            <line
              className={`human-network__line human-network__line--${thread.reasons[0]?.provenance ?? 'curated'}${followingThread ? ' human-network__line--thread' : ''}`}
              key={`${activePerson.id}-${activeThreadId || 'direct'}-${thread.person.id}-${thread.reasons[0]?.label ?? 'connection'}`}
              x1={centerPoint.x}
              y1={centerPoint.y}
              x2={thread.x}
              y2={thread.y}
            />
          ))}
        </svg>

        {visibleThreads.map((thread) => (
          <div
            className={`human-network__label human-network__label--${thread.reasons[0]?.provenance ?? 'curated'}`}
            key={`label-${activePerson.id}-${activeThreadId || 'direct'}-${thread.person.id}`}
            style={positionStyle(thread.labelX, thread.labelY)}
          >
            <span>{followingThread ? 'FOLLOW THIS TRACE' : 'IN COMMON'}</span>
            <strong>{followingThread ? activeConceptThread?.lens.label.toUpperCase() ?? 'THIS TRACE' : relationshipLineLabel(thread.reasons[0], activePerson.name)}</strong>
          </div>
        ))}

        <button
          className="human-network__center"
          data-transition-person={activePerson.id}
          data-transition-role="connections-center"
          style={positionStyle(centerPoint.x, centerPoint.y)}
          type="button"
          onClick={openActiveProfile}
        >
          <FallbackImage
            alt={activePerson.imageAltText}
            className="human-network__centerImage"
            fallbackClassName="human-network__centerFallback"
            fallbackLabel={initials(activePerson.name)}
            loading="eager"
            src={activePerson.primaryImageUrl}
          />
          <span>
            <small>{activePerson.classYear ? `Class of ${activePerson.classYear}` : 'Class year unknown'}</small>
            <strong>{activePerson.name}</strong>
          </span>
        </button>

        {visibleThreads.map((thread, index) => (
          <button
            aria-label={`${thread.person.name}. ${thread.reasons.map((reason) => reason.label).join('. ')}`}
            className="human-network__node"
            data-transition-person={thread.person.id}
            data-transition-role="connections-node"
            key={`${activeThreadId || 'direct'}-${thread.person.id}`}
            style={positionStyle(thread.x, thread.y)}
            type="button"
            onClick={() => focusPerson(thread.person)}
          >
            <FallbackImage
              alt={thread.person.imageAltText}
              className="human-network__nodeImage"
              fallbackClassName="human-network__nodeFallback"
              fallbackLabel={initials(thread.person.name)}
              loading={index < 4 ? 'eager' : undefined}
              src={thread.person.primaryImageUrl}
            />
            <span>
              <strong>{thread.person.name}</strong>
              <small>{thread.person.classYear ? `Class of ${thread.person.classYear}` : 'Class year unknown'}</small>
              <em>{followingThread ? 'CONTINUE THE TRACE ->' : 'IN COMMON'}</em>
              <i>
                {followingThread
                  ? nodeReasonLabel(thread.reasons[0], activePerson.name)
                  : relationshipSupportLabel(thread.reasons[0], activePerson.name)}
              </i>
            </span>
          </button>
        ))}

        {visibleThreads.length === 0 && (
          <section className="human-network__noThreads">
            <p className="museum-kicker">No Reviewed Ties Yet</p>
            <h3>{activePerson.name}</h3>
            <span>This portrait needs reviewed relationship data before it can enter the shared field.</span>
          </section>
        )}

        {followingThread && threadTrail.length > 1 && (
          <div className="human-network__journey" aria-label="Trace path">
            {threadTrail.slice(-5).map((person, index, people) => (
              <button
                aria-current={person.id === activePerson.id ? 'true' : undefined}
                className="human-network__journeyStep"
                key={`journey-${person.id}-${index}`}
                style={journeyStyle(index, people.length)}
                type="button"
                onClick={() => focusPerson(person)}
              >
                <FallbackImage
                  alt={person.imageAltText}
                  className="human-network__journeyImage"
                  fallbackClassName="human-network__journeyFallback"
                  fallbackLabel={initials(person.name)}
                  src={person.primaryImageUrl}
                />
                <span>{person.id === activePerson.id ? 'YOU ARE HERE' : person.name}</span>
              </button>
            ))}
          </div>
        )}
      </main>

      {conceptThreads.length > 0 && (
        <section className="human-network__threadChooser" aria-label="Follow the trace">
          <div className="human-network__threadIntro">
            <span>{followingThread ? 'Following This Trace' : 'FOLLOW THE TRACE ->'}</span>
            <strong>{activeConceptThread?.lens.label ?? 'Move through the Hall by trace'}</strong>
            <small>
              {activeConceptThread
                ? 'The portraits reorganize around this idea as you move from one honored life to another.'
                : 'Choose one supported trace. The portraits reorganize around that idea.'}
            </small>
          </div>
          <div className="human-network__threadRail">
            {conceptThreads.map((thread) => (
              <button
                aria-pressed={activeThreadId === thread.lens.id}
                className={activeThreadId === thread.lens.id ? 'human-network__threadButton human-network__threadButton--active' : 'human-network__threadButton'}
                key={thread.lens.id}
                type="button"
                onClick={() => followConceptThread(thread.lens.id)}
              >
                <span>{thread.lens.prompt}</span>
                <strong>{thread.lens.label}</strong>
                <small>{thread.people.length + 1} portraits</small>
              </button>
            ))}
            {followingThread && (
              <button className="human-network__threadReset" type="button" onClick={returnToDirectLinks}>
                Direct Ties
              </button>
            )}
          </div>
        </section>
      )}

      <footer className="human-network__footer">
        <div>
          <span>
            {followingThread
              ? `${activeConceptThread?.lens.label ?? 'Trace'} / ${allThreads.length} ${allThreads.length === 1 ? 'portrait' : 'portraits'}`
              : `${allThreads.length} reviewed ${allThreads.length === 1 ? 'tie' : 'ties'}`}
          </span>
          <span>
            {followingThread
              ? 'Traces use reviewed CIHOF theme data; direct ties remain documented or structured.'
              : 'Only documented, curated, or structured CIHOF ties are shown.'}
          </span>
        </div>
        <div className="human-network__footerActions">
          {hiddenThreadCount > 0 && (
            <button
              className="human-network__revealButton"
              type="button"
              onClick={() => setRevealedCount((count) => Math.min(count + revealIncrement, maxThreadCount))}
            >
              Reveal More Ties
            </button>
          )}
          <button className="human-network__profileButton" type="button" onClick={openActiveProfile}>Open Portrait</button>
        </div>
      </footer>
    </section>
  );
}

function buildConceptThreads(active: Inductee, inductees: Inductee[], lenses: StoryLensConfig[]): ConceptThread[] {
  return lenses
    .filter((lens) => lens.enabled !== false)
    .map((lens) => {
      const matches = rankStoryLensMatches(inductees, lens);
      const activeMatch = matches.find((match) => match.inductee.id === active.id);
      if (!activeMatch) return null;
      const people = matches.filter((match) => match.inductee.id !== active.id);
      if (people.length === 0) return null;

      return {
        lens,
        activeMatch,
        matches,
        people,
        score: activeMatch.score + Math.min(people.length, 24),
      };
    })
    .filter((thread): thread is ConceptThread => Boolean(thread))
    .sort((a, b) => b.score - a.score || a.lens.label.localeCompare(b.lens.label));
}

function selectConceptThreadChoices(threads: ConceptThread[], activeThreadId: string) {
  const selected = activeThreadId ? threads.find((thread) => thread.lens.id === activeThreadId) : undefined;
  if (!selected) return threads.slice(0, maxConceptThreadChoices);
  return [
    selected,
    ...threads.filter((thread) => thread.lens.id !== selected.lens.id).slice(0, maxConceptThreadChoices - 1),
  ];
}

function buildConceptNetwork(active: Inductee, thread: ConceptThread, directThreads: NetworkThread[]): NetworkThread[] {
  const directById = new Map(directThreads.map((item) => [item.person.id, item]));

  return thread.matches
    .filter((match) => match.inductee.id !== active.id)
    .map((match) => {
      const directThread = directById.get(match.inductee.id);
      const storyReason: NetworkReason = {
        type: 'shared_theme',
        label: `${thread.lens.label} / ${conceptSupportLabel(match)}`,
        detail: thread.lens.description,
        provenance: directThread?.reasons[0]?.provenance ?? 'curated',
        score: 92 + Math.min(match.score, 140) + (directThread ? 44 : 0),
      };

      return {
        person: match.inductee,
        reasons: [storyReason, ...(directThread?.reasons ?? []).slice(0, 2)],
        score: storyReason.score + featuredScore(match.inductee),
      };
    })
    .sort((a, b) => {
      const directA = directById.has(a.person.id) ? 1 : 0;
      const directB = directById.has(b.person.id) ? 1 : 0;
      return directB - directA || b.score - a.score || a.person.name.localeCompare(b.person.name);
    });
}

function conceptSupportLabel(match: StoryLensMatch) {
  const reason = match.reasons.find((item) => item !== 'Curator pinned') ?? match.reasons[0];
  if (!reason) return 'CIHOF record';
  return reason.replace(/^(Story|Trace) match:\s*/i, '').trim() || 'CIHOF record';
}

function buildHumanNetwork(active: Inductee, inductees: Inductee[], relationships: RelationshipRecord[]) {
  const peopleById = new Map(inductees.map((item) => [item.id, item]));
  const peopleByName = new Map(inductees.map((item) => [normalizeName(item.name), item]));
  const threads = new Map<string, NetworkThread>();

  function addReason(person: Inductee | undefined, reason: NetworkReason) {
    if (!person || person.id === active.id || reason.provenance === 'inferred') return;
    const current = threads.get(person.id) ?? { person, reasons: [], score: 0 };
    if (!current.reasons.some((item) => item.type === reason.type && item.label === reason.label)) {
      current.reasons.push(reason);
      current.score += reason.score;
    }
    threads.set(person.id, current);
  }

  relationships
    .filter((relationship) => relationship.provenance !== 'inferred')
    .forEach((relationship) => {
      const sourcePerson = peopleById.get(relationship.sourcePersonId);
      const targetPerson = peopleById.get(relationship.targetEntityId);
      if (!sourcePerson) return;

      if (sourcePerson.id === active.id && targetPerson) {
        addReason(targetPerson, relationshipReason(relationship, 120));
      } else if (targetPerson?.id === active.id) {
        addReason(sourcePerson, relationshipReason(relationship, 120));
      }
    });

  relationships
    .filter((relationship) => relationship.provenance !== 'inferred' && !peopleById.has(relationship.targetEntityId))
    .filter((relationship) => relationship.sourcePersonId === active.id)
    .forEach((activeRelationship) => {
      relationships
        .filter((relationship) => relationship.provenance !== 'inferred')
        .filter((relationship) => relationship.targetEntityId === activeRelationship.targetEntityId && relationship.sourcePersonId !== active.id)
        .forEach((relationship) => {
          addReason(peopleById.get(relationship.sourcePersonId), {
        type: activeRelationship.type,
        label: activeRelationship.displayLabel,
        detail: activeRelationship.referenceNote || relationship.referenceNote || 'Shared documented relationship.',
        provenance: strongestProvenance(activeRelationship.provenance, relationship.provenance),
        score: 86,
      });
        });
    });

  const activeInducer = normalizedInductedBy(active);
  const activeInducerPerson = activeInducer ? peopleByName.get(activeInducer) : undefined;
  addReason(activeInducerPerson, {
    type: 'inducted_by',
    label: `Inducted by ${activeInducerPerson?.name ?? active.inductedBy}`,
    detail: 'Induction relationship in the CIHOF record.',
    provenance: 'curated',
    score: 112,
  });

  inductees.forEach((candidate) => {
    if (candidate.id === active.id) return;

    if (normalizedInductedBy(candidate) === normalizeName(active.name)) {
      addReason(candidate, {
        type: 'inducted_by',
        label: `${active.name} inducted ${candidate.name}`,
        detail: 'Induction relationship in the CIHOF record.',
        provenance: 'curated',
        score: 112,
      });
    }

    if (active.classYear && candidate.classYear === active.classYear) {
      addReason(candidate, {
        type: 'same_class',
        label: `Class of ${active.classYear}`,
        detail: 'Inducted in the same CIHOF class.',
        provenance: 'curated',
        score: 56,
      });
    }

    if (active.inductedBy && candidate.inductedBy && normalizedInductedBy(candidate) === activeInducer && candidate.inductedBy !== candidate.name) {
      addReason(candidate, {
        type: 'inducted_by',
        label: `Inducted by ${active.inductedBy}`,
        detail: 'Both records name the same inducer.',
        provenance: 'curated',
        score: 48,
      });
    }

    sharedExplicitValues(active.themeTags, active.themeTagsSource, candidate.themeTags, candidate.themeTagsSource).forEach((theme) => {
      addReason(candidate, {
        type: 'shared_theme',
        label: `Connected through: ${theme}`,
        detail: 'Both records include a reviewed contribution field.',
        provenance: 'curated',
        score: 44,
      });
    });

    sharedExplicitValues(active.countryTags, active.countryTagsSource, candidate.countryTags, candidate.countryTagsSource).forEach((place) => {
      addReason(candidate, {
        type: 'related_place',
        label: `Connected to: ${place}`,
        detail: 'Both records include a reviewed place association.',
        provenance: 'curated',
        score: 34,
      });
    });
  });

  return Array.from(threads.values())
    .map((thread) => ({
      ...thread,
      reasons: thread.reasons.sort((a, b) => b.score - a.score || provenanceRank(a.provenance) - provenanceRank(b.provenance)).slice(0, 3),
      score: thread.score + featuredScore(thread.person),
    }))
    .filter((thread) => thread.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
}

function relationshipReason(relationship: RelationshipRecord, score: number): NetworkReason {
  return {
    type: relationship.type,
    label: relationship.displayLabel,
    detail: relationship.referenceNote || 'Documented CIHOF relationship.',
    provenance: relationship.provenance,
    score,
  };
}

function positionThreads(threads: NetworkThread[]): PositionedThread[] {
  const radiusX = threads.length <= 6 ? 38 : 40;
  const radiusY = threads.length <= 6 ? 27 : 29;

  return threads.map((thread, index) => {
    const angle = orbitAngles[index % orbitAngles.length] * Math.PI / 180;
    const x = clamp(centerPoint.x + Math.cos(angle) * radiusX, 12, 88);
    const y = clamp(centerPoint.y + Math.sin(angle) * radiusY, 16, 70);

    return {
      ...thread,
      x,
      y,
      labelX: centerPoint.x + (x - centerPoint.x) * 0.42,
      labelY: centerPoint.y + (y - centerPoint.y) * 0.42,
    };
  });
}

function mostConnectedPerson(inductees: Inductee[], relationships: RelationshipRecord[]) {
  return inductees
    .map((inductee) => ({ inductee, count: buildHumanNetwork(inductee, inductees, relationships).length }))
    .sort((a, b) => b.count - a.count || featuredScore(b.inductee) - featuredScore(a.inductee) || a.inductee.name.localeCompare(b.inductee.name))[0]?.inductee ?? null;
}

function appendTrail(current: Inductee[], next: Inductee) {
  if (current[current.length - 1]?.id === next.id) return current;
  return [...current.filter((person) => person.id !== next.id), next].slice(-8);
}

function normalizedInductedBy(inductee: Inductee) {
  return inductee.inductedBy ? normalizeName(inductee.inductedBy) : '';
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sharedExplicitValues(activeValues: string[], activeSource: string, candidateValues: string[], candidateSource: string) {
  if (!isExplicitSource(activeSource) || !isExplicitSource(candidateSource)) return [];
  const candidateSet = new Set(candidateValues);
  return activeValues.filter((value) => candidateSet.has(value));
}

function isExplicitSource(source: string) {
  return source === 'curated' || source === 'documented';
}

function strongestProvenance(a: RelationshipProvenance, b: RelationshipProvenance): RelationshipProvenance {
  return provenanceRank(a) <= provenanceRank(b) ? a : b;
}

function provenanceRank(provenance: RelationshipProvenance) {
  if (provenance === 'documented') return 0;
  if (provenance === 'curated') return 1;
  return 2;
}

function featuredScore(inductee: Inductee) {
  return (inductee.featured ? 8 : 0) + (inductee.featuredCandidate ? 5 : 0) + Math.min(inductee.attractPriority, 8);
}

function relationshipTypeLabel(type: RelationshipType) {
  const labels: Record<RelationshipType, string> = {
    inducted_by: 'Induction',
    same_class: 'Class',
    shared_theme: 'Field',
    shared_organization: 'Organization',
    shared_community: 'Community',
    civic_collaboration: 'Civic Work',
    mentor: 'Mentor',
    colleague: 'Colleague',
    family: 'Family',
    related_place: 'Place',
    related_event: 'Event',
  };
  return labels[type];
}

function nodeReasonLabel(reason: NetworkReason, activeName: string) {
  if (reason.type === 'same_class') return reason.label || 'Same CIHOF class';
  if (reason.label.startsWith(`${activeName} inducted `)) return 'Inducted them';
  if (reason.type === 'inducted_by' && reason.label.startsWith('Inducted by ')) return reason.label;
  return reason.label;
}

function relationshipSupportLabel(reason: NetworkReason, activeName: string) {
  const type = relationshipTypeLabel(reason.type);
  const support = nodeReasonLabel(reason, activeName);
  return support.toLowerCase().startsWith(type.toLowerCase()) ? support : `${type} / ${support}`;
}

function relationshipLineLabel(reason: NetworkReason | undefined, activeName: string) {
  if (!reason) return 'Documented connection';
  const label = nodeReasonLabel(reason, activeName);
  if (reason.type === 'same_class') return 'SAME CLASS';
  if (reason.type === 'shared_theme') return label.replace(/^Connected through:\s*/i, '').toUpperCase();
  if (reason.type === 'shared_community') return 'SHARED COMMUNITY';
  if (reason.type === 'shared_organization') return 'SHARED ORGANIZATION';
  if (reason.type === 'civic_collaboration') return 'CIVIC WORK';
  if (reason.type === 'inducted_by') return label.toUpperCase();
  if (reason.type === 'related_place') return label.replace(/^Connected to:\s*/i, '').toUpperCase();
  return label.toUpperCase();
}

function positionStyle(x: number, y: number) {
  return {
    '--network-x': `${x}%`,
    '--network-y': `${y}%`,
  } as CSSProperties;
}

function journeyStyle(index: number, total: number) {
  const progress = total <= 1 ? 0 : index / (total - 1);
  return positionStyle(12 + progress * 28, 82 - Math.sin(progress * Math.PI) * 8);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
