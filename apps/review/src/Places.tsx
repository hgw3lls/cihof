import { useMemo, useState } from 'react';
import { tieKey, type Draft, type Place, type Review } from './api.ts';
import { placeNeedsWork } from './App.tsx';
import { Choice } from './Connections.tsx';
import { Portrait } from './Portrait.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * The places, one at a time: first whether to show the place, then what each
 * person did there. A place with nobody's history written for it cannot be
 * shown, and says so rather than offering a choice that would be refused.
 */
export function Places({ review, draft, update, onDone }: Props) {
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(
    () => review.places.filter((place) => showAll || placeNeedsWork(place, draft) || isTouched(place, draft)),
    // The list is fixed while the reviewer works through it, so finishing a
    // place does not make it vanish from under them.
    [review.places, showAll],
  );
  const [index, setIndex] = useState(0);
  const place = list[Math.min(index, list.length - 1)];

  if (!place) {
    return (
      <main className="page page--narrow">
        <h1>Places</h1>
        <p className="lead">Nothing is left to decide about places.</p>
        <button type="button" onClick={() => setShowAll(true)}>Look at every place</button>{' '}
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </main>
    );
  }

  const approve = (value: boolean | undefined) => update((current) => {
    const places = { ...current.places };
    if (value === undefined) delete places[place.placeId]; else places[place.placeId] = { approve: value };
    return { ...current, places };
  });
  const setRole = (personId: string, role: string | undefined) => update((current) => {
    const placeTies = { ...current.placeTies };
    const key = tieKey(place.placeId, personId);
    if (role) placeTies[key] = { role }; else delete placeTies[key];
    return { ...current, placeTies };
  });

  const approval = draft.places[place.placeId]?.approve;

  return (
    <main className="page">
      <div className="steps">
        <h1>Places</h1>
        <p className="quiet">
          {index + 1} of {list.length} ·{' '}
          <label className="inline">
            <input type="checkbox" checked={showAll} onChange={(event) => { setShowAll(event.target.checked); setIndex(0); }} />
            include places already done
          </label>
        </p>
      </div>

      <article className="panel" key={place.placeId}>
        <header className="place">
          <h2 className="place__name">{place.name}</h2>
          <p className="quiet">{[place.neighborhood, place.address, place.dates].filter(Boolean).join(' · ')}</p>
        </header>

        <section>
          <h2 className="question">1. Show this place in the exhibit?</h2>
          {place.reviewed
            ? <p className="done">✓ Already approved. Nothing to do here.</p>
            : !place.canApprove
              ? (
                <p className="notice">
                  Nobody has written a history for this place yet, so there is nothing to show about it.
                  It can be approved once a short history is written. You can still say what people did here below.
                </p>
              )
              : (
                <>
                  <p className="history">{place.shortHistory}</p>
                  <p className="quiet">Is this accurate, and should visitors see it?</p>
                  <div className="choices choices--small">
                    <Choice selected={approval === true} onClick={() => approve(true)} title="Yes, show it" body="" />
                    <Choice selected={approval === false} onClick={() => approve(false)} title="Not yet" body="It stays hidden; you can come back to it." />
                  </div>
                  {approval !== undefined && <button type="button" className="link" onClick={() => approve(undefined)}>Clear my answer</button>}
                </>
              )}
        </section>

        <section>
          <h2 className="question">2. What did each person do here?</h2>
          <p className="quiet">Choose only what their record says. If it does not say, leave it.</p>
          {place.ties.length === 0 && <p className="quiet">Nobody is tied to this place.</p>}
          <ul className="people">
            {place.ties.map((tie) => {
              const chosen = draft.placeTies[tieKey(place.placeId, tie.person.id)]?.role ?? null;
              return (
                <li key={tie.person.id} className="people__row">
                  <Portrait src={tie.person.portrait} name={tie.person.name} small />
                  <div className="people__body">
                    <strong>{tie.person.name}</strong>
                    <span className="quiet"> · the research: {tie.harvested}</span>
                    {tie.role && !chosen && <span className="done"> · recorded: {tie.role}</span>}
                    <div className="chips" role="group" aria-label={`What ${tie.person.name} did here`}>
                      {review.roles.map((role) => (
                        <button key={role.role} type="button" className="chip" aria-pressed={chosen === role.role}
                          title={role.label} onClick={() => setRole(tie.person.id, chosen === role.role ? undefined : role.role)}>
                          {role.role}
                        </button>
                      ))}
                    </div>
                    <details className="quiet">
                      <summary>Their biography</summary>
                      <p>{tie.person.biography}</p>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </article>

      <nav className="pager">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</button>
        <button type="button" onClick={onDone}>Stop for now</button>
        {index < list.length - 1
          ? <button type="button" className="primary" onClick={() => setIndex(index + 1)}>Next place →</button>
          : <button type="button" className="primary" onClick={onDone}>Finish</button>}
      </nav>
    </main>
  );
}

function isTouched(place: Place, draft: Draft): boolean {
  return draft.places[place.placeId] !== undefined
    || place.ties.some((tie) => draft.placeTies[tieKey(place.placeId, tie.person.id)]);
}
