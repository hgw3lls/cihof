import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { runtimeLogger } from '../../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from '../../data/localDataCache';
import type { Inductee } from '../../data/types';

type WorldLensViewProps = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
  activeFocusKey: string;
  onFocusChange: (focusKey: string) => void;
  onSelect: (inductee: Inductee) => void;
};

type WorldLensCopy = {
  kicker: string;
  title: string;
  secondaryStatement: string;
  instruction: string;
  defaultFocusTitle: string;
  defaultFocusBody: string;
  activeRegionPrefix: string;
  activeCountryPrefix: string;
  peoplePrompt: string;
  sourceDisclosure: string;
  emptyTitle: string;
  emptyBody: string;
};

type WorldCopyDocument = {
  copy?: Partial<WorldLensCopy>;
};

type GeoReference = {
  person: Inductee;
  country: string;
  region: string;
  note: string;
  source: string;
};

const worldLensCopyUrl = `${import.meta.env.BASE_URL}data/world-lens.json`;
const worldLensCopyCacheKey = 'world-lens-copy';

type CountryNode = {
  id: string;
  label: string;
  region: string;
  x: number;
  y: number;
  people: Inductee[];
  references: GeoReference[];
};

type RegionNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  people: Inductee[];
  countries: CountryNode[];
};

type WorldModel = {
  references: GeoReference[];
  countries: CountryNode[];
  regions: RegionNode[];
  people: Inductee[];
};

type WorldPortraitAnchor = {
  person: Inductee;
  x: number;
  y: number;
};

type ActiveFocus =
  | { kind: 'all'; key: ''; label: string; x: number; y: number; people: Inductee[]; countries: CountryNode[] }
  | { kind: 'region'; key: string; label: string; x: number; y: number; people: Inductee[]; countries: CountryNode[] }
  | { kind: 'country'; key: string; label: string; x: number; y: number; people: Inductee[]; countries: CountryNode[]; country: CountryNode };

const clevelandPoint = { x: 50, y: 52 };
const maxPortraitsInField = 6;
const maxVisibleCountries = 8;
const internationalCountryExclusions = new Set(['United States']);
const presentationReadySourceNotes = /Profile states|Profile identifies|Profile references|Profile centers|Profile describes|Profile names|born in|immigrated|emigrated|came to|arrived|Honorary Consul|first person of/i;
const withheldSourceNotes = /needs curator confirmation|requires curator confirmation|pending review|suggests|no specific international origin|no specific country|born in Cleveland|born in La Grange|raised in Columbus/i;
const fallbackCopy: WorldLensCopy = {
  kicker: 'Routes',
  title: 'Routes',
  secondaryStatement: 'Many paths meet in Cleveland.',
  instruction: 'Touch a place',
  defaultFocusTitle: 'Cleveland',
  defaultFocusBody: 'The Hall of Fame holds stories where international places, communities, journeys, and civic relationships meet in Cleveland.',
  activeRegionPrefix: 'Region in view',
  activeCountryPrefix: 'Place in view',
  peoplePrompt: 'Touch a portrait',
  sourceDisclosure: 'Geography shown here comes from structured CIHOF profile-source references. Records flagged for curator confirmation are withheld.',
  emptyTitle: 'Awaiting Curated Geography',
  emptyBody: 'No presentation-ready international geography records are available yet.',
};
const regionLayout: Record<string, { x: number; y: number }> = {
  Africa: { x: 52, y: 61 },
  Asia: { x: 71, y: 43 },
  Europe: { x: 52, y: 35 },
  'North America': { x: 26, y: 42 },
  'South America': { x: 34, y: 72 },
};
const countryLayout: Record<string, { x: number; y: number }> = {
  Albania: { x: 54, y: 43 },
  Armenia: { x: 60, y: 44 },
  Austria: { x: 51, y: 39 },
  China: { x: 73, y: 43 },
  Croatia: { x: 53, y: 41 },
  'Czech Republic': { x: 51, y: 37 },
  Egypt: { x: 55, y: 52 },
  Estonia: { x: 53, y: 31 },
  Ethiopia: { x: 57, y: 63 },
  Germany: { x: 50, y: 36 },
  Greece: { x: 55, y: 44 },
  Hungary: { x: 53, y: 39 },
  India: { x: 66, y: 53 },
  Ireland: { x: 45, y: 34 },
  Italy: { x: 52, y: 43 },
  Japan: { x: 80, y: 43 },
  Latvia: { x: 53, y: 33 },
  Lebanon: { x: 58, y: 47 },
  Lithuania: { x: 53, y: 34 },
  Mexico: { x: 24, y: 53 },
  Netherlands: { x: 49, y: 35 },
  Norway: { x: 51, y: 28 },
  Poland: { x: 53, y: 36 },
  'Puerto Rico': { x: 35, y: 52 },
  Romania: { x: 55, y: 40 },
  Russia: { x: 66, y: 31 },
  Serbia: { x: 54, y: 42 },
  Slovenia: { x: 52, y: 40 },
  'South Korea': { x: 77, y: 43 },
  Syria: { x: 59, y: 47 },
  Ukraine: { x: 56, y: 37 },
  'United Kingdom': { x: 47, y: 33 },
  Vietnam: { x: 73, y: 55 },
};
const portraitOffsets = [
  { x: -7, y: -14 },
  { x: 8, y: -13 },
  { x: -8, y: 12 },
  { x: 10, y: 11 },
  { x: 0, y: 15 },
  { x: 12, y: -2 },
  { x: -12, y: -2 },
  { x: 6, y: -16 },
];

