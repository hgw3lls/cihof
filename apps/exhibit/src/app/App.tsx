import { useCallback, useEffect, useMemo, useReducer, useState, type CSSProperties } from 'react';
import { loadBundle, type RuntimeBundle } from '../data/runtime.ts';
import { exhibitReducer, initialState, type Lens } from '../state/exhibit.ts';
import { connectionNodes, inductionClasses } from '../state/selectors.ts';
import { field, homeView, peopleLayout, railLetters, tourLayout, yearsLayout, type Arrangement, type View } from '../state/wall.ts';
import { Stage } from './Stage.tsx';
import { Wall } from './Wall.tsx';
import { PairSheet, PersonSheet, PlaceSheet, type TieLine } from './Sheet.tsx';
import { Trail } from './Trail.tsx';
import { ThreadEditor, TourChooser } from './Tours.tsx';
import { loadThreads, sameThread, saveThreads, threadLimit, threadName, type Thread } from './threads.ts';
import {
  diagramLayout, layer, layerCounts, layerOfTie, layers as linkLayers, nodesFor, placesLayout, tieWording,
  type LayerId,
} from '../state/connections.ts';
import { Search } from './Search.tsx';
import { useFilmWords } from './useFilmWords.ts';
import { buildIndex, search } from '../state/search.ts';
import { Record } from './Record.tsx';
import { Film } from './Film.tsx';
import { Recovery } from './Recovery.tsx';
import { Share } from './Share.tsx';
import { SessionWarning } from './SessionWarning.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';
import { applyTheme, readTheme, rememberTheme, type Theme } from './theme.ts';
import { configuredTiming, isTestBuild } from './config.ts';
import { nextAttractMode, readAttractSettings } from './attract-settings.ts';
import { Attract } from './Attract.tsx';
import { Lockup } from './Lockup.tsx';
import { useRelease } from './useRelease.ts';
import { useSession } from './useSession.ts';
import './exhibit.css';

/**
 * Which lenses exist is decided by the published bundle, so a lens the content
 * cannot support never reaches the navigation and the app has no threshold of
 * its own to disagree about. These are its words.
 */
const lensLabels: Record<string, string> = {
  people: 'People',
  years: 'Years',
  links: 'Connections',
  places: 'Places',
};

const arrangements: readonly (readonly [Arrangement, string])[] = [
  ['name', 'A to Z'],
  ['community', 'By community'],
  ['contribution', 'By contribution'],
];

export function App() {
  const [bundle, setBundle] = useState<RuntimeBundle | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    loadBundle(controller.signal)
      .then(setBundle)
      .catch((cause: Error) => { if (cause.name !== 'AbortError') setError(cause.message); });
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="shell shell--plain">
        <div className="notice" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return <div className="shell shell--plain"><p className="notice" role="status">Loading the collection…</p></div>;
  }

  return <Exhibit bundle={bundle} />;
}

/**
 * The exhibit once its content has arrived. Only an installed display has an
 * attract screen: a website visitor who opened the page is already exploring.
 */
