import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { Inductee, StoryBeat, StoryBeatType, StorySectionRecord } from '../../data/types';

type StoryModeProps = {
  inductee: Inductee;
  allInductees: Inductee[];
  gallery: string[];
  storyRecord?: StorySectionRecord;
  onExit: () => void;
  onSelectPerson: (inductee: Inductee) => void;
};

const beatLabels: Record<StoryBeatType, string> = {
  early_life: 'Early Life',
  arrival: 'Arrival',
  building_community: 'Building Community',
  work: 'Work',
  struggle: 'Struggle',
  leadership: 'Leadership',
  legacy: 'Legacy',
  memory: 'Memory',
  recognition: 'Recognition',
};

export function StoryMode({ inductee, allInductees, gallery, storyRecord, onExit, onSelectPerson }: StoryModeProps) {
  const [step, setStep] = useState(0);
  const swipeRef = useRef({ pointerId: 0, x: 0, active: false });
  const beats = useMemo(
    () => resolveStoryBeats(inductee, allInductees, gallery, storyRecord),
    [allInductees, gallery, inductee, storyRecord],
  );
  const activeBeat = beats[step] ?? beats[0];
  const relatedPerson = activeBeat?.relatedPersonId ? allInductees.find((item) => item.id === activeBeat.relatedPersonId) ?? null : null;
  const progress = beats.length <= 1 ? 100 : (step / (beats.length - 1)) * 100;

  useEffect(() => {
    setStep(0);
  }, [inductee.id]);

  useEffect(() => {
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
        onExit();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [beats.length, onExit, step]);

  if (!activeBeat) return null;

  function goToStep(nextStep: number) {
    setStep(Math.min(Math.max(nextStep, 0), beats.length - 1));
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    swipeRef.current = { pointerId: event.pointerId, x: event.clientX, active: true };
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const swipe = swipeRef.current;
    if (!swipe.active || swipe.pointerId !== event.pointerId) return;
    const delta = event.clientX - swipe.x;
    swipeRef.current = { pointerId: 0, x: 0, active: false };
    if (Math.abs(delta) < 48) return;
    goToStep(delta < 0 ? step + 1 : step - 1);
  }

  return (
    <article
      className="story-mode"
      aria-label={`${inductee.name} life and work`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeRef.current = { pointerId: 0, x: 0, active: false };
      }}
    >
      <header className="story-mode__header">
        <div>
          <p className="museum-kicker">Life + Work</p>
          <h3>{activeBeat.headline}</h3>
        </div>
        <div className="story-mode__status" aria-label="Section progress">
          <span>{step + 1} / {beats.length}</span>
          <span>{storyRecord ? 'Reviewed' : 'Record text'}</span>
        </div>
        <button className="story-mode__exit" type="button" onClick={onExit}>
          Return
        </button>
      </header>

      <div className="story-mode__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="story-mode__beat" aria-live="polite">
        <div className="story-mode__media">
          <FallbackImage
            alt={activeBeat.imageAltText || `${inductee.name} story image`}
            className="story-mode__image"
            fallbackClassName="story-mode__fallback"
            fallbackLabel={initials(inductee.name)}
            loading="eager"
            src={activeBeat.imageUrl || gallery[step % Math.max(gallery.length, 1)] || inductee.primaryImageUrl}
          />
        </div>

        <div className="story-mode__copy">
          <div className="story-mode__marker">
            <span>{activeBeat.timelineMarker || formatBeatType(activeBeat.type)}</span>
          </div>
          <p>{activeBeat.body}</p>
          {activeBeat.quote && <blockquote>{activeBeat.quote}</blockquote>}
          <div className="story-mode__meta" aria-label="Record section metadata">
            {activeBeat.place && <span>{activeBeat.place}</span>}
            {activeBeat.organization && <span>{activeBeat.organization}</span>}
            {activeBeat.provenance && <span>{activeBeat.provenance}</span>}
          </div>
          {relatedPerson && (
            <button className="story-mode__related" type="button" onClick={() => onSelectPerson(relatedPerson)}>
              <span>Related Portrait</span>
              <strong>{relatedPerson.name}</strong>
            </button>
          )}
        </div>
      </section>

      <nav className="story-mode__nav" aria-label="Life and work navigation">
        <button type="button" disabled={step === 0} onClick={() => goToStep(step - 1)}>
          Previous
        </button>
        <div className="story-mode__dots" aria-label="Life and work sections">
          {beats.map((beat, index) => (
            <button
              aria-current={index === step ? 'step' : undefined}
              aria-label={`Go to ${beat.headline}`}
              className={index === step ? 'story-mode__dot story-mode__dot--active' : 'story-mode__dot'}
              key={beat.id}
              type="button"
              onClick={() => goToStep(index)}
            />
          ))}
        </div>
        <button type="button" disabled={step === beats.length - 1} onClick={() => goToStep(step + 1)}>
          Next
        </button>
      </nav>
    </article>
  );
}

function resolveStoryBeats(inductee: Inductee, allInductees: Inductee[], gallery: string[], storyRecord?: StorySectionRecord) {
  if (storyRecord?.beats.length) {
    return storyRecord.beats.map((beat, index) => ({
      ...beat,
      imageUrl: beat.imageUrl || gallery[index % Math.max(gallery.length, 1)] || inductee.primaryImageUrl,
      imageAltText: beat.imageAltText || `${inductee.name}: ${beat.headline}`,
      provenance: beat.provenance ?? storyRecord.provenance,
    }));
  }

  return generateStoryBeats(inductee, allInductees, gallery);
}