export function WorldLensView({
  inductees,
  loading,
  error,
  activeFocusKey,
  onFocusChange,
  onSelect,
}: WorldLensViewProps) {
  const copy = useWorldLensCopy();
  const model = useMemo(() => buildWorldModel(inductees), [inductees]);
  const activeFocus = useMemo(
    () => resolveActiveFocus(model, activeFocusKey, copy.defaultFocusTitle),
    [activeFocusKey, copy.defaultFocusTitle, model],
  );
  const visibleCountries = useMemo(
    () => visibleCountryNodes(model, activeFocus),
    [activeFocus, model],
  );
  const portraitAnchors = useMemo(
    () => buildPortraitAnchors(activeFocus, visibleCountries),
    [activeFocus, visibleCountries],
  );

  useEffect(() => {
    if (!activeFocusKey || activeFocus.key === activeFocusKey) return;
    onFocusChange(activeFocus.key);
  }, [activeFocus.key, activeFocusKey, onFocusChange]);

  if (loading) {
    return (
      <section className="world-lens world-lens--loading" aria-label="World">
        <div className="world-lens__status">Loading world relationships</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="world-lens world-lens--loading" aria-label="World">
        <div className="world-lens__status">World data could not be loaded: {error}</div>
      </section>
    );
  }

  if (model.references.length === 0) {
    return (
      <section className="world-lens world-lens--loading" aria-label="World">
        <div className="world-lens__empty">
          <p className="museum-kicker">{copy.kicker}</p>
          <h2>{copy.emptyTitle}</h2>
          <span>{copy.emptyBody}</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={activeFocus.kind === 'all' ? 'world-lens world-lens--all' : 'world-lens world-lens--focused'}
      aria-label="Cleveland international relationships"
    >
      <header className="world-lens__header">
        <div>
          <p className="world-lens__kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p>{copy.secondaryStatement}</p>
        </div>
        <div className="world-lens__summary" aria-label="World relationship summary">
          <span>{model.people.length} people</span>
          <span>{model.countries.length} places</span>
          <span>{activeFocus.kind === 'all' ? copy.instruction : activeFocus.label}</span>
        </div>
      </header>

      <main className="world-lens__field">
        <div className="world-map" aria-label="Abstract world field centered on Cleveland">
          <WorldMapSvg />
          <svg className="world-map__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {visibleCountries.map((country) => (
              <path
                className={activeFocus.kind === 'country' && activeFocus.country.id === country.id ? 'world-map__trajectory world-map__trajectory--active' : 'world-map__trajectory'}
                d={trajectoryPath(country.x, country.y)}
                key={`trajectory-${country.id}`}
              />
            ))}
          </svg>

          <button
            className="world-map__cleveland"
            style={pointStyle(clevelandPoint.x, clevelandPoint.y)}
            type="button"
            onClick={() => onFocusChange('')}
          >
            <span>CLEVELAND</span>
            <strong>{model.people.length}</strong>
          </button>

          {model.regions.map((region) => (
            <button
              aria-pressed={activeFocus.key === region.id}
              className={activeFocus.key === region.id ? 'world-region world-region--active' : 'world-region'}
              key={region.id}
              style={pointStyle(region.x, region.y)}
              type="button"
              onClick={() => onFocusChange(region.id)}
            >
              <span>{region.label}</span>
              <strong>{region.people.length}</strong>
            </button>
          ))}

          {visibleCountries.map((country) => (
            <button
              aria-pressed={activeFocus.kind === 'country' && activeFocus.country.id === country.id}
              className={activeFocus.kind === 'country' && activeFocus.country.id === country.id ? 'world-country world-country--active' : 'world-country'}
              key={country.id}
              style={pointStyle(country.x, country.y)}
              type="button"
              onClick={() => onFocusChange(country.id)}
            >
              <span>{country.label}</span>
              <strong>{country.people.length}</strong>
            </button>
          ))}

          {portraitAnchors.map(({ person, x, y }, index) => (
            <button
              className="world-person"
              data-transition-person={person.id}
              data-transition-role="world-portrait"
              key={`${activeFocus.key || 'world'}-${person.id}`}
              style={portraitStyle(x, y, index)}
              type="button"
              onClick={() => onSelect(person)}
            >
              <FallbackImage
                alt={person.imageAltText}
                className="world-person__image"
                fallbackClassName="world-person__fallback"
                fallbackLabel={initials(person.name)}
                loading={index < 4 ? 'eager' : undefined}
                src={person.primaryImageUrl}
              />
              <span>
                <strong>{person.name}</strong>
                <small>{person.classYear ? `Class of ${person.classYear}` : 'Class year unknown'}</small>
                <em>{personPlaceLabel(person, activeFocus)}</em>
              </span>
            </button>
          ))}
        </div>

        <aside className="world-lens__story" aria-live="polite" aria-label={`${activeFocus.label} context`}>
          <p className="museum-kicker">
            {activeFocus.kind === 'country'
              ? copy.activeCountryPrefix
              : activeFocus.kind === 'region'
                ? copy.activeRegionPrefix
                : copy.instruction}
          </p>
          <h3>{activeFocus.label}</h3>
          <p>{focusNarrative(activeFocus, copy)}</p>
          <div className="world-lens__storyMeta">
            <span>{activeFocus.people.length} {activeFocus.people.length === 1 ? 'person' : 'people'}</span>
            <span>{activeFocus.countries.length} {activeFocus.countries.length === 1 ? 'place' : 'places'}</span>
          </div>
          <div className="world-lens__storyPeople" aria-label={`${copy.peoplePrompt}: ${activeFocus.label}`}>
            {activeFocus.people.slice(0, 4).map((person) => (
              <button
                data-transition-person={person.id}
                data-transition-role="world-portrait"
                key={person.id}
                type="button"
                onClick={() => onSelect(person)}
              >
                <FallbackImage
                  alt={person.imageAltText}
                  className="world-lens__storyImage"
                  fallbackClassName="world-lens__storyFallback"
                  fallbackLabel={initials(person.name)}
                  src={person.primaryImageUrl}
                />
                <span>{person.name}</span>
              </button>
            ))}
          </div>
          <footer>{copy.sourceDisclosure}</footer>
        </aside>
      </main>

      <nav className="world-lens__controls" aria-label="World regions">
        <button
          aria-pressed={activeFocus.kind === 'all'}
          className={activeFocus.kind === 'all' ? 'world-lens__control world-lens__control--active' : 'world-lens__control'}
          type="button"
          onClick={() => onFocusChange('')}
        >
          <span>All Connections</span>
          <strong>{model.people.length}</strong>
        </button>
        {model.regions.map((region) => (
          <button
            aria-pressed={activeFocus.key === region.id}
            className={activeFocus.key === region.id ? 'world-lens__control world-lens__control--active' : 'world-lens__control'}
            key={`control-${region.id}`}
            type="button"
            onClick={() => onFocusChange(region.id)}
          >
            <span>{region.label}</span>
            <strong>{region.people.length}</strong>
          </button>
        ))}
      </nav>
    </section>
  );
}

