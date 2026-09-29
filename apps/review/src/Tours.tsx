import type { Draft, Review, Tour, TourDecision } from './api.ts';
import { Choice } from './Connections.tsx';
import { Portrait } from './Portrait.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

const stateWords: Record<Tour['state'], string> = {
  approved: 'Approved, and on the displays',
  'changed-since-approval': 'Changed since it was approved, so off the displays until it is approved again',
  draft: 'Not approved, so not on the displays',
};

/**
 * The curated tours a visitor can choose from the Tour key: a theme, a few
 * words about it, and the people it walks them through.
 *
 * Its people are chosen by the release from the published biographies and
 * honours, by the words and honours the curators set. Approving a tour covers
 * its words and those rules, exactly as shown; if either changes afterwards,
 * the tour comes off the displays until somebody approves it again. It shows
 * on the display and the website alike.
 */
export function Tours({ review, draft, update, onDone }: Props) {
  const set = (tourId: string, value: TourDecision | undefined) => update((current) => {
    const tours = { ...(current.tours ?? {}) };
    if (value) tours[tourId] = value; else delete tours[tourId];
    return { ...current, tours };
  });

  return (
    <main className="page">
      <h1>Tours</h1>
      <p className="lead">
        Visitors choose a tour from the <em>Tour</em> key, and it walks them through its people one at a time.
        A tour appears only once it is approved here. Check its name and words, and that the people it visits fit it.
      </p>
      {review.tours.length === 0 && <p className="quiet">No tours have been written.</p>}
      {review.tours.map((tour) => (
        <TourPanel key={tour.tourId} tour={tour} value={draft.tours?.[tour.tourId]} set={(value) => set(tour.tourId, value)} />
      ))}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function TourPanel({ tour, value, set }: { tour: Tour; value: TourDecision | undefined; set: (value: TourDecision | undefined) => void }) {
  const stale = tourStale(tour, value);
  const approved = tour.state === 'approved';
  return (
    <article className="panel tour" aria-labelledby={`tour-${tour.tourId}`}>
      <p className="quiet small tour__prompt">{tour.prompt}</p>
      <h2 id={`tour-${tour.tourId}`} className="place__name">{tour.label}</h2>
      <p>{tour.description}</p>
      <p className={approved ? 'done' : 'quiet'}>{stateWords[tour.state]}</p>

      <h3 className="question">It visits {tour.people.length} {tour.people.length === 1 ? 'person' : 'people'}, in this order</h3>
      {tour.people.length === 0
        ? <p className="todo">It finds nobody, so it would not appear even if approved.</p>
        : (
          <ol className="tour__people">
            {tour.people.map((person) => (
              <li key={person.id}>
                <Portrait src={person.portrait} name={person.name} small />
                <span>{person.name}{person.classYear ? <span className="quiet small"> · {person.classYear}</span> : null}</span>
              </li>
            ))}
          </ol>
        )}
      <details>
        <summary>How its people are chosen</summary>
        <p className="small">
          People whose biography uses these words: {tour.terms.length ? tour.terms.join(', ') : 'none'}.
          {' '}Or who are honored for: {tour.themes.length ? tour.themes.join(', ') : 'nothing set'}.
          {tour.pinned.length ? ` Always first: ${tour.pinned.join(', ')}.` : ''}
          {tour.excluded.length ? ` Never included: ${tour.excluded.join(', ')}.` : ''}
        </p>
        <p className="quiet small">To change these, or who is always first or never included, ask the developer; the tour then needs approving again.</p>
      </details>

      <h3 className="question">{approved ? 'Keep it on the displays?' : 'Show this tour to visitors?'}</h3>
      <div className="choices choices--small">
        {tour.people.length > 0 && !approved && (
          <Choice selected={value?.decision === 'approve' && !stale}
            onClick={() => set({ decision: 'approve', seenVersion: tour.contentVersion, note: value?.note ?? '' })}
            title="Yes, approve it" body="Its name, words and people, as shown here." />
        )}
        {approved && (
          <Choice selected={value?.decision === 'withdraw'}
            onClick={() => set({ decision: 'withdraw', note: value?.note ?? '' })}
            title="Take it off the displays" body="It goes back to a draft until somebody approves it again." />
        )}
      </div>
      {stale && <p className="todo" role="status">This tour changed after you approved it. Look at it again, and approve it again if it is right.</p>}
      {value && (
        <label className="field">
          <span>A note, if you want one <span className="quiet small">(kept with the decision)</span></span>
          <input value={value.note ?? ''} onChange={(event) => set({ ...value, note: event.target.value })} />
        </label>
      )}
      {value && <p><button type="button" className="link" onClick={() => set(undefined)}>Clear my answer</button></p>}
      {value && !stale && <p className="done" role="status">✓ Decided. Kept on this computer until you save.</p>}
    </article>
  );
}

/** An approval made before the tour changed covers a tour nobody has looked at since. */
export function tourStale(tour: Tour | undefined, value: TourDecision | undefined): boolean {
  if (!value || value.decision !== 'approve') return false;
  return !tour || value.seenVersion !== tour.contentVersion;
}
