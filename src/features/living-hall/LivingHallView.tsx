import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { RouteLine } from '../../components/RouteLine';
import { installationConfig } from '../../config/installationConfig';
import { useCityQuestion } from '../../data/useCityQuestion';
import type { Inductee } from '../../data/types';
import { CityQuestionPrompt, CityQuestionResults } from './CityQuestion';

type LivingHallViewProps = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
  attractActive?: boolean;
  onEngage?: () => void;
  onSelect: (inductee: Inductee) => void;
};

type HallMode = {
  id: string;
  title: string;
  subtitle: string;
  positions: Map<string, PortraitPosition>;
  labels: HallLabel[];
};

type PortraitPosition = {
  x: number;
  y: number;
  size: number;
  z: number;
  delay: number;
  emphasis?: boolean;
};

type HallLabel = {
  id: string;
  text: string;
  detail?: string;
  x: number;
  y: number;
};

type LatestClass = {
  year: number;
  inductees: Inductee[];
  stats: {
    people: number;
    stories: number;
    cities: number;
  };
};

type LatestClassFrame =
  | { kind: 'intro'; key: string }
  | { kind: 'person'; key: string; inductee: Inductee; index: number }
  | { kind: 'group'; key: string }
  | { kind: 'finale'; key: string };

const explicitSources = new Set(['curated', 'documented']);

