import { useEffect, useMemo, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { countryOrRegionLabel } from '../../data/inducteeLabels';
import { journeys } from '../../data/journeys';
import type { Inductee, PlaceRecord, RelationshipRecord } from '../../data/types';
import { usePlaces } from '../../data/usePlaces';

type AttractViewProps = {
  inductees: Inductee[];
  relationships: RelationshipRecord[];
  onStart: () => void;
  onSelect: (inductee: Inductee) => void;
};

type AttractPhase = 'grid' | 'person' | 'place' | 'connection' | 'journey' | 'interpretation';

type ConnectionStep = {
  inductee: Inductee;
  label: string;
};

const rotateMs = 11_000;
const phases: AttractPhase[] = ['grid', 'person', 'place', 'connection', 'journey', 'interpretation'];
const interpretationLines = [
  'STORIES. MANY CONNECTIONS. ONE CLEVELAND.',
  'TOUCH A PORTRAIT',
  'WHO BUILT THIS CITY?',
  'FOLLOW A CONNECTION',
  'EVERY FRAME HAS A CITY BEHIND IT.',
  'HOW DOES A CITY REMEMBER?',
];

export function AttractView({ inductees, relationships, onStart, onSelect }: AttractViewProps) {
  const { places } = usePlaces();
  const featured = useMemo(() => selectFeatured(inductees), [inductees]);
  const peopleById = useMemo(() => new Map(inductees.map((inductee) => [inductee.id, inductee])), [inductees]);
  const [tick, setTick] = useState(0);
  const phase = phases[tick % phases.length];
  const cycle = Math.floor(tick / phases.length);
  const activePerson = featured[(cycle + tick) % Math.max(featured.length, 1)] ?? inductees[0] ?? null;
  const activePlace = selectPlace(places, cycle);
  const activeJourney = journeys[cycle % journeys.length] ?? journeys[0];
  const gridPeople = rotateItems(featured, cycle * 6).slice(0, 30);
  const connectionChain = useMemo(
    () => buildConnectionChain(inductees, relationships, peopleById, cycle),
    [cycle, inductees, peopleById, relationships],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((current) => current + 1);
    }, rotateMs);

    return () => window.clearInterval(interval);
  }, []);

  function selectVisiblePerson(inductee: Inductee) {
    onSelect(inductee);
  }

  return (
    <section className="attract attract--portrait-wall" aria-label="Kiosk attract screen" onPointerDown={onStart}>
      <div className="attract__ambientGrid" aria-hidden="true">
        {gridPeople.slice(0, 18).map((inductee) => (
          <span key={inductee.id}>{initials(inductee.name)}</span>
        ))}
      </div>

      <button className="attract__start" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onStart}>
        Touch A Portrait
      </button>

      <div className="attract__sequence" aria-live="polite">
        {phase === 'grid' && (
          <PortraitGridPanel people={gridPeople} onSelect={selectVisiblePerson} />
        )}

        {phase === 'person' && activePerson && (
          <FeaturedPersonPanel inductee={activePerson} onSelect={selectVisiblePerson} />
        )}

        {phase === 'place' && activePlace && (
          <PlacePanel place={activePlace} peopleById={peopleById} onSelect={selectVisiblePerson} />
        )}

        {phase === 'connection' && (
          <ConnectionPanel chain={connectionChain} onSelect={selectVisiblePerson} />
        )}

        {phase === 'journey' && activeJourney && (
          <JourneyPromptPanel peopleById={peopleById} journey={activeJourney} onSelect={selectVisiblePerson} />
        )}

        {phase === 'interpretation' && (
          <InterpretationPanel peopleCount={inductees.length} line={interpretationLines[cycle % interpretationLines.length]} />
        )}
      </div>
    </section>
  );
}

