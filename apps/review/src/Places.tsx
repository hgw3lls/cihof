import { useMemo, useState } from 'react';
import { tieKey, type Draft, type Place, type PlaceDecision, type Review } from './api.ts';
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
 * The places, one at a time: first the words visitors read about the place,
 * then what each person did there. Approving a place covers exactly the words
 * shown; a reviewer may write their own instead, which are approved as
 * written. A place nobody has written a history for can be shown once someone
 * writes one.
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

  const decide = (value: PlaceDecision | undefined) => update((current) => {
    const places = { ...current.places };
    if (value === undefined) delete places[place.placeId]; else places[place.placeId] = value;
    return { ...current, places };
  });
  const setRole = (personId: string, role: string | undefined) => update((current) => {
    const placeTies = { ...current.placeTies };
    const key = tieKey(place.placeId, personId);
    if (role) placeTies[key] = { role }; else delete placeTies[key];
    return { ...current, placeTies };
  });

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

        <PlaceWords place={place} value={draft.places[place.placeId]} limit={review.limits.placeHistory} set={decide} />

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

/**
 * The first question: the words about the place, and whether to show them.
 *
 * What it asks depends on where the place stands. A place already approved in
 * these words needs nothing, though its words can still be changed. One
 * approved before approvals covered the words (or whose words changed since)
 * asks again, because nobody has approved what visitors read. A place with no
 * history can be given one.
 */
function PlaceWords({ place, value, limit, set }: {
  place: Place;
  value: PlaceDecision | undefined;
  limit: number;
  set: (value: PlaceDecision | undefined) => void;
}) {
  const current = value && (!value.approve || value.seenVersion === place.contentVersion) ? value : undefined;
  const writing = current?.approve === true && typeof current.history === 'string';
  const approve = () => set({ approve: true, seenVersion: place.contentVersion });
  const write = (history: string) => set({ approve: true, seenVersion: place.contentVersion, history, ...(current?.note ? { note: current.note } : {}) });
  const problem = writing ? historyProblem(current.history ?? '', limit) : null;
  const hasHistory = place.shortHistory.trim().length > 0;

  const status = place.words === 'current'
    ? <p className="done">✓ Approved in these words, and shown to visitors.</p>
    : place.words === 'legacy'
      ? <p className="notice">Visitors see this place now, but it was approved before an approval recorded the words. Please check the words below.</p>
      : place.words === 'changed'
        ? <p className="notice">These words changed after the place was approved, so it is hidden until someone approves them.</p>
        : !hasHistory
          ? <p className="notice">Nobody has written a history for this place yet, so there is nothing to show about it. You can write one; it is approved as you write it.</p>
          : null;

  return (
    <section>
      <h2 className="question">1. {hasHistory ? 'Are these the right words to show visitors?' : 'Write a history for this place?'}</h2>
      {status}
      {hasHistory && <p className="history">{place.shortHistory}</p>}
      {place.suggestion && (
        <div className="suggestion">
          <p className="quiet small">A plainer wording, drafted from the words above without adding anything. Use it only if it is right.</p>
          <p className="history">{place.suggestion}</p>
        </div>
      )}

      <div className="choices choices--small">
        {hasHistory && place.words !== 'current' && (
          <Choice selected={current?.approve === true && !writing} onClick={approve} title="Yes, show it in these words" body="Exactly as shown above." />
        )}
        {place.suggestion && (
          <Choice selected={writing && current?.history === place.suggestion} onClick={() => write(place.suggestion ?? '')}
            title="Use the suggested wording" body="You can still change it below." />
        )}
        <Choice selected={writing && current?.history !== place.suggestion} onClick={() => write(writing ? current?.history ?? '' : place.shortHistory)}
          title={hasHistory ? 'Use different words' : 'Write a history'} body="Your words are approved as you write them." />
        {!place.reviewed && hasHistory && (
          <Choice selected={current?.approve === false} onClick={() => set({ approve: false })} title="Not yet" body="It stays hidden; you can come back to it." />
        )}
      </div>

      {writing && (
        <label className="field">
          <span>The words visitors read <span className="quiet small">({(current.history ?? '').trim().length} of {limit} characters)</span></span>
          <textarea rows={4} value={current.history ?? ''} maxLength={limit * 2} onChange={(event) => write(event.target.value)} />
        </label>
      )}
      {problem && <p className="notice" role="alert">{problem}</p>}
      {writing && <p className="quiet small">Say only what the records say. One paragraph, written for a visitor standing at the display.</p>}
      {value && <button type="button" className="link" onClick={() => set(undefined)}>Clear my answer</button>}
    </section>
  );
}

/** The same limits the apply tool enforces, said before the reviewer saves. */
export function historyProblem(history: string, limit: number): string | null {
  const words = history.trim();
  if (!words) return 'Write the words visitors will read, or choose another answer.';
  if (words.length > limit) return `That is ${words.length} characters; the screen has room for ${limit}.`;
  if (/[\r\n]/.test(words)) return 'Keep it to one paragraph: take out the line breaks.';
  return null;
}
