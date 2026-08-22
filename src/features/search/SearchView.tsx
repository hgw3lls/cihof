import { useMemo, useState, type ReactNode } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { allValue } from '../../data/filtering';
import { countryCommunityOrRegionLabel } from '../../data/inducteeLabels';
import { portraitImageUrl } from '../../data/portraitImages';
import type { ExploreState, Inductee, PlaceRecord } from '../../data/types';
import { usePlaces } from '../../data/usePlaces';

type SearchViewProps = {
  inductees: Inductee[];
  facets: {
    regions: string[];
    countries: string[];
    years: number[];
    themes: string[];
  };
  loading: boolean;
  error: string;
  state: ExploreState;
  selectedId?: string;
  onStateChange: (state: Partial<ExploreState>) => void;
  onSelect: (inductee: Inductee) => void;
  onFindConnection: () => void;
};

type SearchMode = 'name' | 'country' | 'community' | 'organization' | 'place' | 'theme' | 'year' | 'profession' | 'story';

type SearchResult = {
  inductee: Inductee;
  reasons: string[];
  score: number;
};

type SearchFilters = {
  query: string;
  mode: SearchMode;
  country: string;
  community: string;
  organization: string;
  place: PlaceRecord | null;
  theme: string;
  year: string;
  profession: string;
  promptId: string;
};

const modes: Array<{ mode: SearchMode; label: string }> = [
  { mode: 'name', label: 'Name' },
  { mode: 'country', label: 'Country' },
  { mode: 'community', label: 'Community' },
  { mode: 'organization', label: 'Organization' },
  { mode: 'place', label: 'Place' },
  { mode: 'theme', label: 'Theme' },
  { mode: 'year', label: 'Year' },
  { mode: 'profession', label: 'Profession' },
  { mode: 'story', label: 'Story keyword' },
];

const promptOptions = [
  { id: 'new-arrivals', label: 'Helped New Arrivals', terms: ['immigrant', 'immigration', 'refugee', 'resettl', 'new arrival', 'newcomer', 'international services', 'helped people arrive'] },
  { id: 'business', label: 'Built A Business', terms: ['business', 'entrepreneur', 'founded', 'company', 'ceo', 'owner', 'corporation', 'enterprise'] },
  { id: 'justice', label: 'Fought For Justice', terms: ['justice', 'civil rights', 'rights', 'advocacy', 'attorney', 'law', 'legal', 'equity', 'activist'] },
  { id: 'art', label: 'Made Art', terms: ['art', 'artist', 'music', 'opera', 'orchestra', 'theater', 'theatre', 'dance', 'writer', 'poet'] },
  { id: 'teaching', label: 'Taught Others', terms: ['teacher', 'professor', 'education', 'school', 'university', 'college', 'taught', 'mentor'] },
  { id: 'culture', label: 'Preserved Culture', terms: ['culture', 'cultural', 'heritage', 'tradition', 'folk', 'language', 'garden', 'festival'] },
  { id: 'city-service', label: 'Served The City', terms: ['city', 'mayor', 'council', 'public service', 'civic', 'government', 'municipal'] },
  { id: 'institutions', label: 'Built Institutions', terms: ['founded', 'foundation', 'association', 'society', 'council', 'center', 'institute', 'organization'] },
  { id: 'medicine', label: 'Worked In Medicine', terms: ['medicine', 'medical', 'doctor', 'physician', 'hospital', 'clinic', 'health', 'nurse'] },
  { id: 'community', label: 'Organized Community', terms: ['community', 'organized', 'association', 'federation', 'club', 'council', 'committee', 'neighborhood'] },
];

const professionOptions = [
  { label: 'Business', terms: ['business', 'entrepreneur', 'ceo', 'company', 'bank', 'developer', 'owner'] },
  { label: 'Medicine', terms: ['doctor', 'physician', 'medical', 'medicine', 'hospital', 'clinic', 'health'] },
  { label: 'Education', terms: ['teacher', 'professor', 'educator', 'school', 'university', 'college'] },
  { label: 'Law', terms: ['law', 'attorney', 'judge', 'legal', 'court'] },
  { label: 'Arts', terms: ['artist', 'music', 'orchestra', 'opera', 'dance', 'theater', 'writer'] },
  { label: 'Civic Service', terms: ['mayor', 'council', 'civic', 'public service', 'city'] },
  { label: 'Faith Leadership', terms: ['bishop', 'reverend', 'father', 'pastor', 'priest', 'church', 'clergy'] },
  { label: 'Media', terms: ['newspaper', 'journalist', 'broadcast', 'radio', 'television', 'publisher'] },
  { label: 'Science', terms: ['science', 'scientist', 'research', 'engineer', 'technology'] },
  { label: 'Community Leadership', terms: ['community', 'leader', 'association', 'federation', 'organizer'] },
];

