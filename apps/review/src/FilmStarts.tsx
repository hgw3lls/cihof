import { useState } from 'react';
import type { Draft, FilmStart, FilmStartDecision, Review } from './api.ts';
import { Choice } from './Connections.tsx';
import { Portrait } from './Portrait.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * Where a ceremony film opens for each person it stands for.
 *
 * The 2024 ceremony runs an hour and three quarters and is the film for six
 * inductees. From the beginning, a visitor has to find the person they chose.
 * Each person here comes with where the captions suggest their part begins
 * and what is said there; the reviewer watches from that point and says
 * where it should open. Nothing reaches the display until it is saved.
 */
export function FilmStarts({ review, draft, update, onDone }: Props) {
  const set = (key: string, value: FilmStartDecision | undefined) => update((current) => {
    const filmStarts = { ...(current.filmStarts ?? {}) };
    if (value) filmStarts[key] = value; else delete filmStarts[key];
    return { ...current, filmStarts };
  });

  return (
    <main className="page">
      <h1>Where ceremony films start</h1>
      <p className="lead">
        These people&rsquo;s film is a whole induction ceremony, shared with others. Choose where it opens for each
        of them, so a visitor sees their part first. The display adds a <em>From the beginning</em> button.
      </p>
      {review.filmStarts.length === 0 && <p className="quiet">No film is shared by several people.</p>}
      {review.filmStarts.map((entry) => (
        <FilmStartPanel key={entry.key} entry={entry} value={draft.filmStarts?.[entry.key]} set={(value) => set(entry.key, value)} />
      ))}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function FilmStartPanel({ entry, value, set }: {
  entry: FilmStart;
  value: FilmStartDecision | undefined;
  set: (value: FilmStartDecision | undefined) => void;
}) {
  const suggested = entry.suggestion?.seconds ?? null;
  const [typed, setTyped] = useState(value?.decision === 'start' && value.seconds !== suggested ? clock(value.seconds) : '');
  const other = value?.decision === 'start' && value.seconds !== suggested;
  const problem = other || typed ? startProblem(typed, entry.durationSeconds) : null;

  return (
    <article className="panel">
      <header className="place">
        <Portrait src={entry.portrait} name={entry.name} small />
        <h2 className="place__name">{entry.name}</h2>
        <p className="quiet">
          {entry.approvedSeconds === null ? 'Now opens at the beginning' : `Now opens at ${clock(entry.approvedSeconds)}`}
          {entry.durationSeconds ? ` · the film runs ${clock(entry.durationSeconds)}` : ''} · shared by {entry.sharedWith} people
        </p>
      </header>

      {entry.suggestion
        ? (
          <div className="suggestion">
            <p><strong>Suggested: {clock(entry.suggestion.seconds)}.</strong> {entry.suggestion.reason}</p>
            <p className="quiet small">Drafted from the captions, which mishear names. Watch from here before choosing it.</p>
            <p><a href={watchUrl(entry.filmId, entry.suggestion.seconds)} target="_blank" rel="noreferrer">Watch from {clock(entry.suggestion.seconds)} ↗</a></p>
            <details>
              <summary>What the captions say there</summary>
              <ul className="captions">
                {entry.suggestion.context.map((cue, index) => <li key={index}><span className="quiet">{clock(cue.t)}</span> {cue.words}</li>)}
              </ul>
            </details>
          </div>
        )
        : <p className="notice">The captions give no clear place for {entry.name}. Watch the film to find it.</p>}

      <div className="choices choices--small">
        {suggested !== null && (
          <Choice selected={value?.decision === 'start' && value.seconds === suggested}
            onClick={() => { setTyped(''); set({ decision: 'start', seconds: suggested }); }}
            title={`Open at ${clock(suggested)}`} body="Where the suggestion says their part begins." />
        )}
        <Choice selected={Boolean(other) || Boolean(typed)}
          onClick={() => { if (!typed) setTyped(value?.decision === 'start' ? clock(value.seconds) : suggested !== null ? clock(suggested) : ''); }}
          title="A different time" body="Type where their part begins." />
        <Choice selected={value?.decision === 'beginning'} onClick={() => { setTyped(''); set({ decision: 'beginning' }); }}
          title="From the beginning" body="The whole ceremony, as now." />
      </div>

      {(other || typed !== '') && (
        <label className="field">
          <span>Opens at <span className="quiet small">(hours:minutes:seconds, such as 1:17:42)</span></span>
          <input value={typed} onChange={(event) => {
            const next = event.target.value;
            setTyped(next);
            const seconds = parseClock(next);
            if (seconds !== null && !startProblem(next, entry.durationSeconds)) set({ decision: 'start', seconds });
            else set(undefined);
          }} />
        </label>
      )}
      {problem && <p className="notice" role="alert">{problem}</p>}
      {typed !== '' && parseClock(typed) !== null && !problem && (
        <p><a href={watchUrl(entry.filmId, parseClock(typed)!)} target="_blank" rel="noreferrer">Watch from {clock(parseClock(typed)!)} ↗</a></p>
      )}
      {value && <button type="button" className="link" onClick={() => { setTyped(''); set(undefined); }}>Clear my answer</button>}
    </article>
  );
}

/** The same checks films:starts:apply makes, said before the reviewer saves. */
export function startProblem(text: string, durationSeconds: number | null): string | null {
  const seconds = parseClock(text);
  if (seconds === null) return 'Type a time such as 1:17:42.';
  if (seconds <= 0) return 'For the start of the film, choose "From the beginning".';
  if (durationSeconds !== null && seconds >= durationSeconds) return `That is past the end of the film (${clock(durationSeconds)}).`;
  return null;
}

function parseClock(text: string): number | null {
  const value = text.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((part) => part > 59)) return null;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole / 60) % 60;
  const s = whole % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** The hall's own channel, from that second, in a new tab: the staff computer has no copy of the film. */
function watchUrl(filmId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(filmId)}&t=${seconds}s`;
}
