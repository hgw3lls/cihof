import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { journeys, type Journey } from '../../data/journeys';
import type { Inductee } from '../../data/types';

type JourneyViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

type ResolvedPerson = {
  inductee: Inductee;
  label: string;
  transition: string;
};

type JourneyStats = {
  yearRange: string;
  regionCount: number;
  videoCount: number;
};

type ResolvedJourney = Journey & {
  people: ResolvedPerson[];
  stats: JourneyStats;
};

export function JourneyView({ inductees, onSelect }: JourneyViewProps) {
  const resolved = useMemo(() => resolveJourneys(inductees), [inductees]);
  const [activeJourneyId, setActiveJourneyId] = useState<string>('');
  const [step, setStep] = useState(0);
  const activeJourney = resolved.find((journey) => journey.id === activeJourneyId) ?? null;
  const activeStep = activeJourney?.people[step] ?? null;

  function openJourney(id: string) {
    setActiveJourneyId(id);
    setStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function closeJourney() {
    setActiveJourneyId('');
    setStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function goToStep(nextStep: number) {
    if (!activeJourney) return;
    setStep(clamp(nextStep, 0, activeJourney.people.length - 1));
  }

  useEffect(() => {
    if (!activeJourney) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToStep(step - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToStep(step + 1);
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeJourney();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeJourney, step]);

  if (activeJourney && activeStep) {
    const progressPercent =
      activeJourney.people.length <= 1 ? 100 : (step / (activeJourney.people.length - 1)) * 100;
    const themeChips = activeStep.inductee.themeTags.slice(0, 4);
    const atStart = step === 0;
    const atEnd = step === activeJourney.people.length - 1;

    return (
      <section
        className="journey journey--active"
        aria-label={`${activeJourney.title} journey`}
        style={{ '--journey-color': activeJourney.accent } as CSSProperties}
      >
        <header className="journey-active-header">
          <button className="journey-exit" type="button" onClick={closeJourney}>
            Exit Journey
          </button>
          <div>
            <p>Guided Question</p>
            <h2>{activeJourney.title}</h2>
          </div>
          <div className="journey-active-header__meta">
            <span>{step + 1} of {activeJourney.people.length}</span>
            <span>{activeJourney.stats.yearRange}</span>
            <span>{pluralize(activeJourney.stats.regionCount, 'region')}</span>
          </div>
        </header>

        <div className="journey-state-strip" aria-label="Journey start and ending state">
          <article className={atStart ? 'journey-state journey-state--active' : 'journey-state'}>
            <span>Start</span>
            <p>{activeJourney.startState}</p>
          </article>
          <article className={atEnd ? 'journey-state journey-state--active' : 'journey-state'}>
            <span>Ending</span>
            <p>{activeJourney.endState}</p>
          </article>
        </div>

        <div className="journey-progress-bar" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="journey-focus">
          <div className="journey-focus__media">
            <FallbackImage
              alt={activeStep.inductee.imageAltText || activeStep.inductee.name}
              className="journey-focus__image"
              fallbackClassName="journey-focus__fallback"
              fallbackLabel={initials(activeStep.inductee.name)}
              src={activeStep.inductee.primaryImageUrl}
            />
          </div>

          <div className="journey-focus__story">
            <div className="journey-focus__topline">
              <span>{formatYear(activeStep.inductee.classYear)}</span>
              <span>{activeStep.inductee.region}</span>
              {activeStep.inductee.hasVideo && <span>Watch / Listen</span>}
            </div>
            <h3>{activeStep.inductee.name}</h3>
            <strong>{activeStep.label}</strong>
            <p>{activeStep.inductee.storySummary || summarize(activeStep.inductee.bioText, 360)}</p>
            <section className="journey-transition" aria-label="Why this step follows">
              <h4>{step === 0 ? 'Why Start Here' : 'Why This Follows'}</h4>
              <p>{activeStep.transition}</p>
            </section>
            {themeChips.length > 0 && (
              <div className="journey-focus__themes" aria-label="Themes">
                {themeChips.map((theme) => (
                  <span key={theme}>{theme}</span>
                ))}
              </div>
            )}
            <div className="journey-focus__actions">
              <button type="button" onClick={() => goToStep(step - 1)} disabled={atStart}>
                Previous
              </button>
              <button type="button" onClick={() => goToStep(step + 1)} disabled={atEnd}>
                Next
              </button>
              <button type="button" onClick={() => onSelect(activeStep.inductee)}>
                Open Full Story
              </button>
            </div>
          </div>
        </div>

        <div className="journey-context" aria-label="Journey context">
          <ContextList title="Organizations" items={activeJourney.organizations ?? []} />
          <ContextList title="Places" items={activeJourney.places ?? []} />
        </div>

        <div className="journey-steps" aria-label="Journey steps">
          {activeJourney.people.map(({ inductee, label, transition }, index) => (
            <button
              aria-current={index === step ? 'step' : undefined}
              className={index === step ? 'journey-step journey-step--active' : 'journey-step'}
              key={inductee.id}
              type="button"
              onClick={() => goToStep(index)}
            >
              <FallbackImage
                alt={inductee.imageAltText || inductee.name}
                className="journey-step__image"
                fallbackClassName="journey-step__fallback"
                fallbackLabel={initials(inductee.name)}
                src={inductee.primaryImageUrl}
              />
              <span>{index + 1}</span>
              <strong>{inductee.name}</strong>
              <small>{label}</small>
              <em>{transition}</em>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="journey" aria-label="Story journeys">
      <header className="journey__header">
        <div>
          <p>Curated Questions</p>
          <h2>Journeys</h2>
        </div>
        <p>
          Human-curated paths through the portrait wall. Each question starts with a clear interpretive idea and moves from person to person with a reason for the next step.
        </p>
      </header>

      <div className="journey-grid">
        {resolved.map((journey) => {
          const leadPeople = journey.people.slice(0, 4);
          return (
            <button
              className="journey-card"
              key={journey.id}
              type="button"
              style={{ '--journey-color': journey.accent } as CSSProperties}
              onClick={() => openJourney(journey.id)}
            >
              <span className="journey-card__portraits" aria-hidden="true">
                {leadPeople.map(({ inductee }) => (
                  <FallbackImage
                    alt=""
                    className="journey-card__image"
                    fallbackClassName="journey-card__fallback"
                    fallbackLabel={initials(inductee.name)}
                    key={inductee.id}
                    src={inductee.primaryImageUrl}
                  />
                ))}
              </span>
              <span className="journey-card__body">
                <span className="journey-card__topline">
                  <span className="journey-card__count">{pluralize(journey.people.length, 'person', 'people')}</span>
                  <span>{journey.stats.yearRange}</span>
                </span>
                <strong>{journey.title}</strong>
                <span className="journey-card__intro">{journey.intro}</span>
                <span className="journey-card__state">
                  <span>Start</span>
                  {journey.startState}
                </span>
                <span className="journey-card__state">
                  <span>Ending</span>
                  {journey.endState}
                </span>
                <span className="journey-card__meta">
                  {(journey.places ?? []).slice(0, 2).map((place) => (
                    <span key={place}>{place}</span>
                  ))}
                  {(journey.organizations ?? []).slice(0, 1).map((organization) => (
                    <span key={organization}>{organization}</span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ContextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="journey-context__group">
      <h4>{title}</h4>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function resolveJourneys(inductees: Inductee[]): ResolvedJourney[] {
  const byId = new Map(inductees.map((inductee) => [inductee.id, inductee]));

  return journeys
    .map((journey) => ({
      ...journey,
      kind: journey.kind ?? 'curated',
      people: journey.items.flatMap((item) => {
        const inductee = byId.get(item.inducteeId);
        return inductee ? [{ inductee, label: item.label, transition: item.transition }] : [];
      }),
    }))
    .map((journey) => ({
      ...journey,
      stats: getJourneyStats(journey.people),
    }))
    .filter((journey) => journey.people.length >= 5 && journey.people.length <= 8);
}

function getJourneyStats(people: ResolvedPerson[]): JourneyStats {
  const years = people.map(({ inductee }) => inductee.classYear).filter(isNumber);
  const regions = new Set(people.map(({ inductee }) => inductee.region).filter(Boolean));

  return {
    yearRange: formatYearRange(years),
    regionCount: regions.size,
    videoCount: people.filter(({ inductee }) => inductee.hasVideo).length,
  };
}

function formatYear(year?: number | null) {
  return isNumber(year) ? String(year) : 'Year unknown';
}

function formatYearRange(years: number[]) {
  if (years.length === 0) return 'Year unknown';
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  return firstYear === lastYear ? String(firstYear) : `${firstYear}-${lastYear}`;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarize(text: string, length: number) {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}...`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