function PortraitGridPanel({ people, onSelect }: { people: Inductee[]; onSelect: (inductee: Inductee) => void }) {
  return (
    <section className="attract-panel attract-panel--grid" aria-label="Full portrait grid">
      <div className="attract-panel__heading">
        <p className="museum-kicker">Cleveland International Hall of Fame</p>
        <h2>TOUCH A PORTRAIT</h2>
      </div>
      <div className="attract-wall-grid" aria-label="Featured portrait wall">
        {people.map((inductee) => (
          <AttractPortraitButton inductee={inductee} key={inductee.id} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function FeaturedPersonPanel({ inductee, onSelect }: { inductee: Inductee; onSelect: (inductee: Inductee) => void }) {
  return (
    <section className="attract-panel attract-panel--person" aria-label={`Featured person ${inductee.name}`}>
      <button
        className="attract-featured-person__portrait"
        type="button"
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(inductee);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(inductee);
        }}
      >
        <FallbackImage
          alt={inductee.imageAltText}
          className="attract-featured-person__image"
          fallbackClassName="attract-featured-person__fallback"
          fallbackLabel={initials(inductee.name)}
          loading="eager"
          src={inductee.primaryImageUrl}
        />
      </button>
      <div className="attract-featured-person__story">
        <p className="museum-kicker">Featured Portrait</p>
        <h2>{inductee.name}</h2>
        <div className="attract-panel__facts">
          <span>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}</span>
          {inductee.communityTags[0] && <span>{inductee.communityTags[0]}</span>}
          <span>{countryOrRegionLabel(inductee)}</span>
        </div>
        <p>{inductee.storySummary || summarize(inductee.bioText)}</p>
      </div>
    </section>
  );
}

function PlacePanel({
  place,
  peopleById,
  onSelect,
}: {
  place: PlaceRecord;
  peopleById: Map<string, Inductee>;
  onSelect: (inductee: Inductee) => void;
}) {
  const relatedPeople = (place.related.people ?? [])
    .map((id) => peopleById.get(id))
    .filter((person): person is Inductee => Boolean(person))
    .slice(0, 5);

  return (
    <section className="attract-panel attract-panel--place" aria-label={`Historic place ${place.name}`}>
      <div className="attract-place__map" aria-hidden="true">
        <span style={{ left: `${place.marker.x}%`, top: `${place.marker.y}%` }} />
      </div>
      <div className="attract-place__story">
        <p className="museum-kicker">Historic Place</p>
        <h2>{place.name}</h2>
        <div className="attract-panel__facts">
          {place.neighborhood && <span>{place.neighborhood}</span>}
          {place.dateRange?.label && <span>{place.dateRange.label}</span>}
        </div>
        <p>{place.shortHistory}</p>
        {relatedPeople.length > 0 && (
          <div className="attract-mini-portraits" aria-label="Related people">
            {relatedPeople.map((person) => (
              <AttractPortraitButton compact inductee={person} key={person.id} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ConnectionPanel({ chain, onSelect }: { chain: ConnectionStep[]; onSelect: (inductee: Inductee) => void }) {
  return (
    <section className="attract-panel attract-panel--connection" aria-label="Short connection chain">
      <div className="attract-panel__heading">
        <p className="museum-kicker">Follow A Connection</p>
        <h2>WHO CONNECTS TO WHOM?</h2>
      </div>
      <div className="attract-chain">
        {chain.map((step, index) => (
          <div className="attract-chain__step" key={`${step.inductee.id}-${index}`}>
            <AttractPortraitButton compact inductee={step.inductee} onSelect={onSelect} />
            {index < chain.length - 1 && <span className="attract-chain__reason">{chain[index + 1]?.label ?? 'Connected story'}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function JourneyPromptPanel({
  journey,
  peopleById,
  onSelect,
}: {
  journey: typeof journeys[number];
  peopleById: Map<string, Inductee>;
  onSelect: (inductee: Inductee) => void;
}) {
  const people = journey.items
    .map((item) => peopleById.get(item.inducteeId))
    .filter((person): person is Inductee => Boolean(person))
    .slice(0, 6);

  return (
    <section className="attract-panel attract-panel--journey" aria-label={`Journey prompt ${journey.title}`}>
      <div className="attract-panel__heading">
        <p className="museum-kicker">Journey Prompt</p>
        <h2>{journey.title}</h2>
        <p>{journey.intro}</p>
      </div>
      <div className="attract-mini-portraits attract-mini-portraits--journey" aria-label="Journey portraits">
        {people.map((person) => (
          <AttractPortraitButton compact inductee={person} key={person.id} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function InterpretationPanel({ line, peopleCount }: { line: string; peopleCount: number }) {
  const displayLine = line.startsWith('STORIES') ? `${peopleCount} ${line}` : line;
  return (
    <section className="attract-panel attract-panel--interpretation" aria-label="Interpretive line">
      <p className="museum-kicker">Portrait Wall</p>
      <h2>{displayLine}</h2>
    </section>
  );
}

function AttractPortraitButton({
  compact = false,
  inductee,
  onSelect,
}: {
  compact?: boolean;
  inductee: Inductee;
  onSelect: (inductee: Inductee) => void;
}) {
  return (
    <button
      className={compact ? 'attract-portrait attract-portrait--compact' : 'attract-portrait'}
      type="button"
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(inductee);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(inductee);
      }}
    >
      <span className="attract-portrait__frame">
        <FallbackImage
          alt={inductee.imageAltText}
          className="attract-portrait__image"
          fallbackClassName="attract-portrait__fallback"
          fallbackLabel={initials(inductee.name)}
          loading={compact ? 'lazy' : 'eager'}
          src={inductee.primaryImageUrl}
        />
      </span>
      <span className="attract-portrait__plaque">
        <strong>{inductee.name}</strong>
        <small>{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}</small>
      </span>
    </button>
  );
}

function selectFeatured(inductees: Inductee[]) {
  return [...inductees]
    .filter((item) => item.primaryImageUrl && item.bioText)
    .sort((a, b) => {
      const featuredScore = Number(b.featured) - Number(a.featured);
      if (featuredScore !== 0) return featuredScore;
      const candidateScore = Number(b.featuredCandidate) - Number(a.featuredCandidate);
      if (candidateScore !== 0) return candidateScore;
      const priorityScore = b.attractPriority - a.attractPriority;
      if (priorityScore !== 0) return priorityScore;
      return (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name);
    })
    .slice(0, 48);
}

function selectPlace(places: PlaceRecord[], cycle: number) {
  if (places.length === 0) return null;
  const ranked = [...places].sort((a, b) => (b.related.people?.length ?? 0) - (a.related.people?.length ?? 0) || a.name.localeCompare(b.name));
  return ranked[cycle % ranked.length];
}

function buildConnectionChain(
  inductees: Inductee[],
  relationships: RelationshipRecord[],
  peopleById: Map<string, Inductee>,
  cycle: number,
): ConnectionStep[] {
  const documented = relationships
    .filter((relationship) => peopleById.has(relationship.sourcePersonId) && peopleById.has(relationship.targetEntityId))
    .sort((a, b) => provenanceRank(a.provenance) - provenanceRank(b.provenance));

  const startRelationship = documented[cycle % documented.length];
  if (startRelationship) {
    const first = peopleById.get(startRelationship.sourcePersonId);
    const second = peopleById.get(startRelationship.targetEntityId);
    if (first && second) {
      const nextRelationship = documented.find((relationship) => relationship.sourcePersonId === second.id && relationship.targetEntityId !== first.id);
      const third = nextRelationship ? peopleById.get(nextRelationship.targetEntityId) : null;
      return [
        { inductee: first, label: 'Start here' },
        { inductee: second, label: startRelationship.displayLabel },
        ...(third ? [{ inductee: third, label: nextRelationship?.displayLabel ?? 'Connected story' }] : []),
      ];
    }
  }

  const start = inductees.find((item, index) => item.relatedIds.length > 0 && index >= cycle) ?? inductees.find((item) => item.relatedIds.length > 0);
  if (!start) return selectFeatured(inductees).slice(0, 3).map((inductee) => ({ inductee, label: 'Portrait wall connection' }));

  const chain = [start];
  start.relatedIds.forEach((id) => {
    const related = peopleById.get(id);
    if (related && chain.length < 4 && !chain.some((item) => item.id === related.id)) chain.push(related);
  });

  return chain.map((inductee, index) => ({
    inductee,
    label: index === 0 ? 'Start here' : sharedReason(chain[index - 1], inductee),
  }));
}

function sharedReason(a: Inductee, b: Inductee) {
  const community = a.communityTags.find((tag) => b.communityTags.includes(tag));
  if (community) return `Shared community: ${community}`;
  const theme = a.themeTags.find((tag) => b.themeTags.includes(tag));
  if (theme) return `Shared theme: ${theme}`;
  if (a.classYear && a.classYear === b.classYear) return `Same class: ${a.classYear}`;
  return 'Related portrait wall path';
}

function rotateItems<T>(items: T[], offset: number) {
  if (items.length === 0) return [];
  return [...items.slice(offset % items.length), ...items.slice(0, offset % items.length)];
}

function provenanceRank(provenance: RelationshipRecord['provenance']) {
  if (provenance === 'documented') return 0;
  if (provenance === 'curated') return 1;
  return 2;
}

function summarize(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  const summary = sentences.slice(0, 2).join(' ').trim() || text;
  if (summary.length <= 280) return summary;
  return `${summary.slice(0, 280).trim()}...`;
}
