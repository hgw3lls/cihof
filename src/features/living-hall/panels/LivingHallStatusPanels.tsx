import type { CSSProperties } from 'react';
import { FallbackImage, initials } from '../../../components/FallbackImage';
import { PortraitFrame } from '../../../components/PortraitFrame';
import type { HallLens, Inductee } from '../../../data/types';
import { fallbackPosition, portraitStyle } from '../livingHallLayout';
import type { LatestClassFrame } from '../livingHallRuntime';
import type { LegacyJumpTarget } from '../useLegacyTimelineNavigation';
import {
  legacyGroupForYear,
  traceChooserOptions,
  type HallMode,
  type LatestClass,
  type LegacyChronology,
  type LegacyYearGroup,
  type TraceContext,
} from '../livingHallModes';

export function LensStatusRail({
  activeLegacyGroup,
  activeLegacyYear,
  activeMode,
  allPeopleCount,
  focusedPerson,
  latestClass,
  legacyChronology,
  lens,
  people,
  traceContext,
  traceTrailIds,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  activeMode: HallMode;
  allPeopleCount: number;
  focusedPerson: Inductee | null;
  latestClass: LatestClass | null;
  legacyChronology: LegacyChronology;
  lens: HallLens;
  people: Inductee[];
  traceContext: TraceContext;
  traceTrailIds: string[];
}) {
  const items = lensStatusItems({
    activeLegacyGroup,
    activeLegacyYear,
    activeMode,
    allPeopleCount,
    focusedPerson,
    latestClass,
    legacyChronology,
    lens,
    people,
    traceContext,
    traceTrailIds,
  });

  if (items.length === 0) return null;

  return (
    <aside className="living-hall__statusRail" aria-label="Hall category status" data-status-lens={lens}>
      {items.map((item) => (
        <span className="living-hall__statusMetric" key={`${item.label}-${item.value}`}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </span>
      ))}
    </aside>
  );
}

type LensStatusItem = {
  label: string;
  value: string;
};

function lensStatusItems({
  activeLegacyGroup,
  activeLegacyYear,
  activeMode,
  allPeopleCount,
  focusedPerson,
  latestClass,
  legacyChronology,
  lens,
  people,
  traceContext,
  traceTrailIds,
}: {
  activeLegacyGroup: LegacyYearGroup | null;
  activeLegacyYear: number | null;
  activeMode: HallMode;
  allPeopleCount: number;
  focusedPerson: Inductee | null;
  latestClass: LatestClass | null;
  legacyChronology: LegacyChronology;
  lens: HallLens;
  people: Inductee[];
  traceContext: TraceContext;
  traceTrailIds: string[];
}): LensStatusItem[] {
  if (lens === 'traces') {
    if (!traceContext.activePerson) {
      return [
        { label: 'Records', value: String(allPeopleCount) },
        { label: 'Concepts', value: String(traceContext.conceptChoices.length) },
        { label: 'Nationalities', value: String(traceContext.placeChoices.length) },
      ];
    }

    return [
      { label: 'Direct', value: String(traceContext.directThreads.length) },
      { label: 'Shown', value: String(traceContext.visibleThreads.length) },
      { label: 'Modes', value: String(traceChooserOptions(traceContext).length) },
      { label: 'Path', value: String(traceTrailIds.length) },
    ];
  }

  if (lens === 'legacies') {
    const activeIndex = activeLegacyYear === null ? -1 : legacyChronology.years.indexOf(activeLegacyYear);
    return [
      { label: 'Class', value: activeLegacyYear ? String(activeLegacyYear) : 'Open' },
      { label: 'People', value: String(activeLegacyGroup?.people.length ?? 0) },
      { label: 'Index', value: activeIndex >= 0 ? `${activeIndex + 1}/${legacyChronology.years.length}` : String(legacyChronology.years.length) },
      { label: 'Range', value: legacyChronology.firstYear && legacyChronology.lastYear ? `${legacyChronology.firstYear}-${legacyChronology.lastYear}` : 'CIHOF' },
    ];
  }

  const emphasizedCount = [...activeMode.positions.values()].filter((position) => position.emphasis && !position.focused).length;
  if (lens === 'journeys') {
    return [
      { label: 'Routes', value: String(Math.max(activeMode.labels.length, 1)) },
      { label: 'Stops', value: String(emphasizedCount) },
      { label: 'Lines', value: String(activeMode.lines?.length ?? 0) },
    ];
  }

  const featuredCount = people.filter((person) => person.featured || person.featuredCandidate).length;
  if (focusedPerson) {
    return [
      { label: 'Focus', value: focusedPerson.classYear ? String(focusedPerson.classYear) : 'Open' },
      { label: 'Nearby', value: String(emphasizedCount) },
      { label: 'Records', value: `${people.length}/${allPeopleCount}` },
    ];
  }

  return [
    { label: 'Records', value: `${people.length}/${allPeopleCount}` },
    { label: 'Featured', value: String(featuredCount) },
    { label: 'Latest', value: latestClass ? String(latestClass.year) : 'Open' },
  ];
}

