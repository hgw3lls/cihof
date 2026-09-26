import { useEffect, useState } from 'react';
import { filmFixKey, previewFilmFix, type Draft, type Film, type FilmFix, type FixPreview, type Review } from './api.ts';
import { Choice } from './Connections.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * Corrections to the films' captions and transcripts.
 *
 * Both came from YouTube's automatic captions, so both carry the same
 * mistakes. The app finds two kinds on its own (music heard as "heat", and
 * the transcriber's blank-audio mark) and offers a fix for each; anything
 * else, such as a misheard name, the reviewer corrects by typing it. Every
 * fix is shown where it applies before it is chosen, and applies to the
 * captions and the transcript alike.
 */
export function FilmCaptions({ review, draft, update, onDone }: Props) {
  const fixes = draft.filmFixes ?? {};
  const set = (fix: Omit<FilmFix, 'note'>, chosen: boolean) => update((current) => {
    const filmFixes = { ...(current.filmFixes ?? {}) };
    const key = filmFixKey(fix);
    if (chosen) filmFixes[key] = fix; else delete filmFixes[key];
    // One choice per film for music: [music] and removing are alternatives.
    if (chosen && fix.fix === 'music') {
      for (const [other, value] of Object.entries(filmFixes)) {
        if (other !== key && value.filmId === fix.filmId && value.fix === 'music') delete filmFixes[other];
      }
    }
    return { ...current, filmFixes };
  });
  const noisy = review.films.filter((film) => film.music.transcriptCount + film.music.captionCount + film.blank.transcriptCount + film.blank.captionCount > 0);
  const [filmId, setFilmId] = useState('');

  return (
    <main className="page">
      <h1>Film captions and transcripts</h1>
      <p className="lead">
        The captions came from YouTube&rsquo;s automatic captions, and the transcripts from the captions, so both have the
        same mistakes. Each fix below changes both. Check it against the film before you choose it.
      </p>

      <h2>Found in the films</h2>
      {noisy.length === 0 && <p className="quiet">Nothing found.</p>}
      {noisy.map((film) => <NoisyFilm key={film.filmId} film={film} fixes={fixes} set={set} />)}

      <h2>Correct a word or a name</h2>
      <p className="quiet">For anything else the captions misheard. Choose the film, then type the words as they are and as they should be.</p>
      <label className="field">
        <span>Film</span>
        <select value={filmId} onChange={(event) => setFilmId(event.target.value)}>
          <option value="">Choose a film…</option>
          {review.films.map((film) => (
            <option key={film.filmId} value={film.filmId}>
              {film.people.join(', ')}{film.copies > 1 ? ` (${film.copies} copies)` : ''} · {film.filmId}
            </option>
          ))}
        </select>
      </label>
      {filmId && <PhraseFix filmId={filmId} onAdd={(fix) => set(fix, true)} />}

      {Object.values(fixes).filter((fix) => fix.fix === 'phrase').length > 0 && (
        <section className="panel">
          <h3>Corrections you have typed</h3>
          <ul>
            {Object.values(fixes).filter((fix) => fix.fix === 'phrase').map((fix) => (
              <li key={filmFixKey(fix)}>
                {review.films.find((film) => film.filmId === fix.filmId)?.people.join(', ')}: &ldquo;{fix.find}&rdquo; → &ldquo;{fix.replaceWith}&rdquo;{' '}
                <button type="button" className="link" onClick={() => set(fix, false)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function NoisyFilm({ film, fixes, set }: {
  film: Film;
  fixes: Record<string, FilmFix>;
  set: (fix: Omit<FilmFix, 'note'>, chosen: boolean) => void;
}) {
  const musicChoice = Object.values(fixes).find((fix) => fix.filmId === film.filmId && fix.fix === 'music');
  const blankChosen = Boolean(fixes[filmFixKey({ filmId: film.filmId, fix: 'blank' })]);
  const music = { filmId: film.filmId, fix: 'music' as const };

  return (
    <article className="panel">
      <h3 className="place__name">{film.people.join(', ')}</h3>
      <p className="quiet small">Film {film.filmId}{film.copies > 1 ? ` · ${film.copies} copies, all changed together` : ''}</p>

      {film.music.transcriptCount + film.music.captionCount > 0 && (
        <section>
          <p>
            <strong>Music heard as &ldquo;heat&rdquo;</strong>: {film.music.transcriptCount} place{film.music.transcriptCount === 1 ? '' : 's'} in the
            transcript, {film.music.captionCount} caption line{film.music.captionCount === 1 ? '' : 's'}.
          </p>
          <Examples preview={film.music} />
          <p className="quiet small">Check these really are music: &ldquo;heat&rdquo; is sometimes a real word, and this fix changes every one in the film.</p>
          <div className="choices choices--small">
            <Choice selected={musicChoice?.replaceWith === '[music]'} onClick={() => set({ ...music, replaceWith: '[music]' }, musicChoice?.replaceWith !== '[music]')}
              title="Mark it [music]" body="Replaced by [music], as captions usually mark it." />
            <Choice selected={musicChoice?.replaceWith === ''} onClick={() => set({ ...music, replaceWith: '' }, musicChoice?.replaceWith !== '')}
              title="Remove it" body="Taken out of the captions and the transcript." />
          </div>
        </section>
      )}

      {film.blank.transcriptCount + film.blank.captionCount > 0 && (
        <section>
          <p><strong>[BLANK_AUDIO]</strong>, the transcriber saying it heard nothing: {film.blank.transcriptCount} place{film.blank.transcriptCount === 1 ? '' : 's'}.</p>
          <Examples preview={film.blank} />
          <div className="choices choices--small">
            <Choice selected={blankChosen} onClick={() => set({ filmId: film.filmId, fix: 'blank', replaceWith: '' }, !blankChosen)}
              title="Remove it" body="It is not anything anyone said." />
          </div>
        </section>
      )}
    </article>
  );
}

function PhraseFix({ filmId, onAdd }: { filmId: string; onAdd: (fix: Omit<FilmFix, 'note'>) => void }) {
  const [find, setFind] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [preview, setPreview] = useState<FixPreview | null>(null);

  // Ask the server what the correction would change, once typing pauses.
  useEffect(() => {
    setPreview(null);
    if (!find.trim()) return undefined;
    const timer = window.setTimeout(() => {
      void previewFilmFix({ filmId, fix: 'phrase', find, replaceWith }).then(setPreview).catch(() => setPreview(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filmId, find, replaceWith]);

  const found = preview ? preview.transcriptCount + preview.captionCount : 0;
  return (
    <div className="panel">
      <label className="field">
        <span>The words as they are now</span>
        <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="For example: Carolyn Varo" />
      </label>
      <label className="field">
        <span>As they should be</span>
        <input value={replaceWith} onChange={(event) => setReplaceWith(event.target.value)} placeholder="For example: Carolyn Balogh" />
      </label>
      {preview && (
        found === 0
          ? <p className="notice">Those words are not in this film&rsquo;s transcript or captions, exactly as typed.</p>
          : (
            <>
              <p>
                Found in {preview.transcriptCount} place{preview.transcriptCount === 1 ? '' : 's'} in the transcript and{' '}
                {preview.captionCount} caption line{preview.captionCount === 1 ? '' : 's'}.
                {preview.captionCount < preview.transcriptCount && ' Some are split across caption lines there, and stay as they are in the captions.'}
              </p>
              <Examples preview={preview} />
            </>
          )
      )}
      <button type="button" className="primary" disabled={!found || find === replaceWith}
        onClick={() => { onAdd({ filmId, fix: 'phrase', find, replaceWith }); setFind(''); setReplaceWith(''); }}>
        Add this correction
      </button>
    </div>
  );
}

function Examples({ preview }: { preview: FixPreview }) {
  if (preview.examples.length === 0) return null;
  return (
    <details>
      <summary>Where it is, and how it would read</summary>
      <ul className="examples">
        {preview.examples.map((example, index) => (
          <li key={index}>
            <p><span className="quiet small">Now: </span>{example.before}</p>
            <p><span className="quiet small">After: </span>{example.after}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