function useWorldLensCopy() {
  const [copy, setCopy] = useState<WorldLensCopy>(fallbackCopy);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(worldLensCopyUrl, { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`World lens copy request failed: ${response.status}`);
        return response.json() as Promise<WorldCopyDocument>;
      })
      .then((document) => {
        writeCachedJson(worldLensCopyCacheKey, document);
        if (!cancelled) setCopy({ ...fallbackCopy, ...(document.copy ?? {}) });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || cancelled) return;
        const cached = readCachedJson(worldLensCopyCacheKey);
        if (isWorldCopyDocument(cached)) {
          runtimeLogger.warn('Using cached world lens copy after load failure.', { error: error.message });
          setCopy({ ...fallbackCopy, ...(cached.copy ?? {}) });
          return;
        }
        if (!cancelled) setCopy(fallbackCopy);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return copy;
}

function isWorldCopyDocument(value: unknown): value is WorldCopyDocument {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildWorldModel(inductees: Inductee[]): WorldModel {
  const references = inductees.flatMap((person) => geographyReferences(person));
  const peopleByCountry = new Map<string, GeoReference[]>();

  references.forEach((reference) => {
    const current = peopleByCountry.get(reference.country) ?? [];
    current.push(reference);
    peopleByCountry.set(reference.country, current);
  });

  const countries = Array.from(peopleByCountry.entries())
    .map(([country, countryReferences]) => {
      const people = uniquePeople(countryReferences.map((reference) => reference.person));
      const point = countryLayout[country] ?? fallbackCountryPoint(country, countryReferences[0]?.region ?? '');
      return {
        id: `country:${slugify(country)}`,
        label: country,
        region: countryReferences[0]?.region ?? '',
        x: point.x,
        y: point.y,
        people,
        references: countryReferences,
      };
    })
    .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label));

  const countriesByRegion = new Map<string, CountryNode[]>();
  countries.forEach((country) => {
    const current = countriesByRegion.get(country.region) ?? [];
    current.push(country);
    countriesByRegion.set(country.region, current);
  });

  const regions = Array.from(countriesByRegion.entries())
    .map(([region, regionCountries]) => {
      const point = regionLayout[region] ?? fallbackRegionPoint(region);
      return {
        id: `region:${slugify(region)}`,
        label: region,
        x: point.x,
        y: point.y,
        countries: regionCountries,
        people: uniquePeople(regionCountries.flatMap((country) => country.people)),
      };
    })
    .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label));

  return {
    references,
    countries,
    regions,
    people: uniquePeople(references.map((reference) => reference.person)),
  };
}