function Exhibit({ bundle }: { bundle: RuntimeBundle }) {
  const [state, dispatch] = useReducer(exhibitReducer, bundle.target === 'kiosk' ? 'attract' : 'explore', initialState);
  const attractSettings = useMemo(() => readAttractSettings(window.location.search), []);
  const [attractMode, setAttractMode] = useState(attractSettings.mode);
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme ?? 'dark') as Theme);
  // The list of a person's films starts open; closed, it stays closed for the visit.
  const [filmListOpen, setFilmListOpen] = useState(true);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const people = bundle.people;
  const relationships = bundle.relationships;
  const contexts = bundle.contexts ?? [];
  const places = bundle.places;
  // Places is a layer of Connections now, not a lens of its own.
  const offered = (bundle.lenses.length > 0 ? bundle.lenses : ['people']).filter((lens) => lens !== 'places');
  const candidates = bundle.candidates ?? [];
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  // Saved threads outlive a visit: they are kept on the display for the next.
  const [threads, setThreadsState] = useState<Thread[]>(() => loadThreads(byId));
  const setThreads = (next: (current: Thread[]) => Thread[]) => setThreadsState((current) => {
    const updated = next(current).slice(0, threadLimit);
    saveThreads(updated);
    return updated;
  });
  const tours = bundle.tours ?? [];
  const classes = useMemo(() => inductionClasses(people), [people]);
  const letters = useMemo(() => railLetters(people), [people]);
  const tieCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of connectionNodes(people, relationships, [], contexts)) counts.set(node.person.id, node.ties.length);
    return counts;
  }, [people, relationships, contexts]);
  // The panel carries its own subject, so an open record always has someone to show.
  const recordPerson = state.detail.kind === 'record' ? byId.get(state.detail.personId) ?? null : null;
  const sharePerson = state.detail.kind === 'share' ? byId.get(state.detail.personId) ?? null : null;
  // Read the media once. Narrowing `state.media` does not survive into the
  // callback below, because the compiler cannot prove the property is unchanged
  // by the time it runs; a local const it can.
  const media = state.media;
  const playing = media.kind === 'film' ? byId.get(media.personId) ?? null : null;
  const playingFilm = playing && media.kind === 'film'
    ? playing.films.find((film) => film.id === media.filmId) ?? null
    : null;

  const release = useRelease();
  // Operator surface, opened by an explicit address. Read-only except for
  // returning to the previous release; it cannot change what content says.
  const [recoveryOpen, setRecoveryOpen] = useState(
    () => new URLSearchParams(window.location.search).get('recovery') === '1',
  );

  const restart = useCallback(() => {
    dispatch({ type: 'reset' });
    setFilmListOpen(true);
    setChooserOpen(false);
    setEditingId(null);
    // Rotating shows a different attract screen each time the display goes idle.
    if (attractSettings.rotate) setAttractMode(nextAttractMode);
    // On the display a visitor's colours last for their visit; the next visitor
    // meets the colours the admin chose.
    if (bundle.target === 'kiosk') {
      const chosen = readTheme(window.location.search, bundle.target);
      applyTheme(chosen);
      setTheme(chosen);
    }
    // A reset is the agreed handover point: nobody is mid-sentence, so a waiting
    // release can take over without interrupting a visitor.
    release.activateWaitingRelease();
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-begin], #restart')?.focus());
  }, [release, attractSettings.rotate, bundle.target]);

  const session = useSession(configuredTiming, isTestBuild, restart, state.mode === 'explore');

  // Search. The films' words are read the first time it opens.
  const [searched, setSearched] = useState(false);
  useEffect(() => { if (state.search.open) setSearched(true); }, [state.search.open]);
  const filmWords = useFilmWords(people, searched);
  const index = useMemo(
    () => buildIndex({ people, places, relationships, contexts, films: filmWords.films }),
    [people, places, relationships, contexts, filmWords.films],
  );
  const results = useMemo(() => search(index, state.search.query), [index, state.search.query]);
  const suggestions = useMemo(() => {
    // Starting points from the collection itself: its largest community and
    // contribution, its newest class, and its best-connected place.
    const largest = (dimension: 'communities' | 'contributions') => {
      const counts = new Map<string, number>();
      for (const person of people) for (const value of person[dimension]) counts.set(value, (counts.get(value) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    };
    const place = places.slice().sort((a, b) => (b.personIds?.length ?? 0) - (a.personIds?.length ?? 0))[0]?.name;
    return [largest('communities'), largest('contributions'), classes[0] ? String(classes[0].year) : undefined, place]
      .filter((value): value is string => Boolean(value));
  }, [people, places, classes]);
  const closeSearch = () => {
    const query = state.search.query.trim();
    dispatch({
      type: 'close-search',
      spotlight: query && results.people.length > 0 ? { label: `“${query}”`, personIds: results.people.map((hit) => hit.person.id) } : null,
    });
  };

  const select = (personId: string) => dispatch({ type: 'select', personId });
  const open = (personId: string) => dispatch({ type: 'open-record', personId });
  const toConnections = offered.includes('links')
    ? () => dispatch({ type: 'lens', lens: 'links' })
    : undefined;

  // Every lens is the wall, arranged another way.
  const linking = state.lens === 'links';
  const yearsShown = state.lens === 'years';
  const searching = state.lens === 'people' && state.search.open;
  const selected = state.selectedId ? byId.get(state.selectedId) ?? null : null;
  const focusPlace = linking && state.placeId ? places.find((place) => place.id === state.placeId) ?? null : null;
  const pair = state.pair ? state.pair.map((id) => byId.get(id)).filter((person) => person !== undefined) : [];
  const sheetOpen = !searching && (selected !== null || pair.length === 2 || focusPlace !== null);
  const width = searching ? field.widthWithSearch : sheetOpen ? field.widthWithSheet : field.width;
  // Faces lit on the wall: the people a search is finding as it is typed, or
  // those it found once it is closed.
  const lit = useMemo(() => {
    if (searching) return state.search.query.trim() ? new Set(results.people.map((hit) => hit.person.id)) : null;
    return state.spotlight ? new Set(state.spotlight.personIds) : null;
  }, [searching, state.search.query, results, state.spotlight]);
  const on = useMemo(() => new Set<LayerId>(state.linkLayers), [state.linkLayers]);
  // Connections is arranged for the zoom and pan the visitor has, so it is a
  // function of the view the wall hands it.
  const linksAt = useCallback((view: View) => {
    const input = { people, relationships, contexts, candidates, places, on, width };
    return state.linkView === 'places'
      ? placesLayout({ ...input, selectedId: state.selectedId })
      : diagramLayout({
        ...input, focusId: state.selectedId, placeId: state.placeId, view,
        keepClear: { top: state.trail.length > 1 ? 64 : 0, right: 84 },
      });
  }, [people, relationships, contexts, candidates, places, on, width, state.linkView, state.selectedId, state.placeId, state.trail.length]);
  const years = useMemo(() => yearsLayout(people, width, state.year, state.selectedId), [people, width, state.year, state.selectedId]);
  const touring = state.lens === 'people' ? state.tour : null;
  const layout = useMemo(
    () => (linking ? linksAt(homeView)
      : yearsShown ? years
      : touring ? tourLayout(people, touring.personIds, touring.label, width)
      : peopleLayout(people, state.arrangement, width, state.letter, lit, !searching)),
    [linking, linksAt, yearsShown, years, touring, people, state.arrangement, width, state.letter, lit, searching],
  );
  // What joins two people in a thread, as the records word it.
  const allNodes = useMemo(() => nodesFor({ people, relationships, contexts, candidates: [], on: new Set(linkLayers.map((each) => each.id)) }), [people, relationships, contexts]);
  const link = (from: string, to: string) => {
    const tie = allNodes.find((node) => node.person.id === from)?.ties.find((each) => each.other.id === to);
    if (tie) return { text: tieWording(tie), color: layer(layerOfTie(tie)).stroke };
    const place = places.find((each) => (each.personIds ?? []).includes(from) && (each.personIds ?? []).includes(to));
    return place ? { text: `both tied to ${place.name}`, color: 'var(--places-ink)' } : { text: 'no documented tie to the one before', color: 'var(--muted)' };
  };
  const trailSaved = threads.some((thread) => sameThread(thread.personIds, state.trail));
  const saveTrail = () => {
    if (state.trail.length < 2 || trailSaved) return;
    const walked = state.trail.map((id) => byId.get(id)).filter((person) => person !== undefined);
    setThreads((current) => [{ id: `t${Date.now().toString(36)}`, name: threadName(walked), personIds: [...state.trail], created: new Date().toISOString() }, ...current]);
  };
  const editing = editingId ? threads.find((thread) => thread.id === editingId) ?? null : null;
  const updateThread = (id: string, personIds: readonly string[]) => setThreads((current) => current.map((thread) => (thread.id === id
    ? { ...thread, personIds, name: threadName(personIds.map((each) => byId.get(each)).filter((person) => person !== undefined)) }
    : thread)));
  const follow = (thread: Thread) => {
    setChooserOpen(false);
    setEditingId(null);
    dispatch({ type: 'start-tour', tour: { id: `thread:${thread.id}`, label: thread.name, prompt: 'Thread', description: 'A thread followed through the Hall, one tie at a time.', personIds: thread.personIds } });
  };
  const counts = useMemo(() => layerCounts({ relationships, contexts, candidates, places }), [relationships, contexts, candidates, places]);
  // A person's ties in Connections, as the sheet lists them: their places,
  // who presented them when that was not somebody in the hall, then everybody
  // their ties reach, those who welcomed them in first.
  const tieLines = useMemo((): TieLine[] => {
    if (!linking || !selected) return [];
    const theirPlaces = places.filter((place) => (place.personIds ?? []).includes(selected.id));
    const node = nodesFor({ people, relationships, contexts, candidates, on }).find((each) => each.person.id === selected.id);
    return [
      ...theirPlaces.map((place) => ({
        key: place.id, name: place.name, place: true, color: 'var(--places-ink)',
        label: `Tied to this place · ${Math.max(0, (place.personIds ?? []).length - 1)} others here`,
        onClick: () => dispatch({ type: 'place', placeId: place.id }),
      })),
      ...(selected.presentedBy && !selected.presentedBy.inducteeId
        ? [{ key: 'presented', name: selected.presentedBy.recordedName, label: 'Presented them to the Hall', color: 'var(--muted)' }]
        : []),
      ...(node?.ties ?? []).slice()
        .sort((a, b) => (layerOfTie(a) === 'inducted' ? 0 : 1) - (layerOfTie(b) === 'inducted' ? 0 : 1))
        .map((tie) => ({
          key: tie.connectionId, name: tie.other.name, person: tie.other, label: tieWording(tie), color: layer(layerOfTie(tie)).stroke,
          onClick: () => select(tie.other.id),
        })),
    ];
  }, [linking, selected, places, people, relationships, contexts, candidates, on]);
  // "Next story" walks the wall in the order it is arranged in now.
  const nextAfter = (personId: string) => {
    const order = layout.order;
    const at = order.indexOf(personId);
    const id = order[(at + 1) % order.length];
    return id && id !== personId ? byId.get(id) ?? null : null;
  };
  const heading = searching
    ? { title: 'Search', subtitle: 'names, stories, places, and what is said in the films' }
    : touring
      ? { title: touring.label, subtitle: touring.description }
      : state.lens === 'people' && state.spotlight
      ? { title: layout.title, subtitle: `${state.spotlight.personIds.length} of ${people.length} lit for ${state.spotlight.label}` }
      : layout;

  const keys = offered.map((lens) => ({
    lens,
    label: lensLabels[lens] ?? lens,
    sub: lens === 'people' ? `${people.length} faces, all at once`
      : lens === 'years' ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`
      : `follow a thread · ${places.length} places as a layer`,
  }));

  return (
    <>
      <Stage>
        {state.mode === 'attract'
          ? (
            <Attract
              people={people}
              mode={attractMode}
              spotlightMs={attractSettings.spotlightMs}
              motion={attractSettings.motion}
              text={bundle.attract ?? null}
              onBegin={() => dispatch({ type: 'begin' })}
              onBeginWith={(personId) => dispatch({ type: 'begin-with', personId })}
            />
          )
          : (
            <div className="shell" data-lens={state.lens}>
              <header className="masthead">
                <Lockup />
                <h1>{heading.title}</h1>
                <p>{heading.subtitle}</p>
              </header>

              <main>
                    <Wall
                      people={people}
                      layout={linking ? linksAt : layout}
                      width={width}
                      mode={linking ? 'map' : 'wall'}
                      onPlace={(placeId) => dispatch({ type: 'place', placeId })}
                      overlay={yearsShown
                        ? (
                          <div className="years__year" aria-hidden="true">
                            <p>Class of</p>
                            <p>{years.year}</p>
                          </div>
                        )
                        : linking && state.linkView === 'diagram'
                        ? (
                          <Trail
                            people={state.trail.map((id) => byId.get(id)).filter((person) => person !== undefined)}
                            note={selected?.presentedBy && !selected.presentedBy.inducteeId ? `Presented to the Hall by ${selected.presentedBy.recordedName}.` : ''}
                            saved={trailSaved}
                            onStep={select}
                            onSave={saveTrail}
                          />
                        )
                        : null}
                      selectedId={state.selectedId}
                      pair={state.pair}
                      letters={letters}
                      letter={state.letter}
                      viewKey={`${state.lens}:${state.linkView}`}
                      onSelect={select}
                      onClear={() => dispatch({ type: 'clear-selection' })}
                      onPair={(personIds) => dispatch({ type: 'pair', personIds })}
                      onOpen={open}
                      onLetter={(letter) => dispatch({ type: 'letter', letter })}
                    />
              </main>

              {yearsShown && (
                <div className="chips" style={{ width }}>
                  <nav className="years__strip" aria-label="Induction classes">
                    {classes.map((entry) => (
                      <button
                        key={entry.year}
                        type="button"
                        aria-current={entry.year === years.year ? 'true' : undefined}
                        onClick={() => dispatch({ type: 'year', year: entry.year })}
                      >
                        {entry.year}
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {linking && (
                <div className="chips" style={{ width }}>
                  {linkLayers.filter((each) => each.id !== 'proposed' || candidates.length > 0).map((each) => {
                    // "Same place" is the way into the city by place, as well as a layer.
                    const pressed = each.id === 'places' ? state.linkView === 'places' : state.linkLayers.includes(each.id);
                    return (
                      <button
                        key={each.id}
                        type="button"
                        className="chip chip--layer"
                        aria-pressed={pressed}
                        style={{ '--layer': each.stroke } as CSSProperties}
                        onClick={() => (each.id === 'places'
                          ? dispatch({ type: 'link-view', view: state.linkView === 'places' ? 'diagram' : 'places' })
                          : dispatch({ type: 'link-layer', layer: each.id }))}
                      >
                        <span className="chip__swatch" data-dash={each.dash === 'none' ? undefined : 'true'} aria-hidden="true" />
                        {each.label}
                        <span className="chip__count">{counts[each.id]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {touring && (
                <div className="chips" style={{ width }}>
                  <p className="chips__note">{touring.prompt} · {state.tourStep + 1} of {touring.personIds.length}</p>
                  <span className="chips__tour">
                    <button type="button" className="chip" disabled={state.tourStep === 0} onClick={() => dispatch({ type: 'tour-step', step: state.tourStep - 1 })}>Previous</button>
                    <button
                      type="button"
                      className="chip chip--next"
                      onClick={() => dispatch({ type: 'tour-step', step: state.tourStep >= touring.personIds.length - 1 ? 0 : state.tourStep + 1 })}
                    >
                      {state.tourStep >= touring.personIds.length - 1 ? 'Back to the start' : 'Next person →'}
                    </button>
                    <button type="button" className="chip chip--quiet" onClick={() => dispatch({ type: 'end-tour' })}>End tour</button>
                  </span>
                </div>
              )}

              {state.lens === 'people' && !touring && (
                <div className="chips" style={{ width }}>
                  {state.spotlight && !searching && (
                    <button type="button" className="chip chip--lit" onClick={() => dispatch({ type: 'clear-spotlight' })} aria-label={`Clear ${state.spotlight.label}`}>
                      {state.spotlight.label} · {state.spotlight.personIds.length}
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                  {arrangements.map(([arrangement, label]) => (
                    <button
                      key={arrangement}
                      type="button"
                      className="chip"
                      aria-pressed={state.arrangement === arrangement}
                      onClick={() => dispatch({ type: 'arrange', arrangement })}
                    >
                      {label}
                    </button>
                  ))}
                  <p className="chips__note">
                    {state.arrangement === 'name'
                      ? 'Hold a face to peek · pull one down to open · pinch to zoom · two fingers on two faces to compare'
                      : 'Pull a face down to open it · pinch to zoom'}
                  </p>
                </div>
              )}

              <aside className="sheet sheet--search" data-open={searching ? 'true' : undefined} aria-hidden={!searching}>
                {searching && (
                  <Search
                    query={state.search.query}
                    results={results}
                    gatheringFilms={filmWords.gathering}
                    suggestions={suggestions}
                    onQuery={(query) => dispatch({ type: 'search-query', query })}
                    onPerson={(personId) => {
                      // The others it found stay lit behind the person chosen.
                      closeSearch();
                      select(personId);
                    }}
                    onGroup={(hit) => dispatch({
                      type: 'close-search',
                      spotlight: { label: hit.label, personIds: hit.people.map((person) => person.id) },
                    })}
                    onPlace={(place) => dispatch({ type: 'place', placeId: place.id })}
                    onFilm={(hit) => dispatch({ type: 'play-film', personId: hit.person.id, filmId: hit.filmId, at: hit.at })}
                    onClose={closeSearch}
                  />
                )}
              </aside>

              <aside className="sheet" data-open={sheetOpen ? 'true' : undefined} aria-label={sheetOpen ? 'Chosen' : undefined} aria-hidden={!sheetOpen}>
                {sheetOpen && pair.length === 2
                  ? (
                    <PairSheet
                      a={pair[0]!}
                      b={pair[1]!}
                      relationships={relationships}
                      contexts={contexts}
                      onOpen={open}
                      onClose={() => dispatch({ type: 'clear-selection' })}
                    />
                  )
                  : sheetOpen && focusPlace
                  ? (
                    <PlaceSheet
                      place={focusPlace}
                      people={(focusPlace.personIds ?? []).map((id) => byId.get(id)).filter((person) => person !== undefined)}
                      onPerson={select}
                      onClose={() => dispatch({ type: 'clear-selection' })}
                    />
                  )
                  : sheetOpen && selected
                  ? (
                    <PersonSheet
                      person={selected}
                      ties={tieCounts.get(selected.id) ?? 0}
                      {...(linking ? { tieLines } : {})}
                      onClose={() => dispatch({ type: 'clear-selection' })}
                      onStory={() => open(selected.id)}
                      onFilm={() => {
                        const first = selected.films[0];
                        if (first) dispatch({ type: 'play-film', personId: selected.id, filmId: first.id });
                      }}
                      {...(toConnections ? { onConnections: toConnections } : {})}
                    />
                  )
                  : null}
              </aside>

              {/* Every control a visitor needs sits along the bottom, within reach. */}
              <nav className="lensbar" aria-label="Ways to explore">
                {keys.length > 1 && keys.map((key) => (
                  <button
                    key={key.lens}
                    type="button"
                    className="lensbar__lens"
                    data-lens={key.lens}
                    aria-current={state.lens === key.lens ? 'page' : undefined}
                    onClick={() => dispatch({ type: 'lens', lens: key.lens as Lens })}
                  >
                    <span className="lensbar__label">{key.label}</span>
                    <span className="lensbar__sub">{key.sub}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="lensbar__search"
                  aria-pressed={searching}
                  onClick={() => (searching ? closeSearch() : dispatch({ type: 'open-search' }))}
                >
                  <span className="lensbar__label">Search</span>
                  <span className="lensbar__sub">names, stories, places{bundle.target === 'kiosk' ? ', films' : ''}</span>
                </button>
                <button
                  type="button"
                  className="lensbar__tour"
                  aria-pressed={Boolean(touring)}
                  onClick={() => setChooserOpen(true)}
                >
                  <span className="lensbar__label">Tour</span>
                  <span className="lensbar__sub">{touring ? touring.label : `${tours.length} curated · ${threads.length} followed`}</span>
                </button>
                <ThemeSwitch
                  theme={theme}
                  onChoose={(next) => {
                    applyTheme(next);
                    // A visitor's own device keeps their choice; the display does not.
                    if (bundle.target === 'public') rememberTheme(next);
                    setTheme(next);
                  }}
                />
                <button id="restart" className="lensbar__restart" type="button" onClick={restart}>Start over</button>
              </nav>
            </div>
          )}
      </Stage>

      {recordPerson && (
        <Record
          person={recordPerson}
          next={nextAfter(recordPerson.id)}
          ties={tieCounts.get(recordPerson.id) ?? 0}
          onClose={() => dispatch({ type: 'close-detail' })}
          onNext={open}
          {...(bundle.continuationBase
            ? { onShare: () => dispatch({ type: 'open-share', personId: recordPerson.id }) }
            : {})}
          onPlay={(filmId) => dispatch({ type: 'play-film', personId: recordPerson.id, filmId })}
          {...(toConnections
            ? { onConnections: () => { dispatch({ type: 'close-detail' }); toConnections(); } }
            : {})}
        />
      )}

      {chooserOpen && !editing && (
        <TourChooser
          tours={tours}
          threads={threads}
          byId={byId}
          onStart={(tour) => { setChooserOpen(false); dispatch({ type: 'start-tour', tour }); }}
          onFollow={follow}
          onEdit={(thread) => setEditingId(thread.id)}
          onClose={() => setChooserOpen(false)}
        />
      )}

      {editing && (
        <ThreadEditor
          thread={editing}
          byId={byId}
          link={link}
          onMove={(index, by) => {
            const ids = [...editing.personIds];
            [ids[index], ids[index + by]] = [ids[index + by]!, ids[index]!];
            updateThread(editing.id, ids);
          }}
          onRemove={(index) => updateThread(editing.id, editing.personIds.filter((_, at) => at !== index))}
          onDelete={() => { setThreads((current) => current.filter((thread) => thread.id !== editing.id)); setEditingId(null); }}
          onFollow={() => follow(editing)}
          onClose={() => setEditingId(null)}
        />
      )}

      {playingFilm && playing && (
        <Film
          person={playing}
          film={playingFilm}
          {...(media.kind === 'film' && media.at !== undefined ? { startAt: media.at } : {})}
          onChoose={(filmId) => dispatch({ type: 'play-film', personId: playing.id, filmId })}
          listOpen={filmListOpen}
          onList={setFilmListOpen}
          onClose={() => dispatch({ type: 'stop-film' })}
          onProgress={session.noteActivity}
        />
      )}

      {sharePerson && (
        <Share
          person={sharePerson}
          siteBase={bundle.continuationBase}
          onClose={() => dispatch({ type: 'open-record', personId: sharePerson.id })}
        />
      )}

      {session.phase === 'warning' && (
        <SessionWarning
          secondsRemaining={session.secondsRemaining}
          onContinue={session.noteActivity}
          onReset={session.startOver}
        />
      )}

      {recoveryOpen && (
        <Recovery
          status={release.status}
          onRefresh={release.refreshStatus}
          onRestore={release.restorePrevious}
          onClose={() => setRecoveryOpen(false)}
        />
      )}

      {isTestBuild && <p className="testbuild">Test build — short session timings</p>}
      {bundle.preview && (
        <p className="previewbuild" role="status">
          Editor preview — includes unreviewed places and proposed ties. Not for visitors.
        </p>
      )}
    </>
  );
}
