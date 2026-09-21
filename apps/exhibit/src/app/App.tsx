import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { loadBundle, type RuntimeBundle } from '../data/runtime.ts';
import { exhibitReducer, initialState } from '../state/exhibit.ts';
import { People } from './People.tsx';
import { Record } from './Record.tsx';
import './exhibit.css';

const lenses = [{ id: 'people', label: 'People' }] as const;

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
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const selected = state.selectedId ? byId.get(state.selectedId) ?? null : null;
  // The panel carries its own subject, so an open record always has someone to show.
  const recordPerson = state.detail.kind === 'record' ? byId.get(state.detail.personId) ?? null : null;

  const restart = useCallback(() => {
    dispatch({ type: 'reset' });
    window.requestAnimationFrame(() => document.getElementById('restart')?.focus());
  }, []);

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
        <nav className="lenses" aria-label="Ways to explore">
          {lenses.map((lens) => (
            <button
              key={lens.id}
              type="button"
              aria-current={state.lens === lens.id ? 'page' : undefined}
              onClick={() => dispatch({ type: 'lens', lens: lens.id })}
            >
              {lens.label}
            </button>
          ))}
        </nav>
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
        </div>
      </div>

      {recordPerson && <Record person={recordPerson} onClose={() => dispatch({ type: 'close-detail' })} />}
    </div>
  );
}
