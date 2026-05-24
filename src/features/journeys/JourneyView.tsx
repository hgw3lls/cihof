import { useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { journeys, type Journey } from '../../data/journeys';
import type { Inductee } from '../../data/types';

type JourneyViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

type ResolvedJourney = Journey & {
  people: Array<{ inductee: Inductee; label: string }>;
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
  }

  function closeJourney() {
    setActiveJourneyId('');
    setStep(0);
  }

  function advance(direction: -1 | 1) {
    if (!activeJourney) return;
    setStep((current) => (current + direction + activeJourney.people.length) % activeJourney.people.length);
  }

  if (activeJourney && activeStep) {
    return (
      <section className="journey journey--active" aria-label={`${activeJourney.title} journey`} style={{ '--journey-color': activeJourney.accent } as CSSProperties}>
        <div className="journey-focus">
          <button className="journey-back" type="button" onClick={closeJourney}>
            All journeys
          </button>
          <div className="journey-focus__media">
            <FallbackImage
              className="journey-focus__image"
              fallbackClassName="journey-focus__fallback"
              fallbackLabel={initials(activeStep.inductee.name)}
              src={activeStep.inductee.primaryImageUrl}
            />
          </div>
          <div className="journey-focus__story">
            <p className="eyebrow">{activeJourney.title}</p>
            <h2>{activeStep.inductee.name}</h2>
            <div className="journey-focus__meta">
              <span>{activeStep.inductee.classYear ?? 'Year unknown'}</span>
              <span>{activeStep.inductee.region}</span>
            </div>
            <strong>{activeStep.label}</strong>
            <p>{activeStep.inductee.storySummary || summarize(activeStep.inductee.bioText, 420)}</p>
            <div className="journey-focus__actions">
              <button type="button" onClick={() => advance(-1)}>Previous</button>
              <span>{step + 1} / {activeJourney.people.length}</span>
              <button type="button" onClick={() => advance(1)}>Next</button>
              <button type="button" onClick={() => onSelect(activeStep.inductee)}>Open Story</button>
            </div>
          </div>
        </div>

        <div className="journey-steps" aria-label="Journey steps">
          {activeJourney.people.map(({ inductee, label }, index) => (
            <button className={index === step ? 'journey-step journey-step--active' : 'journey-step'} key={inductee.id} type="button" onClick={() => setStep(index)}>
              <span>{index + 1}</span>
              <strong>{inductee.name}</strong>
              <small>{label}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="journey" aria-label="Story journeys">
      <div className="journey__header">
        <div>
          <p className="eyebrow">Guided Exhibit Paths</p>
          <h2>Story Journeys</h2>
        </div>
        <p>Choose a guided path through the Hall of Fame. Each journey connects inductees by contribution, community, and civic meaning.</p>
      </div>

      <div className="journey-grid">
        {resolved.map((journey) => {
          const lead = journey.people[0]?.inductee;
          return (
            <button className="journey-card" key={journey.id} type="button" style={{ '--journey-color': journey.accent } as CSSProperties} onClick={() => openJourney(journey.id)}>
              {lead && (
                <FallbackImage className="journey-card__image" fallbackClassName="journey-card__fallback" fallbackLabel={initials(lead.name)} src={lead.primaryImageUrl} />
              )}
              <span className="journey-card__body">
                <span className="journey-card__count">{journey.people.length} stories</span>
                <strong>{journey.title}</strong>
                <span>{journey.intro}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function resolveJourneys(inductees: Inductee[]): ResolvedJourney[] {
  const byId = new Map(inductees.map((inductee) => [inductee.id, inductee]));
  return journeys
    .map((journey) => ({
      ...journey,
      people: journey.items.flatMap((item) => {
        const inductee = byId.get(item.inducteeId);
        return inductee ? [{ inductee, label: item.label }] : [];
      }),
    }))
    .filter((journey) => journey.people.length > 0);
}

function summarize(text: string, length: number) {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}...`;
}