function geographyReferences(person: Inductee): GeoReference[] {
  const countries = person.countryTags.filter((country) => !internationalCountryExclusions.has(country));
  if (countries.length === 0 || !isPresentationReadyGeography(person)) return [];

  return countries.map((country) => ({
    person,
    country,
    region: countryRegion(country, person.region),
    note: person.countryTagsNote,
    source: person.countryTagsSource,
  }));
}

function isPresentationReadyGeography(person: Inductee) {
  if (!person.countryTagsNote || withheldSourceNotes.test(person.countryTagsNote)) return false;
  if (person.countryTagsSource === 'curated' || person.countryTagsSource === 'documented') return true;
  return presentationReadySourceNotes.test(person.countryTagsNote);
}

function resolveActiveFocus(model: WorldModel, focusKey: string, defaultLabel: string): ActiveFocus {
  const country = model.countries.find((item) => item.id === focusKey);
  if (country) {
    return {
      kind: 'country',
      key: country.id,
      label: country.label,
      x: country.x,
      y: country.y,
      people: country.people,
      countries: [country],
      country,
    };
  }

  const region = model.regions.find((item) => item.id === focusKey);
  if (region) {
    return {
      kind: 'region',
      key: region.id,
      label: region.label,
      x: region.x,
      y: region.y,
      people: region.people,
      countries: region.countries,
    };
  }

  return {
    kind: 'all',
    key: '',
    label: defaultLabel,
    x: clevelandPoint.x,
    y: clevelandPoint.y,
    people: model.people,
    countries: model.countries,
  };
}