export function LivingHallView({
  inductees,
  loading,
  error,
  attractActive = false,
  onEngage,
  onSelect,
}: LivingHallViewProps) {
  const [step, setStep] = useState(0);
  const [latestClassFrame, setLatestClassFrame] = useState<LatestClassFrame | null>(null);
  const [cityResultsActive, setCityResultsActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const cityQuestion = useCityQuestion();
  const people = useMemo(() => sortInductees(inductees), [inductees]);
  const modes = useMemo(() => buildHallModes(people), [people]);
  const latestClass = useMemo(() => buildLatestClass(people), [people]);
  const hallYears = useMemo(() => buildHallYearRange(people), [people]);
  const hallVocabulary = useMemo(() => buildHallVocabulary(people), [people]);
  const activeMode = modes[step % Math.max(modes.length, 1)] ?? emptyMode;
  const cityQuestionTotal = useMemo(() => {
    return cityQuestion.config.options.reduce((total, option) => total + (cityQuestion.counts[option.id] ?? 0), 0);
  }, [cityQuestion.config.options, cityQuestion.counts]);
  const {
    enabled: cityAttractEnabled,
    holdMs: cityAttractHoldMs,
    initialDelayMs: cityAttractInitialDelayMs,
    loopPauseMs: cityAttractLoopPauseMs,
  } = cityQuestion.config.attract;

  useEffect(() => {
    if (installationConfig.animationIntensity === 'none') return undefined;
    if (modes.length <= 1) return undefined;
    const interval = window.setInterval(() => {
      setStep((value) => value + 1);
    }, installationConfig.attractLoop.regroupMs);

    return () => window.clearInterval(interval);
  }, [modes.length]);

  useEffect(() => {
    if (modes.length > 0 && step >= modes.length) setStep(0);
  }, [modes.length, step]);

  useEffect(() => {
    if (!installationConfig.attractLoop.latestClass.enabled || !attractActive || !latestClass || latestClass.inductees.length === 0) {
      setLatestClassFrame(null);
      return undefined;
    }

    let cancelled = false;
    const timers: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
      timers.push(timer);
    };

    const runSequence = () => {
      if (cancelled) return;
      setStep(0);

      if (reducedMotion) {
        setLatestClassFrame({ kind: 'group', key: `latest-${latestClass.year}-group` });
        schedule(() => {
          setLatestClassFrame({ kind: 'finale', key: `latest-${latestClass.year}-finale` });
        }, installationConfig.attractLoop.latestClass.groupMs);
        schedule(() => {
          setLatestClassFrame(null);
          setStep(0);
          schedule(runSequence, installationConfig.attractLoop.latestClass.loopPauseMs);
        }, installationConfig.attractLoop.latestClass.groupMs + installationConfig.attractLoop.latestClass.finaleMs);
        return;
      }

      setLatestClassFrame({ kind: 'intro', key: `latest-${latestClass.year}-intro` });
      latestClass.inductees.forEach((inductee, index) => {
        schedule(() => {
          setLatestClassFrame({ kind: 'person', key: `latest-${latestClass.year}-${inductee.id}`, inductee, index });
        }, installationConfig.attractLoop.latestClass.introMs + index * installationConfig.attractLoop.latestClass.portraitMs);
      });

      const groupAt = installationConfig.attractLoop.latestClass.introMs + latestClass.inductees.length * installationConfig.attractLoop.latestClass.portraitMs;
      const finaleAt = groupAt + installationConfig.attractLoop.latestClass.groupMs;
      const completeAt = finaleAt + installationConfig.attractLoop.latestClass.finaleMs;
      schedule(() => {
        setLatestClassFrame({ kind: 'group', key: `latest-${latestClass.year}-group` });
      }, groupAt);
      schedule(() => {
        setLatestClassFrame({ kind: 'finale', key: `latest-${latestClass.year}-finale` });
      }, finaleAt);
      schedule(() => {
        setLatestClassFrame(null);
        setStep(0);
        schedule(runSequence, installationConfig.attractLoop.latestClass.loopPauseMs);
      }, completeAt);
    };

    schedule(runSequence, installationConfig.attractLoop.latestClass.initialDelayMs);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      setLatestClassFrame(null);
    };
  }, [attractActive, latestClass, reducedMotion]);

  useEffect(() => {
    if (!attractActive || latestClassFrame || !cityQuestion.enabled || !cityAttractEnabled) {
      setCityResultsActive(false);
      return undefined;
    }

    let cancelled = false;
    const timers: number[] = [];
    const schedule = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
      timers.push(timer);
    };

    const runResults = () => {
      setCityResultsActive(true);
      schedule(() => {
        setCityResultsActive(false);
        schedule(runResults, cityAttractLoopPauseMs);
      }, cityAttractHoldMs);
    };

    schedule(runResults, cityAttractInitialDelayMs);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      setCityResultsActive(false);
    };
  }, [
    attractActive,
    cityAttractEnabled,
    cityAttractHoldMs,
    cityAttractInitialDelayMs,
    cityAttractLoopPauseMs,
    cityQuestion.enabled,
    latestClassFrame,
  ]);

  const hallClassName = [
    'living-hall',
    attractActive ? 'living-hall--attract' : '',
    latestClassFrame ? 'living-hall--latest-sequence' : '',
    cityResultsActive ? 'living-hall--city-results' : '',
  ].filter(Boolean).join(' ');

  return (
    <section
      className={hallClassName}
      aria-label="Living Hall portrait field"
      data-latest-class-size={latestClass?.stats.people ?? 0}
      data-latest-class-year={latestClass?.year ?? ''}
      data-city-question-enabled={cityQuestion.enabled ? 'true' : 'false'}
      data-city-question-total={cityQuestionTotal}
      data-hall-mode={activeMode.id}
      onPointerDown={() => onEngage?.()}
    >
      <div className="living-hall__recordLayer" aria-hidden="true">
        <RouteLine className="living-hall__routeLine living-hall__routeLine--north" path="kink" tone="route" end="dot" draw={attractActive} />
        <RouteLine className="living-hall__routeLine living-hall__routeLine--east" path="kink" tone="route" end="dot" draw={attractActive} />
        <RouteLine className="living-hall__routeLine living-hall__routeLine--south" path="horizontal" tone="route" end="dot" draw={attractActive} />
        <RouteLine className="living-hall__routeLine living-hall__routeLine--west" path="horizontal" tone="quiet" end="none" />
        <span className="living-hall__recordNote living-hall__recordNote--one">CARD NO. CIHOF</span>
        <span className="living-hall__recordNote living-hall__recordNote--two">ROUTE / RECORD / PORTRAIT</span>
        <span className="living-hall__recordNote living-hall__recordNote--three">CLEVELAND CONNECTIONS</span>
      </div>

      <div className="living-hall__title" aria-live="polite">
        <span className="living-hall__era">{hallYears}</span>
        <h2>Cleveland International Hall of Fame</h2>
        <span className="living-hall__mode">
          {loading && 'Gathering portraits'}
          {!loading && error && 'Portrait data could not be loaded'}
          {!loading && !error && `${activeMode.title} / ${activeMode.subtitle}`}
        </span>
      </div>

      <aside className="living-hall__vocabulary" aria-label="Collection themes represented in this grouping">
        {hallVocabulary.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </aside>

      <p className="living-hall__touchCue">TOUCH SOMEONE</p>

      <div className="living-hall__field" aria-label="Interactive inductee portraits">
        {loading && <LivingHallPlaceholders />}
        {!loading && !error && people.map((inductee, index) => {
          const position = activeMode.positions.get(inductee.id) ?? fallbackPosition(index, people.length);
          const style = portraitStyle(position);
          const className = [
            'living-portrait',
            position.emphasis ? 'living-portrait--emphasis' : '',
            inductee.featured || inductee.featuredCandidate ? 'living-portrait--featured' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              aria-label={`${inductee.name}${inductee.classYear ? `, Class of ${inductee.classYear}` : ''}`}
              className={className}
              data-transition-person={inductee.id}
              data-transition-role="living-portrait"
              key={inductee.id}
              style={style}
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect(inductee);
              }}
              onClick={() => onSelect(inductee)}
            >
              <span className="living-portrait__imageWrap">
                <FallbackImage
                  alt={inductee.imageAltText || inductee.name}
                  className="living-portrait__image"
                  fallbackClassName="living-portrait__fallback"
                  fallbackLabel={initials(inductee.name)}
                  loading="eager"
                  src={inductee.primaryImageUrl}
                />
              </span>
              <span className="living-portrait__label">
                <strong>{inductee.name}</strong>
                {inductee.classYear && <small>{inductee.classYear}</small>}
              </span>
            </button>
          );
        })}

        {!loading && !error && activeMode.labels.map((label) => (
          <span className="living-hall__groupLabel" key={label.id} style={labelStyle(label)}>
            <strong>{label.text}</strong>
            {label.detail && <small>{label.detail}</small>}
          </span>
        ))}

        {!loading && error && <div className="living-hall__status">Data error: {error}</div>}
      </div>

      {!loading && !error && attractActive && latestClass && latestClassFrame && (
        <LatestClassSequence
          frame={latestClassFrame}
          latestClass={latestClass}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      )}

      {!loading && !error && cityQuestion.enabled && !attractActive && !latestClassFrame && (
        <CityQuestionPrompt
          config={cityQuestion.config}
          counts={cityQuestion.counts}
          onRecordChoice={cityQuestion.recordChoice}
        />
      )}

      {!loading && !error && attractActive && cityQuestion.enabled && cityResultsActive && !latestClassFrame && (
        <CityQuestionResults
          config={cityQuestion.config}
          counts={cityQuestion.counts}
          reducedMotion={reducedMotion}
        />
      )}
    </section>
  );
}