const keyboardRows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export function SearchView({
  inductees,
  facets,
  loading,
  error,
  state,
  selectedId = '',
  onStateChange,
  onSelect,
  onFindConnection,
}: SearchViewProps) {
  const { places } = usePlaces();
  const [mode, setMode] = useState<SearchMode>('name');
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [selectedProfession, setSelectedProfession] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('');

  const countryOptions = useMemo(() => rankedCountries(inductees, facets.countries).slice(0, 24), [facets.countries, inductees]);
  const communityOptions = useMemo(() => topValues(inductees.flatMap((item) => item.communityTags), 18), [inductees]);
  const themeOptions = useMemo(() => rankedThemes(inductees, facets.themes).slice(0, 20), [facets.themes, inductees]);
  const organizationOptions = useMemo(() => topOrganizations(inductees, places).slice(0, 18), [inductees, places]);
  const placeOptions = useMemo(() => places.slice(0, 14), [places]);
  const selectedPlace = placeOptions.find((place) => place.id === selectedPlaceId) ?? null;

  const filters: SearchFilters = {
    query: state.query.trim(),
    mode,
    country: state.country,
    community: selectedCommunity,
    organization: selectedOrganization,
    place: selectedPlace,
    theme: state.theme,
    year: state.year,
    profession: selectedProfession,
    promptId: selectedPromptId,
  };
  const activePrompt = promptOptions.find((prompt) => prompt.id === selectedPromptId) ?? null;
  const activeFilterCount = countActiveFilters(filters);
  const results = useMemo(
    () => searchInductees(inductees, places, filters).slice(0, 42),
    [filters.query, filters.mode, filters.country, filters.community, filters.organization, filters.place, filters.theme, filters.year, filters.profession, filters.promptId, inductees, places],
  );

  function updateQuery(query: string) {
    onStateChange({ query });
  }

  function clearAll() {
    setMode('name');
    setSelectedCommunity('');
    setSelectedOrganization('');
    setSelectedPlaceId('');
    setSelectedProfession('');
    setSelectedPromptId('');
    onStateChange({ query: '', country: allValue, theme: allValue, year: allValue });
  }

  function appendKey(key: string) {
    updateQuery(`${state.query}${key}`.replace(/^\s+/, ''));
  }

  return (
    <section className="touch-search" aria-label="Touchscreen search">
      <header className="touch-search__mast">
        <div>
          <p className="museum-kicker">Search The Portrait Wall</p>
          <h2>Search</h2>
        </div>
        <div className="touch-search__status">
          <span aria-live="polite">
            {loading && 'Loading'}
            {error && 'Data error'}
            {!loading && !error && `${results.length} results`}
          </span>
          <button type="button" onClick={onFindConnection}>Find A Connection</button>
          <button type="button" disabled={activeFilterCount === 0} onClick={clearAll}>Clear Search</button>
        </div>
      </header>

      <section className="touch-search__prompts" aria-label="Quick discovery prompts">
        <div>
          <p className="museum-kicker">I Want To Meet Someone Who...</p>
          {activePrompt && <span>{activePrompt.label}</span>}
        </div>
        <div className="touch-search__promptGrid">
          {promptOptions.map((prompt) => (
            <button
              className={selectedPromptId === prompt.id ? 'touch-search__prompt touch-search__prompt--active' : 'touch-search__prompt'}
              key={prompt.id}
              type="button"
              onClick={() => {
                setSelectedPromptId(selectedPromptId === prompt.id ? '' : prompt.id);
                setMode('story');
              }}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </section>

      <div className="touch-search__workspace">
        <aside className="touch-search__controls" aria-label="Search controls">
          <div className="touch-search__modeGrid" aria-label="Search categories">
            {modes.map((item) => (
              <button
                className={mode === item.mode ? 'touch-search__mode touch-search__mode--active' : 'touch-search__mode'}
                key={item.mode}
                type="button"
                onClick={() => setMode(item.mode)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="touch-search__input">
            <span>{inputLabel(mode)}</span>
            <input
              value={state.query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={inputPlaceholder(mode)}
              type="search"
            />
          </label>

          <OnScreenKeyboard
            disabled={mode === 'year'}
            onBackspace={() => updateQuery(state.query.slice(0, -1))}
            onClear={() => updateQuery('')}
            onKey={appendKey}
            onSpace={() => appendKey(' ')}
          />

          <QuickSelectors
            communityOptions={communityOptions}
            countryOptions={countryOptions}
            mode={mode}
            organizationOptions={organizationOptions}
            placeOptions={placeOptions}
            profession={selectedProfession}
            selectedCommunity={selectedCommunity}
            selectedOrganization={selectedOrganization}
            selectedPlaceId={selectedPlaceId}
            state={state}
            themeOptions={themeOptions}
            years={facets.years}
            onCommunity={(community) => setSelectedCommunity(selectedCommunity === community ? '' : community)}
            onOrganization={(organization) => setSelectedOrganization(selectedOrganization === organization ? '' : organization)}
            onPlace={(placeId) => setSelectedPlaceId(selectedPlaceId === placeId ? '' : placeId)}
            onProfession={(profession) => setSelectedProfession(selectedProfession === profession ? '' : profession)}
            onStateChange={onStateChange}
          />
        </aside>

        <section className="touch-results" aria-label="Search results">
          {loading && <div className="touch-results__empty">Loading portraits.</div>}
          {!loading && error && <div className="touch-results__empty">Data error: {error}</div>}
          {!loading && !error && results.length === 0 && <div className="touch-results__empty">No portraits match this search.</div>}
          {!loading && !error && results.map((result) => (
            <SearchResultRow
              key={result.inductee.id}
              result={result}
              selected={selectedId === result.inductee.id}
              onSelect={onSelect}
            />
          ))}
        </section>
      </div>
    </section>
  );
}

function OnScreenKeyboard({
  disabled,
  onBackspace,
  onClear,
  onKey,
  onSpace,
}: {
  disabled: boolean;
  onBackspace: () => void;
  onClear: () => void;
  onKey: (key: string) => void;
  onSpace: () => void;
}) {
  return (
    <div className={disabled ? 'touch-keyboard touch-keyboard--disabled' : 'touch-keyboard'} aria-label="On-screen keyboard">
      {keyboardRows.map((row) => (
        <div className="touch-keyboard__row" key={row.join('')}>
          {row.map((key) => (
            <button key={key} type="button" disabled={disabled} onClick={() => onKey(key)}>
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="touch-keyboard__row touch-keyboard__row--commands">
        <button type="button" disabled={disabled} onClick={onSpace}>Space</button>
        <button type="button" disabled={disabled} onClick={onBackspace}>Back</button>
        <button type="button" disabled={disabled} onClick={onClear}>Clear Text</button>
      </div>
    </div>
  );
}

function QuickSelectors({
  communityOptions,
  countryOptions,
  mode,
  organizationOptions,
  placeOptions,
  profession,
  selectedCommunity,
  selectedOrganization,
  selectedPlaceId,
  state,
  themeOptions,
  years,
  onCommunity,
  onOrganization,
  onPlace,
  onProfession,
  onStateChange,
}: {
  communityOptions: string[];
  countryOptions: string[];
  mode: SearchMode;
  organizationOptions: string[];
  placeOptions: PlaceRecord[];
  profession: string;
  selectedCommunity: string;
  selectedOrganization: string;
  selectedPlaceId: string;
  state: ExploreState;
  themeOptions: string[];
  years: number[];
  onCommunity: (community: string) => void;
  onOrganization: (organization: string) => void;
  onPlace: (placeId: string) => void;
  onProfession: (profession: string) => void;
  onStateChange: (state: Partial<ExploreState>) => void;
}) {
  if (mode === 'country') {
    return (
      <SelectorGroup label="Country">
        <button className={state.country === allValue ? 'touch-chip touch-chip--active' : 'touch-chip'} type="button" onClick={() => onStateChange({ country: allValue })}>All Countries</button>
        {countryOptions.map((country) => (
          <button className={state.country === country ? 'touch-chip touch-chip--active' : 'touch-chip'} key={country} type="button" onClick={() => onStateChange({ country })}>
            {country}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  if (mode === 'year') {
    return (
      <SelectorGroup label="Year">
        <button className={state.year === allValue ? 'touch-chip touch-chip--active' : 'touch-chip'} type="button" onClick={() => onStateChange({ year: allValue })}>All Years</button>
        {[...years].sort((a, b) => b - a).map((year) => (
          <button className={state.year === String(year) ? 'touch-chip touch-chip--active' : 'touch-chip'} key={year} type="button" onClick={() => onStateChange({ year: String(year) })}>
            {year}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  if (mode === 'theme') {
    return (
      <SelectorGroup label="Theme">
        <button className={state.theme === allValue ? 'touch-chip touch-chip--active' : 'touch-chip'} type="button" onClick={() => onStateChange({ theme: allValue })}>All Themes</button>
        {themeOptions.map((theme) => (
          <button className={state.theme === theme ? 'touch-chip touch-chip--active' : 'touch-chip'} key={theme} type="button" onClick={() => onStateChange({ theme })}>
            {theme}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  if (mode === 'community') {
    return (
      <SelectorGroup label="Community">
        {communityOptions.map((community) => (
          <button className={selectedCommunity === community ? 'touch-chip touch-chip--active' : 'touch-chip'} key={community} type="button" onClick={() => onCommunity(community)}>
            {community}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  if (mode === 'organization') {
    return (
      <SelectorGroup label="Organization">
        {organizationOptions.map((organization) => (
          <button className={selectedOrganization === organization ? 'touch-chip touch-chip--active' : 'touch-chip'} key={organization} type="button" onClick={() => onOrganization(organization)}>
            {organization}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  if (mode === 'place') {
    return (
      <SelectorGroup label="Place">
        {placeOptions.map((place) => (
          <button className={selectedPlaceId === place.id ? 'touch-chip touch-chip--active' : 'touch-chip'} key={place.id} type="button" onClick={() => onPlace(place.id)}>
            {place.name}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  if (mode === 'profession') {
    return (
      <SelectorGroup label="Profession">
        {professionOptions.map((option) => (
          <button className={profession === option.label ? 'touch-chip touch-chip--active' : 'touch-chip'} key={option.label} type="button" onClick={() => onProfession(option.label)}>
            {option.label}
          </button>
        ))}
      </SelectorGroup>
    );
  }

  return (
    <SelectorGroup label={mode === 'name' ? 'Name Starters' : 'Story Starters'}>
      {(mode === 'name' ? ['A', 'B', 'C', 'D', 'F', 'G', 'J', 'M', 'P', 'R', 'S', 'W'] : ['Migration', 'Leadership', 'Cultural Gardens', 'Education', 'Health', 'Advocacy', 'Festival', 'Foundation', 'Church', 'City Hall']).map((term) => (
        <button className={state.query.toLowerCase() === term.toLowerCase() ? 'touch-chip touch-chip--active' : 'touch-chip'} key={term} type="button" onClick={() => onStateChange({ query: term })}>
          {term}
        </button>
      ))}
    </SelectorGroup>
  );
}

function SelectorGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="touch-selector" aria-label={`${label} quick selectors`}>
      <p className="museum-kicker">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function SearchResultRow({
  result,
  selected,
  onSelect,
}: {
  result: SearchResult;
  selected: boolean;
  onSelect: (inductee: Inductee) => void;
}) {
  const { inductee, reasons } = result;
  const placeLabel = countryCommunityOrRegionLabel(inductee);

  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className={selected ? 'touch-result touch-result--selected' : 'touch-result'}
      type="button"
      onClick={() => onSelect(inductee)}
    >
      <span className="touch-result__portrait">
        <FallbackImage
          alt={inductee.imageAltText}
          className="touch-result__image"
          fallbackClassName="touch-result__fallback"
          fallbackLabel={initials(inductee.name)}
          src={portraitImageUrl(inductee, 'thumbnail')}
        />
      </span>
      <span className="touch-result__body">
        <span className="touch-result__name">{inductee.name}</span>
        <span className="touch-result__meta">
          {inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}
          {placeLabel && ` / ${placeLabel}`}
        </span>
        <span className="touch-result__summary">{inductee.storySummary || summarize(inductee.bioText)}</span>
        <span className="touch-result__reasons">
          {(reasons.length > 0 ? reasons : ['Suggested portrait']).slice(0, 3).map((reason) => (
            <small key={reason}>{reason}</small>
          ))}
        </span>
      </span>
    </button>
  );
}

function searchInductees(inductees: Inductee[], places: PlaceRecord[], filters: SearchFilters): SearchResult[] {
  const query = filters.query.toLowerCase();
  const queryTerms = query.split(/\s+/).filter(Boolean);
  const prompt = promptOptions.find((item) => item.id === filters.promptId);
  const profession = professionOptions.find((item) => item.label === filters.profession);

  return inductees
    .map((inductee) => {
      const reasons: string[] = [];
      let score = baseScore(inductee);
      const searchable = buildSearchableText(inductee, places);

      if (queryTerms.length > 0) {
        const matchedQuery = matchQuery(inductee, searchable, filters.mode, queryTerms);
        if (!matchedQuery) return null;
        reasons.push(queryReason(filters.mode));
        score += 40;
      }

      if (filters.country !== allValue) {
        if (!inductee.countryTags.includes(filters.country)) return null;
        reasons.push(`Country: ${filters.country}`);
        score += 38;
      }

      if (filters.community) {
        const community = filters.community.toLowerCase();
        if (!inductee.communityTags.some((tag) => tag.toLowerCase() === community) && !searchable.includes(community)) return null;
        reasons.push(`Community: ${filters.community}`);
        score += 36;
      }

      if (filters.organization) {
        const organization = filters.organization.toLowerCase();
        if (!searchable.includes(organization)) return null;
        reasons.push(`Organization: ${filters.organization}`);
        score += 34;
      }

      if (filters.place) {
        const placeTerms = [filters.place.name, filters.place.neighborhood, filters.place.address, ...(filters.place.related.organizations ?? [])]
          .filter((term): term is string => Boolean(term))
          .map((term) => term.toLowerCase());
        const directlyRelated = filters.place.related.people?.includes(inductee.id);
        if (!directlyRelated && !placeTerms.some((term) => searchable.includes(term))) return null;
        reasons.push(`Place: ${filters.place.name}`);
        score += directlyRelated ? 42 : 30;
      }

      if (filters.theme !== allValue) {
        if (!inductee.themeTags.includes(filters.theme)) return null;
        reasons.push(`Theme: ${filters.theme}`);
        score += 32;
      }

      if (filters.year !== allValue) {
        if (inductee.classYear !== Number(filters.year)) return null;
        reasons.push(`Class of ${filters.year}`);
        score += 30;
      }

      if (profession) {
        if (!profession.terms.some((term) => searchable.includes(term))) return null;
        reasons.push(`Profession: ${profession.label}`);
        score += 34;
      }

      if (prompt) {
        if (!prompt.terms.some((term) => searchable.includes(term))) return null;
        reasons.push(prompt.label);
        score += 38;
      }

      if (reasons.length === 0) {
        if (!(inductee.featured || inductee.featuredCandidate || inductee.attractPriority > 0)) return null;
        reasons.push('Featured starting point');
      }

      return { inductee, reasons, score };
    })
    .filter((result): result is SearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || sortYearThenName(a.inductee, b.inductee));
}

function matchQuery(inductee: Inductee, searchable: string, mode: SearchMode, terms: string[]) {
  if (mode === 'name') return terms.every((term) => inductee.name.toLowerCase().includes(term));
  if (mode === 'country') return terms.every((term) => inductee.countryTags.some((tag) => tag.toLowerCase().includes(term)) || searchable.includes(term));
  if (mode === 'community') return terms.every((term) => inductee.communityTags.some((tag) => tag.toLowerCase().includes(term)) || searchable.includes(term));
  if (mode === 'year') return terms.every((term) => String(inductee.classYear ?? '').includes(term));
  if (mode === 'theme') return terms.every((term) => inductee.themeTags.some((tag) => tag.toLowerCase().includes(term)) || searchable.includes(term));
  return terms.every((term) => searchable.includes(term));
}

function buildSearchableText(inductee: Inductee, places: PlaceRecord[]) {
  const relatedPlaceTerms = places
    .filter((place) => place.related.people?.includes(inductee.id))
    .flatMap((place) => [
      place.name,
      place.neighborhood,
      place.address,
      ...(place.related.communities ?? []),
      ...(place.related.organizations ?? []),
    ]);

  return [
    inductee.name,
    inductee.region,
    inductee.inductedBy,
    inductee.bioText,
    inductee.storySummary,
    ...inductee.storyHighlights,
    ...inductee.themeTags,
    ...inductee.countryTags,
    ...inductee.communityTags,
    ...relatedPlaceTerms,
    inductee.classYear ? String(inductee.classYear) : '',
    inductee.searchText,
  ].join(' ').toLowerCase();
}

function queryReason(mode: SearchMode) {
  const labels: Record<SearchMode, string> = {
    name: 'Name match',
    country: 'Country match',
    community: 'Community match',
    organization: 'Organization match',
    place: 'Place match',
    theme: 'Theme match',
    year: 'Year match',
    profession: 'Profession match',
    story: 'Story keyword',
  };
  return labels[mode];
}

function inputLabel(mode: SearchMode) {
  if (mode === 'story') return 'Story keyword';
  return `Search by ${modes.find((item) => item.mode === mode)?.label ?? 'keyword'}`;
}

function inputPlaceholder(mode: SearchMode) {
  const placeholders: Record<SearchMode, string> = {
    name: 'Tap letters or type a name',
    country: 'Tap a country or type one',
    community: 'Tap a community or type one',
    organization: 'Tap or type an organization',
    place: 'Tap or type a Cleveland place',
    theme: 'Tap a theme or type one',
    year: 'Select a class year below',
    profession: 'Tap or type a profession',
    story: 'Tap a prompt or type a story word',
  };
  return placeholders[mode];
}

function topValues(values: string[], limit: number) {
  const counts = new Map<string, number>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function rankedThemes(inductees: Inductee[], themes: string[]) {
  const counts = new Map<string, number>();
  inductees.flatMap((item) => item.themeTags).forEach((theme) => counts.set(theme, (counts.get(theme) ?? 0) + 1));
  return [...themes].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

function rankedCountries(inductees: Inductee[], countries: string[]) {
  const counts = new Map<string, number>();
  inductees.flatMap((item) => item.countryTags).forEach((country) => counts.set(country, (counts.get(country) ?? 0) + 1));
  return [...countries].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
}

function topOrganizations(inductees: Inductee[], places: PlaceRecord[]) {
  return topValues([
    ...places.flatMap((place) => place.related.organizations ?? []),
    ...inductees.flatMap((inductee) => extractOrganizations(inductee.bioText)),
  ], 30);
}

function extractOrganizations(text: string) {
  const organizationPattern = /\b([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,5}\s+(?:Foundation|Association|Society|Council|Center|Centre|Clinic|University|College|Orchestra|Opera|Museum|League|Institute|Hospital|Church|Federation|Club|School|Theatre|Theater|Board|Committee|Library))\b/g;
  return Array.from(text.matchAll(organizationPattern), (match) => match[1])
    .map((item) => item.trim())
    .filter((item, index, all) => item.length > 4 && all.indexOf(item) === index);
}

function countActiveFilters(filters: SearchFilters) {
  return [
    filters.query,
    filters.country !== allValue ? filters.country : '',
    filters.community,
    filters.organization,
    filters.place?.id,
    filters.theme !== allValue ? filters.theme : '',
    filters.year !== allValue ? filters.year : '',
    filters.profession,
    filters.promptId,
  ].filter(Boolean).length;
}

function baseScore(inductee: Inductee) {
  return Number(inductee.featured) * 18 + Number(inductee.featuredCandidate) * 12 + inductee.attractPriority + (inductee.hasVideo ? 1 : 0);
}

function sortYearThenName(a: Inductee, b: Inductee) {
  const yearA = a.classYear ?? 9999;
  const yearB = b.classYear ?? 9999;
  return yearB - yearA || a.name.localeCompare(b.name);
}

function summarize(text: string) {
  const sentence = text.match(/[^.!?]+[.!?]+/)?.[0]?.trim() ?? text.trim();
  if (sentence.length <= 190) return sentence;
  return `${sentence.slice(0, 190).trim()}...`;
}