function generateStoryBeats(inductee: Inductee, allInductees: Inductee[], gallery: string[]): StoryBeat[] {
  const narrativeText = inductee.lifeWorkSummary || inductee.bioText || inductee.storySummary;
  const sentences = splitSentences(cleanNarrativeText(narrativeText));
  const chunks = buildChunks(sentences);
  const quote = extractQuote(inductee.bioText);

  if (chunks.length === 0) {
    return [{
      id: `${inductee.id}-story`,
      type: 'legacy',
      headline: 'Legacy',
      body: inductee.storySummary || `${inductee.name} is part of the Cleveland International Hall of Fame collection.`,
      imageUrl: inductee.primaryImageUrl,
      imageAltText: inductee.imageAltText,
      timelineMarker: formatYear(inductee.classYear),
      provenance: 'inferred',
    }];
  }

  return chunks.slice(0, 6).map((chunk, index) => {
    const body = limitWords(chunk.join(' '), 100);
    const type = inferBeatType(body, index, chunks.length);
    const relatedPerson = findRelatedPerson(body, inductee, allInductees);

    return {
      id: `${inductee.id}-${index + 1}`,
      type,
      headline: generatedHeadline(type, index, chunks.length),
      body,
      imageUrl: gallery[index % Math.max(gallery.length, 1)] || inductee.primaryImageUrl,
      imageAltText: `${inductee.name}: ${generatedHeadline(type, index, chunks.length)}`,
      quote: index === 0 ? quote : undefined,
      place: extractPlace(body),
      organization: extractOrganization(body),
      relatedPersonId: relatedPerson?.id,
      timelineMarker: index === chunks.length - 1 ? formatYear(inductee.classYear) : extractYear(body),
      provenance: 'inferred',
    };
  });
}

function cleanNarrativeText(text: string) {
  const withoutMediaTail = text.split(/Watch the video|Here is a video|See more photos|Congratulations|Back to /i)[0] || text;
  return withoutMediaTail.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string) {
  const matches = text.match(/[^.!?]+[.!?]+/g) ?? [];
  if (matches.length === 0 && text) return [text];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}

function buildChunks(sentences: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];

  sentences.forEach((sentence) => {
    current.push(sentence);
    const words = wordCount(current.join(' '));
    if (words >= 52 || current.length >= 3) {
      chunks.push(current);
      current = [];
    }
  });

  if (current.length > 0) {
    if (chunks.length > 0 && wordCount(current.join(' ')) < 28) chunks[chunks.length - 1].push(...current);
    else chunks.push(current);
  }

  return chunks;
}

function inferBeatType(text: string, index: number, total: number): StoryBeatType {
  const lower = text.toLowerCase();
  if (index === total - 1) return 'legacy';
  if (/\b(born|raised|grew up|child|school|education|graduat)/.test(lower)) return 'early_life';
  if (/\b(immigrat|arriv|came to|moved to|resettl|refugee|new country)/.test(lower)) return 'arrival';
  if (/\b(struggle|war|violence|displaced|battle|challenge|barrier|crisis)/.test(lower)) return 'struggle';
  if (/\b(community|families|neighborhood|volunteer|cultural|festival|garden)/.test(lower)) return 'building_community';
  if (/\b(president|director|mayor|leader|founded|served|board|council)/.test(lower)) return 'leadership';
  if (/\b(work|career|business|company|doctor|lawyer|teacher|engineer|professor)/.test(lower)) return 'work';
  if (/\b(award|honor|inducted|recognition)/.test(lower)) return 'recognition';
  return index === 0 ? 'early_life' : 'work';
}

function generatedHeadline(type: StoryBeatType, index: number, total: number) {
  if (index === 0 && type !== 'arrival') return 'Early Life';
  if (index === total - 1) return 'Legacy';
  return beatLabels[type];
}

function formatBeatType(type?: StoryBeatType) {
  return type ? beatLabels[type] : 'Record Section';
}

function extractQuote(text: string) {
  const match = text.match(/[“"]([^”"]{18,150})[”"]/);
  return match?.[1]?.trim();
}

function extractYear(text: string) {
  return text.match(/\b(19|20)\d{2}\b/)?.[0];
}

function extractPlace(text: string) {
  const places = [
    'Cleveland City Hall',
    'City Hall',
    'Cleveland Cultural Gardens',
    'Rockefeller Park',
    'AsiaTown',
    'Cleveland State University',
    'Cuyahoga Community College',
    'Central and Kinsman',
    'Greater Cleveland',
    'Cleveland',
  ];
  const lower = text.toLowerCase();
  return places.find((place) => lower.includes(place.toLowerCase()));
}

function extractOrganization(text: string) {
  const match = text.match(/\b([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,5}\s+(?:Foundation|Association|Society|Council|Center|Clinic|University|College|Museum|Institute|Hospital|Church|Federation|School|Board|Committee|Commission|District))\b/);
  return match?.[1]?.trim();
}

function findRelatedPerson(text: string, inductee: Inductee, allInductees: Inductee[]) {
  const lower = text.toLowerCase();
  return allInductees.find((person) => person.id !== inductee.id && person.name.length > 7 && lower.includes(person.name.toLowerCase()));
}

function limitWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatYear(year: number | null) {
  return year ? `Class of ${year}` : 'Class year pending';
}
