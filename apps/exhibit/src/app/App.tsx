import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { loadBundle, type RuntimeBundle } from '../data/runtime.ts';
import { exhibitReducer, initialState, type Lens } from '../state/exhibit.ts';
import { People } from './People.tsx';
import { Years } from './Years.tsx';
import { Links } from './Links.tsx';
import { Places } from './Places.tsx';
import { Record } from './Record.tsx';
import { Film } from './Film.tsx';
import { Recovery } from './Recovery.tsx';
import { Share } from './Share.tsx';
import { SessionWarning } from './SessionWarning.tsx';
import { configuredTiming, isTestBuild } from './config.ts';
import { nextAttractMode, readAttractSettings } from './attract-settings.ts';
import { Attract } from './Attract.tsx';
import { useRelease } from './useRelease.ts';
import { useSession } from './useSession.ts';
import './exhibit.css';

/**
 * Labels only. Which lenses exist is decided by the published bundle, so a
 * lens the content cannot support never reaches the navigation and the app has
 * no threshold of its own to disagree about.
 */
const lensLabels: Record<string, string> = {
  people: 'People',
  years: 'Years',
  links: 'Connections',
  places: 'Places',
};

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

  const people = bundle.people;
  const relationships = bundle.relationships;
  const places = bundle.places;
  const offered = bundle.lenses.length > 0 ? bundle.lenses : ['people'];
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
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
    // A reset is the agreed handover point: nobody is mid-sentence, so a waiting
    // release can take over without interrupting a visitor.
    release.activateWaitingRelease();
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-begin], #restart')?.focus());
  }, [release, attractSettings.rotate]);

  const session = useSession(configuredTiming, isTestBuild, restart, state.mode === 'explore');

  const select = (personId: string) => dispatch({ type: 'select', personId });
  const open = (personId: string) => dispatch({ type: 'open-record', personId });

  return (
    <>
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
          <div className={bundle.preview ? 'shell shell--preview' : 'shell'} data-lens={state.lens}>
            <header className="masthead">
              <h1>Cleveland International Hall of Fame</h1>
              <p>{contextLabel(state.lens, bundle)}</p>
            </header>

            <main className="body">
              {state.lens === 'places'
                ? (
                  <Places
                    places={places}
                    people={people}
                    selectedId={state.selectedId}
                    onSelect={select}
                    onOpen={open}
                  />
                )
                : state.lens === 'links'
                ? (
                  <Links
                    people={people}
                    relationships={relationships}
                    contexts={bundle.contexts ?? []}
                    candidates={bundle.candidates ?? []}
                    selectedId={state.selectedId}
                    onSelect={select}
                    onOpen={open}
                  />
                )
                : state.lens === 'years'
                ? (
                  <Years
                    people={people}
                    discovery={state.discovery}
                    selectedId={state.selectedId}
                    onSelect={select}
                    onOpen={open}
                  />
                )
                : (
                  <People
                    people={people}
                    discovery={state.discovery}
                    selectedId={state.selectedId}
                    onQuery={(query) => dispatch({ type: 'query', query })}
                    onFacet={(dimension, value) => dispatch({ type: 'facet', dimension, value })}
                    onYear={(year) => dispatch({ type: 'year', year })}
                    onClear={() => dispatch({ type: 'clear-discovery' })}
                    onSelect={select}
                    onOpen={open}
                  />
                )}
            </main>

            {/* Every control a visitor needs sits along the bottom, within reach. */}
            <nav className="lensbar" aria-label="Ways to explore">
              {offered.length > 1 && offered.map((lens) => (
                <button
                  key={lens}
                  type="button"
                  className="lensbar__lens"
                  data-lens={lens}
                  aria-current={state.lens === lens ? 'page' : undefined}
                  onClick={() => dispatch({ type: 'lens', lens: lens as Lens })}
                >
                  <span className="swatch" aria-hidden="true" />
                  {lensLabels[lens] ?? lens}
                </button>
              ))}
              <button id="restart" className="lensbar__restart" type="button" onClick={restart}>Start over</button>
            </nav>
          </div>
        )}

      {recordPerson && (
        <Record
          person={recordPerson}
          onClose={() => dispatch({ type: 'close-detail' })}
          {...(bundle.continuationBase
            ? { onShare: () => dispatch({ type: 'open-share', personId: recordPerson.id }) }
            : {})}
          onPlay={(filmId) => dispatch({ type: 'play-film', personId: recordPerson.id, filmId })}
          {...(offered.includes('links')
            ? { onConnections: () => { dispatch({ type: 'close-detail' }); dispatch({ type: 'lens', lens: 'links' }); } }
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
          onReset={restart}
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

/** What the header says about the lens in view, from the published counts. */
function contextLabel(lens: string, bundle: RuntimeBundle): string {
  if (lens === 'years') {
    const classes = new Set(bundle.people.flatMap((person) => (person.classYear === null ? [] : [person.classYear]))).size;
    return `Years · ${classes} ${classes === 1 ? 'class' : 'classes'}`;
  }
  if (lens === 'links') return 'Connections · documented relationships';
  if (lens === 'places') return `Places · ${bundle.places.length} ${bundle.places.length === 1 ? 'place' : 'places'}`;
  return `People · ${bundle.people.length} ${bundle.people.length === 1 ? 'inductee' : 'inductees'}`;
}
