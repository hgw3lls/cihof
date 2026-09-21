import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { loadBundle, type RuntimeBundle } from '../data/runtime.ts';
import { exhibitReducer, initialState } from '../state/exhibit.ts';
import { People } from './People.tsx';
import { Years } from './Years.tsx';
import { Record } from './Record.tsx';
import { Film } from './Film.tsx';
import { Share } from './Share.tsx';
import { SessionWarning } from './SessionWarning.tsx';
import { configuredTiming, isTestBuild } from './config.ts';
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
  const [state, dispatch] = useReducer(exhibitReducer, undefined, initialState);

  useEffect(() => {
    const controller = new AbortController();
    loadBundle(controller.signal)
      .then(setBundle)
      .catch((cause: Error) => { if (cause.name !== 'AbortError') setError(cause.message); });
    return () => controller.abort();
  }, []);

  const people = bundle?.people ?? [];
  const offered = bundle?.lenses ?? ['people'];
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const selected = state.selectedId ? byId.get(state.selectedId) ?? null : null;
  // The panel carries its own subject, so an open record always has someone to show.
  const recordPerson = state.detail.kind === 'record' ? byId.get(state.detail.personId) ?? null : null;
  const sharePerson = state.detail.kind === 'share' ? byId.get(state.detail.personId) ?? null : null;
  const playing = state.media.kind === 'film' ? byId.get(state.media.personId) ?? null : null;
  const playingFilm = playing && state.media.kind === 'film'
    ? playing.films.find((film) => film.id === state.media.filmId) ?? null
    : null;

  const release = useRelease();

  const restart = useCallback(() => {
    dispatch({ type: 'reset' });
    // A reset is the agreed handover point: nobody is mid-sentence, so a waiting
    // release can take over without interrupting a visitor.
    release.activateWaitingRelease();
    window.requestAnimationFrame(() => document.getElementById('restart')?.focus());
  }, [release]);

  const session = useSession(configuredTiming, isTestBuild, restart);

  if (error) {
    return (
      <div className="shell">
        <div className="stage">
          <div className="notice" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return <div className="shell"><div className="stage"><p className="notice" role="status">Loading the collection…</p></div></div>;
  }

  return (
    <div className="shell">
      <div className="bar">
        <h1>Cleveland International Hall of Fame</h1>
        {offered.length > 1 && (
          <nav className="lenses" aria-label="Ways to explore">
            {offered.map((lens) => (
              <button
                key={lens}
                type="button"
                aria-current={state.lens === lens ? 'page' : undefined}
                onClick={() => dispatch({ type: 'lens', lens })}
              >
                {lensLabels[lens] ?? lens}
              </button>
            ))}
          </nav>
        )}
        <span className="spacer" />
        <button id="restart" className="restart" type="button" onClick={restart}>Start over</button>
      </div>

      <div className="body">
        <aside className="focus" aria-label="Selected person">
          {selected
            ? (
              <>
                <h2>{selected.name}</h2>
                <p>{selected.classYear ? `Inducted ${selected.classYear}` : 'Induction year not recorded'}</p>
                <p>
                  <button
                    className="restart"
                    type="button"
                    style={{ marginTop: '1rem' }}
                    onClick={() => dispatch({ type: 'open-record', personId: selected.id })}
                  >
                    Read the record
                  </button>
                </p>
              </>
            )
            : <p className="prompt">Choose a portrait to begin. Every person here was recognised for a contribution to Greater Cleveland’s international communities.</p>}
        </aside>

        <div className="stage">
          {state.lens === 'years'
            ? (
              <Years
                people={people}
                discovery={state.discovery}
                selectedId={state.selectedId}
                onSelect={(personId) => dispatch({ type: 'select', personId })}
                onOpen={(personId) => dispatch({ type: 'open-record', personId })}
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
                onSelect={(personId) => dispatch({ type: 'select', personId })}
                onOpen={(personId) => dispatch({ type: 'open-record', personId })}
              />
            )}
        </div>
      </div>

      {recordPerson && (
        <Record
          person={recordPerson}
          onClose={() => dispatch({ type: 'close-detail' })}
          onShare={bundle.continuationBase ? () => dispatch({ type: 'open-share', personId: recordPerson.id }) : undefined}
          onPlay={(filmId) => dispatch({ type: 'play-film', personId: recordPerson.id, filmId })}
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

      {isTestBuild && <p className="testbuild">Test build — short session timings</p>}
    </div>
  );
}