function visibleCountryNodes(model: WorldModel, activeFocus: ActiveFocus) {
  const source = activeFocus.kind === 'country'
    ? activeFocus.countries
    : activeFocus.kind === 'region'
      ? activeFocus.countries.slice(0, maxVisibleCountries)
      : model.countries.slice(0, maxVisibleCountries);

  return source.map((country, index) => ({
    ...country,
    ...routeSlot(index, source.length, country.region),
  }));
}

function buildPortraitAnchors(activeFocus: ActiveFocus, visibleCountries: CountryNode[]): WorldPortraitAnchor[] {
  if (activeFocus.kind === 'all') {
    const seen = new Set<string>();
    const anchors: WorldPortraitAnchor[] = [];
    visibleCountries.forEach((country) => {
      const person = country.people.find((candidate) => !seen.has(candidate.id));
      if (person && anchors.length < maxPortraitsInField) {
        seen.add(person.id);
        anchors.push({ person, x: country.x, y: country.y });
      }
    });
    return anchors;
  }

  const focusPoint = activeFocus.kind === 'country' && visibleCountries[0]
    ? visibleCountries[0]
    : activeFocus;
  return activeFocus.people.slice(0, maxPortraitsInField).map((person) => ({
    person,
    x: focusPoint.x,
    y: focusPoint.y,
  }));
}

function focusNarrative(activeFocus: ActiveFocus, copy: WorldLensCopy) {
  if (activeFocus.kind === 'all') return copy.defaultFocusBody;
  if (activeFocus.kind === 'country') {
    return `${activeFocus.label} appears through ${activeFocus.people.length} ${activeFocus.people.length === 1 ? 'portrait' : 'portraits'} with structured CIHOF geographic references.`;
  }
  return `${activeFocus.label} appears through ${activeFocus.people.length} ${activeFocus.people.length === 1 ? 'portrait' : 'portraits'} and ${activeFocus.countries.length} ${activeFocus.countries.length === 1 ? 'place' : 'places'} connected back to Cleveland.`;
}

function personPlaceLabel(person: Inductee, activeFocus: ActiveFocus) {
  if (activeFocus.kind === 'country') return activeFocus.label;
  const countries = person.countryTags.filter((country) => !internationalCountryExclusions.has(country));
  if (activeFocus.kind === 'region') {
    const matching = countries.filter((country) => countryRegion(country, person.region) === activeFocus.label);
    return matching.slice(0, 2).join(' / ') || activeFocus.label;
  }
  return countries.slice(0, 2).join(' / ') || person.region;
}

function uniquePeople(people: Inductee[]) {
  const seen = new Set<string>();
  return people
    .filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    })
    .sort((a, b) => personPriority(b) - personPriority(a) || (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name));
}

function personPriority(person: Inductee) {
  return Number(person.featured) * 100 + Number(person.featuredCandidate) * 45 + person.attractPriority + Number(person.hasVideo) * 4;
}