export function LegacyControls({
  activeYear,
  chronology,
  onJump,
  onSelectPerson,
}: {
  activeYear: number | null;
  chronology: LegacyChronology;
  onJump: (direction: LegacyJumpTarget) => void;
  onSelectPerson: (inductee: Inductee) => void;
}) {
  if (chronology.years.length === 0) return null;
  const activeIndex = activeYear === null ? 0 : Math.max(chronology.years.indexOf(activeYear), 0);
  const activeLabel = activeYear === null ? `${chronology.firstYear ?? ''}` : String(activeYear);
  const activeGroup = legacyGroupForYear(chronology, activeYear);
  const activePeople = activeGroup?.people ?? [];
  const visibleClassPeople = activePeople.slice(0, 3);
  const hiddenClassPeople = Math.max(0, activePeople.length - visibleClassPeople.length);
  const range = chronology.firstYear && chronology.lastYear
    ? `${chronology.firstYear} - ${chronology.lastYear}`
    : 'Class chronology';
  const classPosition = activeIndex >= 0 ? `${activeIndex + 1} of ${chronology.years.length}` : String(chronology.years.length);

  return (
    <nav className="living-hall__legacyControls" aria-label="Chronology controls">
      <button
        className="living-hall__legacyControl living-hall__legacyControl--jump living-hall__legacyControl--first"
        type="button"
        aria-label="Go to earliest induction class"
        disabled={activeIndex <= 0}
        onClick={() => onJump('first')}
      >
        First
      </button>
      <button
        className="living-hall__legacyControl living-hall__legacyControl--edge living-hall__legacyControl--previous"
        type="button"
        aria-label="Move to previous induction class"
        disabled={activeIndex <= 0}
        onClick={() => onJump(-1)}
      >
        <span aria-hidden="true">Previous</span>
      </button>
      <div className="living-hall__legacyTrack" aria-label="Induction class years">
        {chronology.groups.filter((group) => group.year !== null).map((group) => {
          const active = group.year === activeYear;
          return (
            <button
              aria-label={`Class of ${group.year}, ${group.people.length} ${group.people.length === 1 ? 'inductee' : 'inductees'}`}
              aria-pressed={active}
              className={active ? 'living-hall__legacyYear living-hall__legacyYear--active' : 'living-hall__legacyYear'}
              key={group.key}
              style={{ '--legacy-class-size': String(group.people.length) } as CSSProperties & Record<string, string>}
              type="button"
              onClick={() => {
                if (group.year !== null) onJump(group.year);
              }}
            >
              <span>{group.label}</span>
            </button>
          );
        })}
      </div>
      <span className="living-hall__legacyReadout" aria-live="polite">
        <small>Class Of</small>
        <strong>{activeLabel}</strong>
        <em>{range}</em>
      </span>
      {activeGroup && (
        <section className="living-hall__legacyClassShelf" aria-label={`${activeGroup.label} cohort browser`}>
          <header className="living-hall__legacyClassShelfHeader">
            <span>Class Browser</span>
            <strong>{activeGroup.label}</strong>
            <small>{activePeople.length} {activePeople.length === 1 ? 'portrait' : 'portraits'} / {classPosition}</small>
          </header>
          <ol className="living-hall__legacyClassRoster" aria-label={`${activeGroup.label} inductees`}>
            {visibleClassPeople.map((person, index) => (
              <li key={person.id}>
                <button
                  className="living-hall__legacyClassPerson"
                  type="button"
                  aria-label={`Focus ${person.name}, ${activeGroup.label}`}
                  data-legacy-person={person.id}
                  onClick={() => onSelectPerson(person)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{person.name}</strong>
                </button>
              </li>
            ))}
            {hiddenClassPeople > 0 && (
              <li aria-hidden="true">
                <span className="living-hall__legacyClassMore">+{hiddenClassPeople}</span>
              </li>
            )}
          </ol>
        </section>
      )}
      <button
        className="living-hall__legacyControl living-hall__legacyControl--edge living-hall__legacyControl--next"
        type="button"
        aria-label="Move to next induction class"
        disabled={activeIndex >= chronology.years.length - 1}
        onClick={() => onJump(1)}
      >
        <span aria-hidden="true">Next</span>
      </button>
      <button
        className="living-hall__legacyControl living-hall__legacyControl--jump living-hall__legacyControl--latest"
        type="button"
        aria-label="Go to latest induction class"
        disabled={activeIndex >= chronology.years.length - 1}
        onClick={() => onJump('last')}
      >
        Latest
      </button>
    </nav>
  );
}

export function LatestClassSequence({
  frame,
  latestClass,
  reducedMotion,
  onSelect,
}: {
  frame: LatestClassFrame;
  latestClass: LatestClass;
  reducedMotion: boolean;
  onSelect: (inductee: Inductee) => void;
}) {
  const className = [
    'latest-class-sequence',
    `latest-class-sequence--${frame.kind}`,
    reducedMotion ? 'latest-class-sequence--reduced-motion' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={className} aria-label={`Latest induction class, Class of ${latestClass.year}`}>
      <div className="latest-class-sequence__frame" key={frame.key}>
        {frame.kind === 'intro' && (
          <div className="latest-class-sequence__intro">
            <p>Latest Class</p>
            <h3>Class Of {latestClass.year}</h3>
          </div>
        )}

        {frame.kind === 'person' && (
          <div className="latest-class-sequence__person">
            <button
              type="button"
              aria-label={`Open ${frame.inductee.name}, Class of ${latestClass.year}`}
              data-transition-person={frame.inductee.id}
              data-transition-role="living-portrait"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelect(frame.inductee)}
            >
              <FallbackImage
                alt={frame.inductee.imageAltText || frame.inductee.name}
                className="latest-class-sequence__portrait"
                fallbackClassName="latest-class-sequence__fallback"
                fallbackLabel={initials(frame.inductee.name)}
                loading="eager"
                src={frame.inductee.primaryImageUrl}
              />
            </button>
            <div>
              <p>{String(frame.index + 1).padStart(2, '0')} / {String(latestClass.inductees.length).padStart(2, '0')}</p>
              <h3>{frame.inductee.name}</h3>
              <span>Class Of {latestClass.year}</span>
            </div>
          </div>
        )}

        {frame.kind === 'group' && (
          <div className="latest-class-sequence__group">
            <div>
              <p>Latest Class</p>
              <h3>{latestClass.year}</h3>
            </div>
            <div className="latest-class-sequence__grid">
              {latestClass.inductees.map((inductee) => (
                <button
                  key={inductee.id}
                  type="button"
                  aria-label={`Open ${inductee.name}, Class of ${latestClass.year}`}
                  data-transition-person={inductee.id}
                  data-transition-role="living-portrait"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(inductee)}
                >
                  <FallbackImage
                    alt={inductee.imageAltText || inductee.name}
                    className="latest-class-sequence__gridImage"
                    fallbackClassName="latest-class-sequence__gridFallback"
                    fallbackLabel={initials(inductee.name)}
                    loading="eager"
                    src={inductee.primaryImageUrl}
                  />
                  <span>{inductee.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {frame.kind === 'finale' && (
          <div className="latest-class-sequence__finale">
            <p>Class Of {latestClass.year}</p>
            <strong>{latestClass.stats.people} {latestClass.stats.people === 1 ? 'Person' : 'People'}</strong>
            <strong>{latestClass.stats.stories} {latestClass.stats.stories === 1 ? 'Story' : 'Stories'}</strong>
            <strong>{latestClass.stats.cities} {latestClass.stats.cities === 1 ? 'City' : 'Cities'}</strong>
          </div>
        )}
      </div>
    </aside>
  );
}

export function LivingHallPlaceholders() {
  return (
    <>
      {Array.from({ length: 32 }, (_, index) => {
        const position = fallbackPosition(index, 32);
        return (
          <span className="living-portrait living-portrait--placeholder" key={index} style={portraitStyle(position)}>
            <PortraitFrame
              name="CIHOF"
              classYear={null}
              imageUrl=""
              imageAltText=""
              fallbackLabel="CIHOF"
              state="standard"
              aspect="tall"
              showRecord={false}
            />
          </span>
        );
      })}
    </>
  );
}
