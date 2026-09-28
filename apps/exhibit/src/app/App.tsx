import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { loadBundle, type RuntimeBundle } from '../data/runtime.ts';
import { exhibitReducer, initialState, type Lens } from '../state/exhibit.ts';
import { connectionNodes, inductionClasses } from '../state/selectors.ts';
import { field, peopleLayout, railLetters, type Arrangement } from '../state/wall.ts';
import { Stage } from './Stage.tsx';
import { Wall } from './Wall.tsx';
import { PairSheet, PersonSheet } from './Sheet.tsx';
import { Years } from './Years.tsx';
import { Links } from './Links.tsx';
import { Places } from './Places.tsx';
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

  const people = bundle.people;
  const relationships = bundle.relationships;
  const contexts = bundle.contexts ?? [];
  const places = bundle.places;
  const offered = bundle.lenses.length > 0 ? bundle.lenses : ['people'];
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
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

  const select = (personId: string) => dispatch({ type: 'select', personId });
  const open = (personId: string) => dispatch({ type: 'open-record', personId });
  const toConnections = offered.includes('links')
    ? () => dispatch({ type: 'lens', lens: 'links' })
    : undefined;

  // The wall and the sheet belong to People for now; the other lenses keep
  // their own panels until they move onto the wall too.
  const onWall = state.lens === 'people';
  const selected = state.selectedId ? byId.get(state.selectedId) ?? null : null;
  const pair = state.pair ? state.pair.map((id) => byId.get(id)).filter((person) => person !== undefined) : [];
  const sheetOpen = onWall && (selected !== null || pair.length === 2);
  const width = sheetOpen ? field.widthWithSheet : field.width;
  const layout = useMemo(
    () => peopleLayout(people, state.arrangement, width, state.letter),
    [people, state.arrangement, width, state.letter],
  );
  const heading = onWall ? layout : lensHeading(state.lens, bundle, classes.length);

  const keys = offered.map((lens) => ({
    lens,
    label: lensLabels[lens] ?? lens,
    sub: lens === 'people' ? `${people.length} faces, all at once`
      : lens === 'years' ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`
      : lens === 'links' ? `follow a thread · ${places.length} places as a layer`
      : `${places.length} ${places.length === 1 ? 'place' : 'places'}`,
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
                {onWall
                  ? (
                    <Wall
                      people={people}
                      layout={layout}
                      width={width}
                      selectedId={state.selectedId}
                      pair={state.pair}
                      letters={letters}
                      letter={state.letter}
                      viewKey={state.lens}
                      onSelect={select}
                      onClear={() => dispatch({ type: 'clear-selection' })}
                      onPair={(personIds) => dispatch({ type: 'pair', personIds })}
                      onOpen={open}
                      onLetter={(letter) => dispatch({ type: 'letter', letter })}
                    />
                  )
                  : (
                    <div className="field field--panel">
                      {state.lens === 'places'
                        ? <Places places={places} people={people} selectedId={state.selectedId} onSelect={select} onOpen={open} />
                        : state.lens === 'links'
                        ? (
                          <Links
                            people={people}
                            relationships={relationships}
                            contexts={contexts}
                            candidates={bundle.candidates ?? []}
                            selectedId={state.selectedId}
                            onSelect={select}
                            onOpen={open}
                          />
                        )
                        : <Years people={people} selectedId={state.selectedId} onSelect={select} onOpen={open} />}
                    </div>
                  )}
              </main>

              {onWall && (
                <div className="chips" style={{ width }}>
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
                  : sheetOpen && selected
                  ? (
                    <PersonSheet
                      person={selected}
                      ties={tieCounts.get(selected.id) ?? 0}
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
          onClose={() => dispatch({ type: 'close-detail' })}
          {...(bundle.continuationBase
            ? { onShare: () => dispatch({ type: 'open-share', personId: recordPerson.id }) }
            : {})}
          onPlay={(filmId) => dispatch({ type: 'play-film', personId: recordPerson.id, filmId })}
          {...(toConnections
            ? { onConnections: () => { dispatch({ type: 'close-detail' }); toConnections(); } }
            : {})}
        />
      )}

      {playingFilm && playing && (
        <Film
          film={playingFilm}
          personName={playing.name}
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

/** The header for a lens not yet on the wall, from the published counts. */
function lensHeading(lens: string, bundle: RuntimeBundle, classes: number): { title: string; subtitle: string } {
  if (lens === 'years') return { title: 'Years', subtitle: `${classes} ${classes === 1 ? 'class' : 'classes'} · touch a year below` };
  if (lens === 'links') return { title: 'Connections', subtitle: 'touch anyone to bring them to the centre' };
  return { title: 'Places', subtitle: `${bundle.places.length} ${bundle.places.length === 1 ? 'place' : 'places'} in Greater Cleveland` };
}
