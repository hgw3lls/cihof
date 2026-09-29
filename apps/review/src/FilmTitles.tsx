import { useState } from 'react';
import type { Draft, FilmTitle, FilmTitleDecision, Review } from './api.ts';
import { Choice } from './Connections.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * What each film is called in a person's list of films on the display.
 *
 * The collection recorded no titles, so the display describes a film by its
 * length ("A 7-minute film"). Each film has a title on YouTube, given by
 * whoever posted it; those are offered here as suggestions, never shown to
 * visitors until a reviewer approves one or writes their own. Some make
 * claims, such as who inducted whom, so they are checked like any other words.
 */
export function FilmTitles({ review, draft, update, onDone }: Props) {
  const [find, setFind] = useState('');
  const set = (filmId: string, value: FilmTitleDecision | undefined) => update((current) => {
    const filmTitles = { ...(current.filmTitles ?? {}) };
    if (value) filmTitles[filmId] = value; else delete filmTitles[filmId];
    return { ...current, filmTitles };
  });
  const needle = find.trim().toLowerCase();
  const shown = review.filmTitles.filter((film) => !needle || film.people.some((name) => name.toLowerCase().includes(needle)));
  const titled = review.filmTitles.filter((film) => film.approvedTitle).length;

  return (
    <main className="page">
      <h1>Film titles</h1>
      <p className="lead">
        What each film is called in a person&rsquo;s list of films on the display. Without a title, a film is described by its
        length. {titled} of {review.filmTitles.length} films have an approved title.
      </p>
      <p className="notice">
        The suggestions are the titles the films have on YouTube, written by whoever posted them. Check each one before you use
        it: the names, and anything it says about who inducted whom.
      </p>
      <label className="field">
        <span>Find a person</span>
        <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Type a name" />
      </label>
      {shown.map((film) => (
        <FilmTitlePanel key={film.filmId} film={film} limit={review.limits.filmTitle} value={draft.filmTitles?.[film.filmId]}
          set={(value) => set(film.filmId, value)} />
      ))}
      {shown.length === 0 && <p className="quiet">No film of anybody by that name.</p>}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function FilmTitlePanel({ film, limit, value, set }: {
  film: FilmTitle;
  limit: number;
  value: FilmTitleDecision | undefined;
  set: (value: FilmTitleDecision | undefined) => void;
}) {
  const suggestion = film.suggestion?.title ?? '';
  const keeping = value?.decision === 'approve' && value.title === suggestion && suggestion !== '';
  const writing = value?.decision === 'approve' && !keeping;
  const problem = value ? filmTitleProblem(value, limit) : null;
  const minutes = Math.max(1, Math.round((film.durationSeconds ?? 0) / 60));

  return (
    <article className="panel film-title" aria-labelledby={`film-${film.filmId}`}>
      <header className="place">
        {film.poster ? <img className="film-title__poster" src={film.poster} alt="" loading="lazy" /> : null}
        <div>
          <h2 id={`film-${film.filmId}`} className="place__name">{film.people.join(', ')}</h2>
          <p className="quiet">
            {film.people.length > 1 ? `A ceremony film shared by ${film.people.length} people` : `A ${minutes}-minute film`}
            {' · '}{film.approvedTitle ? <>called <strong>“{film.approvedTitle}”</strong> on the display</> : 'no title yet'}
          </p>
        </div>
      </header>

      {film.suggestion
        ? (
          <div className="suggestion">
            <p><strong>On YouTube:</strong> “{film.suggestion.title}”</p>
            <p className="quiet small">
              Posted by {film.suggestion.uploader || 'somebody not named'}.
              {film.suggestion.url ? <> <a href={film.suggestion.url} target="_blank" rel="noreferrer">Watch it on YouTube ↗</a></> : null}
            </p>
          </div>
        )
        : <p className="quiet">No YouTube title was found for this film.</p>}

      <div className="choices choices--small">
        {suggestion && (
          <Choice selected={keeping} onClick={() => set({ decision: 'approve', title: suggestion, note: value?.note ?? '' })}
            title="Use the YouTube title" body="Approved exactly as shown above." />
        )}
        <Choice selected={writing}
          onClick={() => set({ decision: 'approve', title: writing ? value.title : film.approvedTitle ?? suggestion, note: value?.note ?? '' })}
          title="Write a title" body="Your own words, approved as you write them." />
        {film.approvedTitle && (
          <Choice selected={value?.decision === 'clear'} onClick={() => set({ decision: 'clear', note: value?.note ?? '' })}
            title="Take the title away" body="It is described by its length again." />
        )}
      </div>

      {writing && (
        <label className="field">
          <span>Title <span className="quiet small">({value.title.trim().length} of {limit} characters)</span></span>
          <input autoFocus value={value.title} maxLength={limit * 2} onChange={(event) => set({ ...value, title: event.target.value })} />
        </label>
      )}
      {value && (
        <label className="field">
          <span>A note, if you want one <span className="quiet small">(kept with the decision)</span></span>
          <input value={value.note ?? ''} onChange={(event) => set({ ...value, note: event.target.value })} />
        </label>
      )}
      {value && <p><button type="button" className="link" onClick={() => set(undefined)}>Clear my answer</button></p>}
      {value && (
        <p className={problem ? 'todo' : 'done'} role="status">
          {problem ? `Not finished yet: ${problem}` : '✓ Decided. Kept on this computer until you save.'}
        </p>
      )}
    </article>
  );
}

/** What stops a film title decision from being saved, or null. */
export function filmTitleProblem(value: FilmTitleDecision, limit: number): string | null {
  if (value.decision === 'clear') return null;
  const title = value.title.trim();
  if (!title) return 'write a title.';
  if (title.length > limit) return `the title is too long for the list (${limit} characters at most).`;
  return null;
}