function countryRegion(country: string, fallback: string) {
  if (country === 'Puerto Rico' || country === 'Mexico') return 'North America';
  if (country === 'Ethiopia' || country === 'Egypt') return 'Africa';
  if (['China', 'India', 'Japan', 'Lebanon', 'Russia', 'South Korea', 'Syria', 'Vietnam'].includes(country)) return 'Asia';
  return fallback || 'International';
}

function fallbackCountryPoint(country: string, region: string) {
  const point = regionLayout[region] ?? fallbackRegionPoint(region);
  const seed = hashValue(country);
  return {
    x: clamp(point.x + ((seed % 17) - 8) * 0.85, 8, 92),
    y: clamp(point.y + ((Math.floor(seed / 17) % 15) - 7) * 0.85, 12, 84),
  };
}

function fallbackRegionPoint(region: string) {
  const seed = hashValue(region || 'international');
  return {
    x: 18 + (seed % 64),
    y: 24 + (Math.floor(seed / 64) % 48),
  };
}

function routeSlot(index: number, total: number, region: string) {
  return routeSlotsGeneral[index % routeSlotsGeneral.length];
}

const routeSlotsGeneral = [
  { x: 35, y: 24 },
  { x: 63, y: 22 },
  { x: 80, y: 39 },
  { x: 76, y: 64 },
  { x: 56, y: 76 },
  { x: 31, y: 68 },
  { x: 23, y: 45 },
  { x: 45, y: 17 },
];

function pointStyle(x: number, y: number) {
  return {
    '--world-x': `${x}%`,
    '--world-y': `${y}%`,
  } as CSSProperties;
}

function portraitStyle(centerX: number, centerY: number, index: number) {
  const offset = portraitOffsets[index % portraitOffsets.length];
  return pointStyle(clamp(centerX + offset.x, 10, 89), clamp(centerY + offset.y, 17, 80));
}

function trajectoryPath(x: number, y: number) {
  const midX = (x + clevelandPoint.x) / 2;
  const midY = (y + clevelandPoint.y) / 2 - 8;
  return `M ${x} ${y} Q ${midX} ${midY} ${clevelandPoint.x} ${clevelandPoint.y}`;
}

function WorldMapSvg() {
  return (
    <svg className="world-map__svg" viewBox="0 0 1000 560" role="img" aria-label="Abstract world map">
      <path className="world-map__continent world-map__continent--north-america" d="M92 178 C140 92 248 82 326 136 C386 176 334 244 280 280 C216 322 134 292 102 242 C84 214 78 196 92 178 Z" />
      <path className="world-map__continent world-map__continent--south-america" d="M302 302 C360 326 390 390 374 468 C362 524 314 548 282 498 C250 448 244 376 270 322 C278 306 288 300 302 302 Z" />
      <path className="world-map__continent world-map__continent--europe" d="M458 142 C500 102 570 118 592 164 C612 210 560 236 510 218 C464 202 430 170 458 142 Z" />
      <path className="world-map__continent world-map__continent--africa" d="M520 238 C584 226 638 284 628 364 C620 434 566 490 512 444 C464 404 456 316 486 268 C496 250 506 242 520 238 Z" />
      <path className="world-map__continent world-map__continent--asia" d="M600 150 C704 92 856 132 910 228 C954 304 872 354 776 326 C706 306 650 276 612 230 C582 194 572 166 600 150 Z" />
      <path className="world-map__continent world-map__continent--australia" d="M792 392 C850 374 914 400 918 446 C922 488 842 498 790 462 C760 442 762 404 792 392 Z" />
      <path className="world-map__latitude" d="M52 280 C260 248 442 250 606 278 C760 304 876 294 950 262" />
      <path className="world-map__latitude" d="M70 370 C260 396 454 392 612 368 C752 346 866 358 936 398" />
      <path className="world-map__longitude" d="M250 72 C236 180 238 322 272 506" />
      <path className="world-map__longitude" d="M520 54 C500 190 508 366 548 526" />
      <path className="world-map__longitude" d="M762 78 C732 196 732 354 778 494" />
    </svg>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function hashValue(value: string) {
  return value.split('').reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