function LatestClassSequence({
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

function LivingHallPlaceholders() {
  return (
    <>
      {Array.from({ length: 32 }, (_, index) => {
        const position = fallbackPosition(index, 32);
        return (
          <span className="living-portrait living-portrait--placeholder" key={index} style={portraitStyle(position)}>
            <span className="living-portrait__imageWrap">
              <span className="living-portrait__fallback">CIHOF</span>
            </span>
          </span>
        );
      })}
    </>
  );
}

const emptyMode: HallMode = {
  id: 'empty',
  title: 'LIVING HALL',
  subtitle: 'No portraits loaded',
  positions: new Map(),
  labels: [],
};

function buildHallModes(inductees: Inductee[]) {
  if (inductees.length === 0) return [emptyMode];

  const modes: HallMode[] = [
    buildAllTogetherMode(inductees),
    buildTimelineMode(inductees),
  ];

  const contributionMode = buildExplicitTagMode({
    id: 'contribution',
    title: 'AREAS OF CONTRIBUTION',
    subtitle: 'Grouped by curated contribution metadata',
    inductees,
    tagSource: (inductee) => explicitTags(inductee.themeTags, inductee.themeTagsSource),
  });
  if (contributionMode) modes.push(contributionMode);

  const communityMode = buildExplicitTagMode({
    id: 'community',
    title: 'COMMUNITY LINES',
    subtitle: 'Grouped by documented community affiliations',
    inductees,
    tagSource: (inductee) => inductee.communityTags,
  });
  if (communityMode) modes.push(communityMode);

  const geographyMode = buildExplicitTagMode({
    id: 'geography',
    title: 'WORLD CONNECTIONS',
    subtitle: 'Grouped by curated geography metadata',
    inductees,
    tagSource: (inductee) => explicitTags(inductee.countryTags, inductee.countryTagsSource),
  });
  if (geographyMode) modes.push(geographyMode);

  return modes;
}

function buildAllTogetherMode(inductees: Inductee[]): HallMode {
  const positions = new Map<string, PortraitPosition>();
  const count = inductees.length;
  const heroIndices = contactSheetHeroSlots.map((_, slotIndex) => {
    if (contactSheetHeroSlots.length <= 1) return 0;
    return Math.min(count - 1, Math.round((slotIndex / (contactSheetHeroSlots.length - 1)) * (count - 1)));
  });
  let contactIndex = 0;

  inductees.forEach((inductee, index) => {
    const heroSlotIndex = heroIndices.indexOf(index);
    const heroSlot = heroSlotIndex >= 0 ? contactSheetHeroSlots[heroSlotIndex] : null;

    if (heroSlot) {
      positions.set(inductee.id, {
        x: heroSlot.x,
        y: heroSlot.y,
        size: heroSlot.size,
        z: 1000 + heroSlot.size,
        delay: staggerDelay(index),
        emphasis: true,
      });
      return;
    }

    const position = contactSheetPosition(contactIndex, Math.max(count - heroIndices.length, 1), inductee.id);
    contactIndex += 1;

    positions.set(inductee.id, {
      ...position,
      delay: staggerDelay(index),
      emphasis: index % 31 === 0,
    });
  });

  return {
    id: 'one-cleveland',
    title: 'ONE CLEVELAND',
    subtitle: `${inductees.length} real people. Touch a portrait to open a story.`,
    positions,
    labels: [
      { id: 'one-cleveland', text: 'ALL INDUCTEES', detail: String(inductees.length), x: 12, y: 82 },
    ],
  };
}

function buildTimelineMode(inductees: Inductee[]): HallMode {
  const positions = new Map<string, PortraitPosition>();
  const groups = groupByYear(inductees);
  const years = [...groups.keys()].sort((a, b) => a - b);
  const minYear = years[0] ?? 0;
  const maxYear = years[years.length - 1] ?? minYear;
  const labels: HallLabel[] = [];

  years.forEach((year, yearIndex) => {
    const group = groups.get(year) ?? [];
    const x = years.length === 1 ? 50 : 8 + (yearIndex / (years.length - 1)) * 84;
    const labelY = yearIndex % 2 === 0 ? 86 : 91;
    labels.push({ id: `year-${year}`, text: String(year), detail: `${group.length}`, x, y: labelY });

    group.forEach((inductee, personIndex) => {
      const spread = Math.max(group.length - 1, 1);
      const yBase = 22 + (personIndex / spread) * 51;
      const side = personIndex % 2 === 0 ? -1 : 1;
      const size = portraitSize(inductee, personIndex + yearIndex, 74, 112);

      positions.set(inductee.id, {
        x: clamp(x + side * wobble(inductee.id, 11, 0.4, 2.6), 5, 95),
        y: clamp(yBase + wobble(inductee.name, 13, -4, 4), 13, 78),
        size,
        z: 40 + Math.round(size),
        delay: staggerDelay(yearIndex + personIndex),
        emphasis: group.length <= 5 || personIndex === 0,
      });
    });
  });

  return {
    id: 'induction-years',
    title: `${minYear} - ${maxYear}`,
    subtitle: 'Regrouped by induction class',
    positions,
    labels,
  };
}

function buildExplicitTagMode({
  id,
  title,
  subtitle,
  inductees,
  tagSource,
}: {
  id: string;
  title: string;
  subtitle: string;
  inductees: Inductee[];
  tagSource: (inductee: Inductee) => string[];
}): HallMode | null {
  const buckets = new Map<string, Inductee[]>();

  for (const inductee of inductees) {
    const tag = tagSource(inductee)[0];
    if (!tag) continue;
    const bucket = buckets.get(tag) ?? [];
    bucket.push(inductee);
    buckets.set(tag, bucket);
  }

  const groups = [...buckets.entries()]
    .filter(([, people]) => people.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 6);

  if (groups.length < 3) return null;

  const positionedIds = new Set<string>();
  const positions = new Map<string, PortraitPosition>();
  const labels: HallLabel[] = [];
  const anchors = groupAnchors(groups.length);

  groups.forEach(([label, people], groupIndex) => {
    const anchor = anchors[groupIndex];
    labels.push({ id: `${id}-${label}`, text: label.toUpperCase(), detail: `${people.length}`, x: anchor.x, y: anchor.labelY });

    people.forEach((inductee, personIndex) => {
      positionedIds.add(inductee.id);
      const orbit = Math.sqrt((personIndex + 1) / people.length);
      const angle = (personIndex * 151 + groupIndex * 43) * Math.PI / 180;
      const size = portraitSize(inductee, personIndex + groupIndex, 76, 118);

      positions.set(inductee.id, {
        x: clamp(anchor.x + Math.cos(angle) * anchor.rx * orbit, 6, 94),
        y: clamp(anchor.y + Math.sin(angle) * anchor.ry * orbit, 14, 80),
        size,
        z: 60 + Math.round(size),
        delay: staggerDelay(personIndex + groupIndex),
        emphasis: personIndex < 2,
      });
    });
  });

  inductees
    .filter((inductee) => !positionedIds.has(inductee.id))
    .forEach((inductee, index, ungrouped) => {
      const position = fallbackPosition(index, ungrouped.length || 1);
      positions.set(inductee.id, {
        ...position,
        size: Math.min(position.size, 76),
        y: clamp(position.y, 18, 76),
        z: 20,
        emphasis: false,
      });
    });

  return { id, title, subtitle, positions, labels };
}

function buildLatestClass(inductees: Inductee[]): LatestClass | null {
  const groups = groupByYear(inductees);
  const latestYear = Math.max(...[...groups.keys()]);
  if (!Number.isFinite(latestYear)) return null;

  const latestInductees = [...(groups.get(latestYear) ?? [])].sort((a, b) => {
    return a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
  });
  if (latestInductees.length === 0) return null;

  const storyCount = latestInductees.filter((inductee) => {
    return Boolean((inductee.storySummary || inductee.bioText).trim());
  }).length;

  return {
    year: latestYear,
    inductees: latestInductees,
    stats: {
      people: latestInductees.length,
      stories: storyCount || latestInductees.length,
      cities: latestInductees.length > 0 ? 1 : 0,
    },
  };
}

function sortInductees(inductees: Inductee[]) {
  return [...inductees].sort((a, b) => {
    const yearA = a.classYear ?? Number.MAX_SAFE_INTEGER;
    const yearB = b.classYear ?? Number.MAX_SAFE_INTEGER;
    return yearA - yearB || a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
  });
}

function groupByYear(inductees: Inductee[]) {
  const groups = new Map<number, Inductee[]>();
  for (const inductee of inductees) {
    if (typeof inductee.classYear !== 'number') continue;
    const group = groups.get(inductee.classYear) ?? [];
    group.push(inductee);
    groups.set(inductee.classYear, group);
  }
  return groups;
}

function buildHallYearRange(inductees: Inductee[]) {
  const years = [...groupByYear(inductees).keys()].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  if (!firstYear || !lastYear) return 'CIHOF';
  return firstYear === lastYear ? String(firstYear) : `${firstYear} - ${lastYear}`;
}

function buildHallVocabulary(inductees: Inductee[]) {
  const counts = new Map<string, number>();
  for (const inductee of inductees) {
    const supportedTags = [
      ...explicitTags(inductee.themeTags, inductee.themeTagsSource),
      ...inductee.communityTags,
    ];

    for (const tag of supportedTags) {
      const label = tag.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label]) => label.toUpperCase());
}

function explicitTags(tags: string[], source: string) {
  return explicitSources.has(source.toLowerCase()) ? tags : [];
}

function groupAnchors(count: number) {
  const preset = [
    { x: 17, y: 26, labelY: 12, rx: 11, ry: 11 },
    { x: 83, y: 24, labelY: 12, rx: 10, ry: 10 },
    { x: 84, y: 55, labelY: 39, rx: 11, ry: 12 },
    { x: 25, y: 67, labelY: 84, rx: 12, ry: 10 },
    { x: 52, y: 70, labelY: 86, rx: 13, ry: 9 },
    { x: 74, y: 73, labelY: 86, rx: 11, ry: 9 },
  ];
  return preset.slice(0, count);
}

const contactSheetHeroSlots = [
  { x: 34, y: 74, size: 204 },
  { x: 64, y: 68, size: 154 },
  { x: 79, y: 24, size: 154 },
  { x: 14, y: 20, size: 112 },
  { x: 90, y: 31, size: 122 },
  { x: 48, y: 12, size: 96 },
  { x: 12, y: 70, size: 76 },
  { x: 96, y: 23, size: 70 },
];

const contactSheetZones = [
  { x0: 5, x1: 24, y0: 13, y1: 70, columns: 4, rows: 8 },
  { x0: 72, x1: 96, y0: 9, y1: 72, columns: 5, rows: 8 },
  { x0: 25, x1: 68, y0: 66, y1: 79, columns: 8, rows: 3 },
  { x0: 26, x1: 67, y0: 6, y1: 20, columns: 7, rows: 2 },
];

function contactSheetPosition(index: number, total: number, seed: string): PortraitPosition {
  const zoneIndex = index % contactSheetZones.length;
  const zone = contactSheetZones[zoneIndex];
  const zoneOrdinal = Math.floor(index / contactSheetZones.length);
  const capacity = zone.columns * zone.rows;
  const slot = zoneOrdinal % capacity;
  const column = slot % zone.columns;
  const row = Math.floor(slot / zone.columns);
  const xRatio = zone.columns <= 1 ? 0.5 : column / (zone.columns - 1);
  const yRatio = zone.rows <= 1 ? 0.5 : row / (zone.rows - 1);
  const x = zone.x0 + (zone.x1 - zone.x0) * xRatio + wobble(seed, 17, -1.2, 1.2);
  const y = zone.y0 + (zone.y1 - zone.y0) * yRatio + wobble(seed, 19, -1.1, 1.1);
  const size = clamp(56 + (hashNumber(`${seed}-${index}-${total}`) % 24), 52, 82);

  return {
    x: clamp(x, 4, 96),
    y: clamp(y, 6, 80),
    size,
    z: 20 + Math.round(size),
    delay: staggerDelay(index),
  };
}

function fallbackPosition(index: number, total: number): PortraitPosition {
  const count = Math.max(total, 1);
  const ring = Math.sqrt((index + 1) / count);
  const angle = index * 137.508 * Math.PI / 180;
  const size = 82 + (index % 5) * 6;

  return {
    x: clamp(50 + Math.cos(angle) * 38 * ring, 8, 92),
    y: clamp(50 + Math.sin(angle) * 29 * ring, 14, 80),
    size,
    z: Math.round(size),
    delay: staggerDelay(index),
    emphasis: index % 13 === 0,
  };
}

function portraitSize(inductee: Inductee, index: number, min: number, max: number) {
  const priority = inductee.featured ? 22 : inductee.featuredCandidate ? 14 : Math.min(inductee.attractPriority * 1.8, 18);
  const variation = (hashNumber(`${inductee.id}-${index}`) % 21) - 7;
  return clamp(min + priority + variation, min, max);
}

function staggerDelay(index: number) {
  return (index % 12) * 24;
}

function hashNumber(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function wobble(value: string, salt: number, min: number, max: number) {
  const ratio = ((hashNumber(`${value}-${salt}`) % 1000) / 1000);
  return min + (max - min) * ratio;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function portraitStyle(position: PortraitPosition) {
  return {
    '--portrait-x': `${position.x}%`,
    '--portrait-y': `${position.y}%`,
    '--portrait-size': `${position.size}px`,
    '--portrait-delay': `${position.delay}ms`,
    zIndex: position.z,
  } as CSSProperties & Record<string, string | number>;
}

function labelStyle(label: HallLabel) {
  return {
    '--label-x': `${label.x}%`,
    '--label-y': `${label.y}%`,
  } as CSSProperties & Record<string, string>;
}

function useReducedMotion() {
  const configuredReducedMotion = installationConfig.animationIntensity !== 'standard';
  const [reducedMotion, setReducedMotion] = useState(configuredReducedMotion);

  useEffect(() => {
    if (configuredReducedMotion) {
      setReducedMotion(true);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [configuredReducedMotion]);

  return reducedMotion;
}
