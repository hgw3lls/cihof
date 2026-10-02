import { useEffect, useMemo, useRef, useState } from 'react';
import { previewTour, type Review, type Tour, type TourChanges, type TourPerson, type TourPreview } from './api.ts';
import { Portrait } from './Portrait.tsx';
import { sameChanges, withAdded, withLeftOut, withMove, withPutBack, withWord } from './tour-edit.ts';

type Props = {
  tour: Tour;
  review: Review;
  /** Where the editing starts: the tour as stored, or an edit kept earlier. */
  initial: TourChanges;
  onKeep: (changes: TourChanges) => void;
  onCancel: () => void;
  /** A new tour: it starts from nothing, under a name it has not been given yet. */
  creating?: boolean;
};

/**
 * The tour editor: a tour's words, and who it visits, changed by hand and
 * seen as the display would show them while they change.
 *
 * Who it visits is worked out by the server as a release would, from the
 * published profiles, each time something changes, so the list shown is the
 * list a visitor would walk. Nothing is written until the reviewer keeps the
 * changes, and even then only into their draft: it is saved, or exported,
 * like any other decision, and the tour comes off the displays until it is
 * approved as edited. A new tour is made the same way, starting from nothing.
 */
export function TourEditor({ tour, review, initial, onKeep, onCancel, creating = false }: Props) {
  const [changes, setChanges] = useState<TourChanges>(initial);
  // The preview, and the changes it answered: while they differ, it is out of date.
  const [previewed, setPreviewed] = useState<{ changes: TourChanges; preview: TourPreview } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const asked = useRef(0);
  const limits = review.limits.tour;

  useEffect(() => {
    const ask = ++asked.current;
    const timer = window.setTimeout(() => {
      previewTour(tour.tourId, changes, creating)
        .then((answer) => { if (ask === asked.current) { setPreviewed({ changes, preview: answer }); setFailed(null); } })
        .catch((error: Error) => { if (ask === asked.current) setFailed(error.message); });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [tour.tourId, changes, creating]);

  const preview = previewed?.preview ?? null;
  const people = preview?.people ?? tour.people;
  const order = people.map((person) => person.id);
  const byId = useMemo(() => new Map(review.tourPeople.map((person) => [person.id, person])), [review.tourPeople]);
  const pinned = new Set(changes.pinnedPersonIds);
  const current = previewed !== null && sameChanges(previewed.changes, changes) && !failed;
  const unchanged = sameChanges(changes, tour.changes);
  const problems = preview?.problems ?? [];
  const move = (from: number, to: number) => setChanges((now) => withMove(now, order, from, to));

  return (
    <section className="tour-editor" aria-label={creating ? 'A new tour' : `Editing ${tour.label}`}>
      <div className="tour-editor__preview" aria-label="As visitors would see it in the Tour key">
        <p className="quiet small">As visitors would see it</p>
        <div className="tourcard">
          <span className="tourcard__faces" aria-hidden="true">
            {people.slice(0, 4).map((person) => <Portrait key={person.id} src={person.portrait} name={person.name} small />)}
          </span>
          <span className="tourcard__prompt">{changes.prompt || '…'}</span>
          <span className="tourcard__label">{changes.label || '…'}</span>
          <span className="tourcard__description">{changes.description || '…'}</span>
          <span className="tourcard__count">{people.length} people</span>
        </div>
      </div>

      <h3 className="question">Its words</h3>
      <label className="field">
        <span>The line above the name <span className="quiet small">({changes.prompt.trim().length} of {limits.prompt} characters)</span></span>
        <input value={changes.prompt} maxLength={limits.prompt * 2} onChange={(event) => setChanges({ ...changes, prompt: event.target.value })} />
      </label>
      <label className="field">
        <span>Its name <span className="quiet small">({changes.label.trim().length} of {limits.label} characters)</span></span>
        <input value={changes.label} maxLength={limits.label * 2} onChange={(event) => setChanges({ ...changes, label: event.target.value })} />
      </label>
      <label className="field">
        <span>What it is about <span className="quiet small">({changes.description.trim().length} of {limits.description} characters; the display shows three lines)</span></span>
        <textarea rows={3} value={changes.description} maxLength={limits.description * 2} onChange={(event) => setChanges({ ...changes, description: event.target.value })} />
      </label>

      <h3 className="question">Who it visits, in order</h3>
      <p className="quiet small">
        Drag someone, or use the arrows, to change the order: they and everyone above them then keep that order, and below them the
        words and honours choose as before. <strong>Leave out</strong> takes someone out for good.
      </p>
      {people.length === 0
        ? <p className="todo">It finds nobody, so it would not appear even if approved.</p>
        : (
          <ol className="tour-editor__people" aria-busy={!current}>
            {people.map((person, index) => (
              <TourStop
                key={person.id} person={person} index={index} count={people.length} placed={pinned.has(person.id)}
                onMove={move} onLeaveOut={() => setChanges((now) => withLeftOut(now, person.id))}
              />
            ))}
          </ol>
        )}
      <AddSomeone people={review.tourPeople} taken={new Set(order)} onAdd={(id) => setChanges((now) => withAdded(now, id))} />
      {changes.excludedPersonIds.length > 0 && (
        <div className="tour-editor__out">
          <p className="small"><strong>Left out</strong>, whatever the words would choose:</p>
          <ul className="chips">
            {changes.excludedPersonIds.map((id) => (
              <li key={id}>
                <button type="button" className="chip chip--plain" onClick={() => setChanges((now) => withPutBack(now, id))}
                  aria-label={`Put ${byId.get(id)?.name ?? id} back`}>
                  {byId.get(id)?.name ?? id} <span aria-hidden="true">· put back</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className="field field--inline">
        <span>It visits at most</span>
        <input type="number" min={Math.max(1, changes.pinnedPersonIds.length)} max={limits.maxPortraits} value={changes.maxPortraits}
          onChange={(event) => setChanges({ ...changes, maxPortraits: Math.round(Number(event.target.value)) || 0 })} />
      </label>

      <h3 className="question">How the rest are chosen</h3>
      <p className="quiet small">
        After the people placed by hand come the people whose biography uses these words, or who are honoured for these things,
        those it fits best first.
      </p>
      <Words title="Words to look for in their biographies" words={changes.terms} limit={limits.terms}
        onChange={(terms) => setChanges({ ...changes, terms })} />
      <Words title="Honours to look for" words={changes.themes} limit={limits.terms}
        onChange={(themes) => setChanges({ ...changes, themes })} />

      {failed && <p className="todo" role="alert">The preview could not be worked out: {failed}</p>}
      {problems.length > 0 && (
        <ul className="todo" role="status">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
      <div className="tour-editor__actions">
        <button type="button" className="primary" disabled={unchanged || problems.length > 0 || !current || preview?.changed === false}
          onClick={() => onKeep(changes)}>
          Keep these changes
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
        {!unchanged && (
          <button type="button" className="link" onClick={() => setChanges(tour.changes)}>
            {creating ? 'Clear it and start again' : 'Start again from the tour as it is'}
          </button>
        )}
      </div>
      {unchanged && <p className="quiet small">{creating ? 'Give it a name, a few words, and some people or words to choose them by.' : 'Nothing has been changed yet.'}</p>}
    </section>
  );
}

function TourStop({ person, index, count, placed, onMove, onLeaveOut }: {
  person: TourPerson; index: number; count: number; placed: boolean;
  onMove: (from: number, to: number) => void; onLeaveOut: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <li
      className={over ? 'tour-editor__stop tour-editor__stop--over' : 'tour-editor__stop'}
      draggable
      onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(index)); event.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isInteger(from)) onMove(from, index);
      }}
    >
      <span className="tour-editor__grip" aria-hidden="true">⋮⋮</span>
      <Portrait src={person.portrait} name={person.name} small />
      <span className="tour-editor__name">
        {person.name}
        {person.classYear ? <span className="quiet small"> · {person.classYear}</span> : null}
        {placed && <span className="quiet small tour-editor__placed"> · placed by hand</span>}
      </span>
      <span className="tour-editor__keys">
        <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${person.name} earlier`}>↑</button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${person.name} later`}>↓</button>
        <button type="button" onClick={onLeaveOut} aria-label={`Leave ${person.name} out`}>Leave out</button>
      </span>
    </li>
  );
}

function AddSomeone({ people, taken, onAdd }: { people: TourPerson[]; taken: ReadonlySet<string>; onAdd: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const fold = (text: string) => text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  const matching = query.trim().length < 2 ? [] : people.filter((person) => fold(person.name).includes(fold(query.trim())));
  const found = matching.filter((person) => !taken.has(person.id)).slice(0, 8);
  const already = matching.filter((person) => taken.has(person.id)).map((person) => person.name);
  return (
    <div className="tour-editor__add">
      <label className="field">
        <span>Add someone <span className="quiet small">(they come after the others placed by hand; move them anywhere)</span></span>
        <input type="search" value={query} placeholder="Type a name" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {found.length > 0 && (
        <ul className="tour-editor__found">
          {found.map((person) => (
            <li key={person.id}>
              <button type="button" onClick={() => { onAdd(person.id); setQuery(''); }} aria-label={`Add ${person.name}`}>
                <Portrait src={person.portrait} name={person.name} small />
                <span>{person.name}{person.classYear ? <span className="quiet small"> · {person.classYear}</span> : null}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {already.length > 0 && <p className="quiet small">Already in this tour: {already.join(', ')}.</p>}
      {query.trim().length >= 2 && matching.length === 0 && <p className="quiet small">Nobody by that name.</p>}
    </div>
  );
}

function Words({ title, words, limit, onChange }: { title: string; words: string[]; limit: number; onChange: (words: string[]) => void }) {
  const [typed, setTyped] = useState('');
  const add = () => { onChange(withWord(words, typed)); setTyped(''); };
  return (
    <div className="tour-editor__words">
      <p className="small"><strong>{title}</strong> <span className="quiet">({words.length} of {limit})</span></p>
      <ul className="chips">
        {words.map((word) => (
          <li key={word}>
            <button type="button" className="chip chip--plain" onClick={() => onChange(words.filter((each) => each !== word))} aria-label={`Stop looking for ${word}`}>
              {word} <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
        {words.length === 0 && <li className="quiet small">None.</li>}
      </ul>
      <form className="tour-editor__word" onSubmit={(event) => { event.preventDefault(); add(); }}>
        <input value={typed} aria-label={`Add to ${title.toLowerCase()}`} placeholder="Add one" onChange={(event) => setTyped(event.target.value)} />
        <button type="submit" disabled={!typed.trim()}>Add</button>
      </form>
    </div>
  );
}
