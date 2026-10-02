import { useEffect, useState } from 'react';
import { previewTour, type Audience, type Draft, type Review, type Tour, type TourChanges, type TourDecision, type TourPerson, type TourPreview } from './api.ts';
import { Choice } from './Connections.tsx';
import { Portrait } from './Portrait.tsx';
import { TourEditor } from './TourEditor.tsx';
import { choosesNobody, newTourId } from './tour-edit.ts';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

function stateWords(tour: Tour): string {
  if (tour.state === 'draft') return 'Not approved, so visitors do not see it';
  if (tour.state === 'changed-since-approval') return 'Changed since it was approved, so visitors do not see it until it is approved again';
  return tour.shownOn.publicWeb
    ? (tour.shownOn.kiosk ? 'Approved, on the exhibit and the public website' : 'Approved, on the public website only')
    : 'Approved, on the exhibit only';
}

/**
 * The curated tours a visitor can choose from the Tour key: a theme, a few
 * words about it, and the people it walks them through.
 *
 * Its people are chosen by the release from the published biographies and
 * honours, by the words and honours the curators set. Approving a tour covers
 * its words and those rules, exactly as shown; if either changes afterwards,
 * the tour comes off the displays until somebody approves it again. The
 * exhibit and the public website are decided apart, as for all visitor
 * content: the reviewer says which the approval is for.
 *
 * A tour can also be edited here (TourEditor): its words, and who it visits.
 * The edit is a decision like the others, kept in the draft until it is saved
 * or exported, and it may approve the tour as edited or leave it for somebody
 * else to approve. A new tour is made in the same editor, starting from
 * nothing, and decided the same way.
 */
export function Tours({ review, draft, update, onDone }: Props) {
  const [starting, setStarting] = useState(false);
  const set = (tourId: string, value: TourDecision | undefined) => update((current) => {
    const tours = { ...(current.tours ?? {}) };
    if (value) tours[tourId] = value; else delete tours[tourId];
    return { ...current, tours };
  });
  const created = Object.entries(draft.tours ?? {}).flatMap(([tourId, value]) => (value.decision === 'create' ? [{ tourId, value }] : []));
  // A new tour is named when it is first kept, from its words, and never by a name already in use.
  const start = (changes: TourChanges) => {
    const tourId = newTourId(changes.label, new Set([...review.tourIds, ...Object.keys(draft.tours ?? {})]));
    set(tourId, { decision: 'create', changes, audience: null, note: '' });
    setStarting(false);
  };

  return (
    <main className="page">
      <h1>Tours</h1>
      <p className="lead">
        Visitors choose a tour from the <em>Tour</em> key, and it walks them through its people one at a time.
        A tour appears only once it is approved here. Check its name and words, and that the people it visits fit it,
        or <strong>edit it</strong> to change them.
      </p>
      {starting
        ? (
          <article className="panel tour tour--new" aria-labelledby="tour-starting">
            <h2 id="tour-starting" className="place__name">A new tour</h2>
            <TourEditor tour={unwrittenTour('', review, review.blankTour)} review={review} creating
              initial={review.blankTour} onKeep={start} onCancel={() => setStarting(false)} />
          </article>
        )
        : <p><button type="button" onClick={() => setStarting(true)}>Start a new tour</button></p>}
      {created.map(({ tourId, value }) => (
        <NewTourPanel key={tourId} tourId={tourId} value={value} review={review} set={(next) => set(tourId, next)} />
      ))}
      {review.tours.length === 0 && created.length === 0 && <p className="quiet">No tours have been written.</p>}
      {review.tours.map((tour) => (
        <TourPanel key={tour.tourId} tour={tour} review={review} value={draft.tours?.[tour.tourId]} set={(value) => set(tour.tourId, value)} />
      ))}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function TourPanel({ tour, review, value, set }: { tour: Tour; review: Review; value: TourDecision | undefined; set: (value: TourDecision | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  const edit = value?.decision === 'edit' ? value : null;
  const preview = useEditedPreview(tour.tourId, edit?.changes ?? null);
  const stale = tourStale(tour, value);
  const approved = tour.state === 'approved';
  // An edit kept earlier is shown as it would be, not as the tour is stored.
  const words = edit?.changes ?? tour;
  const people = edit ? preview?.people ?? [] : tour.people;
  const chosen = (audience: Audience) => (value?.decision === 'approve' || value?.decision === 'edit') && value.audience === audience && !stale;
  const approve = (audience: Audience) => set(edit
    ? { ...edit, audience }
    : { decision: 'approve', seenVersion: tour.contentVersion, audience, note: value?.note ?? '' });
  const keep = (changes: TourChanges) => {
    // Kept, but not finished: whether it is approved, or left for somebody
    // else, is chosen afterwards, and again after every edit, since an
    // approval covers the edit the reviewer last saw.
    set({ decision: 'edit', seenVersion: edit?.seenVersion ?? tour.contentVersion, changes, audience: null, note: value?.note ?? '' });
    setEditing(false);
  };

  return (
    <article className="panel tour" aria-labelledby={`tour-${tour.tourId}`}>
      {editing
        ? (
          <>
            <h2 id={`tour-${tour.tourId}`} className="place__name">Editing “{tour.label}”</h2>
            <TourEditor tour={tour} review={review} initial={edit?.changes ?? tour.changes} onKeep={keep} onCancel={() => setEditing(false)} />
          </>
        )
        : (
          <>
            <p className="quiet small tour__prompt">{words.prompt}</p>
            <h2 id={`tour-${tour.tourId}`} className="place__name">{words.label}</h2>
            <p>{words.description}</p>
            {edit
              ? <p className="todo" role="status">Your changes, not yet saved. Visitors see the tour as it was until they are saved and approved.</p>
              : <p className={approved ? 'done' : 'quiet'}>{stateWords(tour)}</p>}

            <h3 className="question">It visits {people.length} {people.length === 1 ? 'person' : 'people'}, in this order</h3>
            {people.length === 0
              ? <p className={edit && !preview ? 'quiet' : 'todo'}>{edit && !preview ? 'Working out who it visits…' : 'It finds nobody, so it would not appear even if approved.'}</p>
              : (
                <ol className="tour__people">
                  {people.map((person) => (
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
                People whose biography uses these words: {words.terms.length ? words.terms.join(', ') : 'none'}.
                {' '}Or who are honored for: {words.themes.length ? words.themes.join(', ') : 'nothing set'}.
                {tour.pinned.length && !edit ? ` Always first: ${tour.pinned.join(', ')}.` : ''}
                {tour.excluded.length && !edit ? ` Never included: ${tour.excluded.join(', ')}.` : ''}
              </p>
            </details>
            <p>
              <button type="button" onClick={() => setEditing(true)}>{edit ? 'Edit my changes' : 'Edit this tour'}</button>
              {edit && <> <button type="button" className="link" onClick={() => set(undefined)}>Discard my changes</button></>}
            </p>

            <h3 className="question">{edit ? 'Approve it as edited?' : approved ? 'Change who sees it?' : 'Show this tour to visitors?'}</h3>
            <div className="choices choices--small">
              {people.length > 0 && (
                <>
                  <Choice selected={chosen('kiosk')} onClick={() => approve('kiosk')}
                    title={edit ? 'Approve it as edited, for the exhibit' : 'Approve it for the exhibit'}
                    body="The touchscreen in the gallery. Its name, words and people, as shown here." />
                  <Choice selected={chosen('kiosk-and-web')} onClick={() => approve('kiosk-and-web')}
                    title={edit ? 'Approve it as edited, for the exhibit and the public website' : 'Approve it for the exhibit and the public website'}
                    body="Only if it has been agreed that it may go online." />
                </>
              )}
              {edit && (
                <Choice selected={edit.audience === 'nobody' && !stale} onClick={() => set({ ...edit, audience: 'nobody' })}
                  title="Leave it for somebody else to approve" body="The changes are saved, and the tour stays off the displays until it is approved." />
              )}
              {approved && !edit && (
                <Choice selected={value?.decision === 'withdraw'}
                  onClick={() => set({ decision: 'withdraw', note: value?.note ?? '' })}
                  title="Take it off the exhibit and the website" body="It goes back to a draft until somebody approves it again." />
              )}
            </div>
            {stale && (
              <p className="todo" role="status">
                {edit
                  ? 'This tour was changed by somebody else after you began editing it, so your changes cannot be saved over theirs. Discard them and edit it again.'
                  : 'This tour changed after you approved it. Look at it again, and approve it again if it is right.'}
              </p>
            )}
            {value && (
              <label className="field">
                <span>A note, if you want one <span className="quiet small">(kept with the decision)</span></span>
                <input value={value.note ?? ''} onChange={(event) => set({ ...value, note: event.target.value })} />
              </label>
            )}
            {value && !edit && <p><button type="button" className="link" onClick={() => set(undefined)}>Clear my answer</button></p>}
            {edit && edit.audience === null && !stale && (
              <p className="todo" role="status">Choose one of these, so it is clear whether visitors may see the tour as edited. Until then your changes cannot be saved.</p>
            )}
            {value && !stale && !tourUnchosen(value) && <p className="done" role="status">✓ Decided. Kept on this computer until you save.</p>}
          </>
        )}
    </article>
  );
}

/**
 * A new tour, kept on this computer and not yet saved: what it says, who it
 * would visit, and whether it is to be approved or left for somebody else.
 */
function NewTourPanel({ tourId, value, review, set }: {
  tourId: string; value: Extract<TourDecision, { decision: 'create' }>; review: Review; set: (value: TourDecision | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const preview = useEditedPreview(tourId, value.changes, true);
  const words = value.changes;
  const people = preview?.people ?? [];
  // Somebody else's tour, saved since, took the name this one was given.
  const taken = review.tourIds.includes(tourId);
  const choose = (audience: Audience | 'nobody') => set({ ...value, audience });

  return (
    <article className="panel tour tour--new" aria-labelledby={`tour-${tourId}`}>
      {editing
        ? (
          <>
            <h2 id={`tour-${tourId}`} className="place__name">Editing your new tour</h2>
            <TourEditor tour={unwrittenTour(tourId, review, words)} review={review} creating initial={words}
              onKeep={(changes) => { set({ ...value, changes, audience: null }); setEditing(false); }} onCancel={() => setEditing(false)} />
          </>
        )
        : (
          <>
            <p className="quiet small tour__prompt">{words.prompt}</p>
            <h2 id={`tour-${tourId}`} className="place__name">{words.label}</h2>
            <p>{words.description}</p>
            <p className="todo" role="status">A new tour, not yet saved. Visitors see nothing of it until it is saved and approved.</p>
            <TourPeople people={people} waiting={!preview} />
            <details>
              <summary>How its people are chosen</summary>
              <p className="small">
                People whose biography uses these words: {words.terms.length ? words.terms.join(', ') : 'none'}.
                {' '}Or who are honored for: {words.themes.length ? words.themes.join(', ') : 'nothing set'}.
              </p>
              <p className="quiet small">In the records it will be called <code>{tourId}</code>.</p>
            </details>
            <p>
              <button type="button" onClick={() => setEditing(true)}>Edit my new tour</button>
              {' '}<button type="button" className="link" onClick={() => set(undefined)}>Discard this new tour</button>
            </p>

            <h3 className="question">Show it to visitors?</h3>
            <div className="choices choices--small">
              {people.length > 0 && (
                <>
                  <Choice selected={value.audience === 'kiosk' && !taken} onClick={() => choose('kiosk')}
                    title="Approve it for the exhibit" body="The touchscreen in the gallery. Its name, words and people, as shown here." />
                  <Choice selected={value.audience === 'kiosk-and-web' && !taken} onClick={() => choose('kiosk-and-web')}
                    title="Approve it for the exhibit and the public website" body="Only if it has been agreed that it may go online." />
                </>
              )}
              <Choice selected={value.audience === 'nobody' && !taken} onClick={() => choose('nobody')}
                title="Leave it for somebody else to approve" body="It is saved as a draft, and visitors see nothing of it until it is approved." />
            </div>
            {taken && (
              <p className="todo" role="status">A tour called <code>{tourId}</code> was saved by somebody else since you started this one. Discard it and start again.</p>
            )}
            {choosesNobody(words) && (
              <p className="todo" role="status">It has nobody in it and nothing to choose anybody by, so it cannot be saved. Edit it to put somebody in it.</p>
            )}
            {value.audience === null && !taken && (
              <p className="todo" role="status">Choose one of these, so it is clear whether visitors may see it. Until then it cannot be saved.</p>
            )}
            <label className="field">
              <span>A note, if you want one <span className="quiet small">(kept with the decision)</span></span>
              <input value={value.note ?? ''} onChange={(event) => set({ ...value, note: event.target.value })} />
            </label>
            {value.audience !== null && !taken && !choosesNobody(words) && <p className="done" role="status">✓ Decided. Kept on this computer until you save.</p>}
          </>
        )}
    </article>
  );
}

function TourPeople({ people, waiting }: { people: TourPerson[]; waiting: boolean }) {
  return (
    <>
      <h3 className="question">It visits {people.length} {people.length === 1 ? 'person' : 'people'}, in this order</h3>
      {people.length === 0
        ? <p className={waiting ? 'quiet' : 'todo'}>{waiting ? 'Working out who it visits…' : 'It finds nobody, so it would not appear even if approved.'}</p>
        : (
          <ol className="tour__people">
            {people.map((person) => (
              <li key={person.id}>
                <Portrait src={person.portrait} name={person.name} small />
                <span>{person.name}{person.classYear ? <span className="quiet small"> · {person.classYear}</span> : null}</span>
              </li>
            ))}
          </ol>
        )}
    </>
  );
}

/** A tour that is not in the records yet, in the shape the editor works on. */
function unwrittenTour(tourId: string, review: Review, changes: TourChanges): Tour {
  return {
    tourId, label: changes.label || 'A new tour', prompt: changes.prompt, description: changes.description,
    terms: changes.terms, themes: changes.themes, pinned: [], excluded: [],
    // Its starting point is nothing, so anything in it is a change.
    changes: review.blankTour, contentVersion: '', state: 'draft', shownOn: { kiosk: false, publicWeb: false }, reviewedAt: null, people: [],
  };
}

/** Who an edit kept earlier, or a new tour, would have the tour visit. */
function useEditedPreview(tourId: string, changes: TourChanges | null, creating = false): TourPreview | null {
  const [preview, setPreview] = useState<TourPreview | null>(null);
  const key = changes ? JSON.stringify(changes) : '';
  useEffect(() => {
    if (!changes) { setPreview(null); return; }
    let live = true;
    previewTour(tourId, changes, creating).then((answer) => { if (live) setPreview(answer); }).catch(() => { if (live) setPreview(null); });
    return () => { live = false; };
    // Asked again only when the edit itself changes, not each time it is rebuilt.
  }, [tourId, key, creating]);
  return preview;
}

/** An edit, or a new tour, kept without saying whether it is approved or left for somebody else. */
export function tourUnchosen(value: TourDecision | undefined): boolean {
  return (value?.decision === 'edit' || value?.decision === 'create') && value.audience === null;
}

/**
 * An approval made before the tour changed covers a tour nobody has looked at
 * since; an edit begun before it changed would undo somebody else's change.
 */
export function tourStale(tour: Tour | undefined, value: TourDecision | undefined): boolean {
  // A new tour has no version to go stale; whether its name was taken since is checked apart.
  if (!value || value.decision === 'withdraw' || value.decision === 'create') return false;
  return !tour || value.seenVersion !== tour.contentVersion;
}
