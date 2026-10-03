import { useEffect, useMemo, useRef, useState } from 'react';
import { uploadFile, type Draft, type FilmChange, type MediaPerson, type PortraitChoice, type Review } from './api.ts';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * Portraits and films: a new picture for a profile, a film added to
 * somebody's films, or a film taken off the display.
 *
 * Nothing is shown to visitors because a file was chosen. A picture needs a
 * description for people who cannot see it and somebody's word that the
 * museum may show it permanently; a film needs that too, and captions and a
 * transcript somebody checked against it, here, before it can be kept. The
 * files are kept on this computer by their checksum until the decision is
 * saved, and a display update carries them to the display.
 */
export function Media({ review, draft, update, onDone }: Props) {
  const [find, setFind] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const needle = find.trim().toLowerCase();
  const pending = (id: string) => (draft.portraits?.[id] ? 1 : 0) + Object.values(draft.films ?? {}).filter((value) => value.personId === id).length;
  const people = review.media.filter((person) => !needle || person.name.toLowerCase().includes(needle));
  const person = open ? review.media.find((each) => each.id === open) ?? null : null;

  if (person) {
    return (
      <main className="page page--narrow">
        <MediaPanel person={person} draft={draft} update={update} limits={review.limits} />
        <nav className="pager">
          <button type="button" onClick={() => setOpen(null)}>Back to everybody</button>
          <button type="button" className="primary" onClick={onDone}>Back to the start</button>
        </nav>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Portraits and films</h1>
      <p className="lead">
        Give somebody a new portrait, add a film to their films, or take a film off the display. Choose a person.
      </p>
      <label className="field">
        <span>Find a person</span>
        <input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Type a name" />
      </label>
      <ul className="media-people">
        {people.map((each) => (
          <li key={each.id}>
            <button type="button" className="media-person" onClick={() => setOpen(each.id)}>
              {each.portrait ? <img src={each.portrait.src} alt="" loading="lazy" /> : <span className="media-person__none" aria-hidden="true" />}
              <span>
                <strong>{each.name}</strong>
                <span className="quiet small">
                  {each.classYear ? `Class of ${each.classYear} · ` : ''}
                  {each.films.filter((film) => film.shown).length} film{each.films.filter((film) => film.shown).length === 1 ? '' : 's'} on the display
                </span>
                {pending(each.id) > 0 && <span className="badge">{pending(each.id)} not yet saved</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {people.length === 0 && <p className="quiet">Nobody by that name.</p>}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function MediaPanel({ person, draft, update, limits }: {
  person: MediaPerson;
  draft: Draft;
  update: Props['update'];
  limits: Review['limits'];
}) {
  const choice = draft.portraits?.[person.id];
  const setPortrait = (value: PortraitChoice | undefined) => update((current) => {
    const portraits = { ...(current.portraits ?? {}) };
    if (value) portraits[person.id] = value; else delete portraits[person.id];
    return { ...current, portraits };
  });
  const setFilm = (key: string, value: FilmChange | undefined) => update((current) => {
    const films = { ...(current.films ?? {}) };
    if (value) films[key] = value; else delete films[key];
    return { ...current, films };
  });
  const added = Object.entries(draft.films ?? {}).filter(([, value]) => value.decision === 'add' && value.personId === person.id);

  return (
    <>
      <h1>{person.name}</h1>
      {person.classYear && <p className="quiet">Class of {person.classYear}</p>}

      <section className="panel">
        <h2 className="question">Portrait</h2>
        <div className="media-portraits">
          <figure>
            {person.portrait ? <img src={person.portrait.src} alt={person.portrait.alt} /> : <span className="media-person__none media-person__none--large" />}
            <figcaption className="quiet small">{person.portrait ? (person.portrait.shown ? 'On the display now' : 'Not shown: its rights are not approved') : 'No portrait'}</figcaption>
          </figure>
          {choice && (
            <figure>
              <img src={`/api/uploads/${choice.upload}`} alt={choice.portraitAlt} />
              <figcaption className="quiet small">Your new picture, {choice.width} by {choice.height}</figcaption>
            </figure>
          )}
        </div>
        <PortraitChooser person={person} choice={choice} set={setPortrait} limit={limits.profile.portraitAlt} />
      </section>

      <section className="panel">
        <h2 className="question">Films</h2>
        {person.films.length === 0 && added.length === 0 && <p className="quiet">No films yet.</p>}
        <ul className="media-films">
          {person.films.map((film) => {
            const key = `withdraw:${person.id}:${film.filmId}`;
            const withdrawing = Boolean(draft.films?.[key]);
            return (
              <li key={film.filmId}>
                {film.poster ? <img src={film.poster} alt="" loading="lazy" /> : <span className="media-film__none" />}
                <span>
                  <strong>{film.title ?? (film.durationSeconds ? `A ${Math.max(1, Math.round(film.durationSeconds / 60))}-minute film` : 'A film')}</strong>
                  <span className="quiet small">{withdrawing ? 'To be taken off the display when you save' : film.shown ? 'On the display' : 'Not on the display'}</span>
                </span>
                {film.shown && (
                  withdrawing
                    ? <button type="button" className="link" onClick={() => setFilm(key, undefined)}>Keep it on the display</button>
                    : <button type="button" onClick={() => setFilm(key, { decision: 'withdraw', personId: person.id, filmId: film.filmId, note: '' })}>Take it off the display</button>
                )}
              </li>
            );
          })}
          {added.map(([key, value]) => value.decision === 'add' && (
            <li key={key}>
              <span className="media-film__none" />
              <span>
                <strong>{value.title || 'A new film'}</strong>
                <span className="quiet small">New, {clock(value.durationSeconds)} long: added to the display when you save</span>
              </span>
              <button type="button" className="link" onClick={() => setFilm(key, undefined)}>Don&rsquo;t add it</button>
            </li>
          ))}
        </ul>
        <FilmAdder person={person} titleLimit={limits.filmTitle} onAdd={(key, value) => setFilm(key, value)} />
      </section>
    </>
  );
}

export function PortraitChooser({ person, choice, set, limit }: {
  person: MediaPerson;
  choice: PortraitChoice | undefined;
  set: (value: PortraitChoice | undefined) => void;
  limit: number;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      const picture = await preparePicture(file);
      const uploaded = await uploadFile(picture, 'jpg');
      if (!uploaded.width || !uploaded.height || uploaded.width < 200 || uploaded.height < 200) throw new Error('The picture is too small to show well: it needs to be at least 200 by 200 pixels.');
      set({
        seenVersion: person.contentVersion, upload: uploaded.name, width: uploaded.width, height: uploaded.height,
        portraitAlt: choice?.portraitAlt ?? '', focalPoint: person.portrait?.focalPoint ?? 'center', rightsConfirmed: false, note: choice?.note ?? '',
      });
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const problemNow = choice ? portraitProblem(choice, limit) : null;
  return (
    <>
      <label className="field">
        <span>{choice ? 'Choose a different picture' : 'Choose a new picture'} <span className="quiet small">(a photograph: JPEG, PNG or WebP)</span></span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void choose(event.target.files?.[0])} />
      </label>
      {busy && <p className="quiet" role="status">Preparing the picture…</p>}
      {problem && <p className="problem" role="alert">{problem}</p>}
      {choice && (
        <>
          <label className="field">
            <span>Describe the picture for people who cannot see it <span className="quiet small">({choice.portraitAlt.trim().length} of {limit} characters)</span></span>
            <textarea rows={2} value={choice.portraitAlt} maxLength={limit * 2} onChange={(event) => set({ ...choice, portraitAlt: event.target.value })}
              placeholder={`Portrait of ${person.name}, …`} />
          </label>
          <label className="check">
            <input type="checkbox" checked={choice.rightsConfirmed} onChange={(event) => set({ ...choice, rightsConfirmed: event.target.checked })} />
            <span>The museum has the right to show this picture in the exhibit, permanently.</span>
          </label>
          <label className="field">
            <span>A note, if you want one <span className="quiet small">(where the picture is from, who gave permission)</span></span>
            <input value={choice.note ?? ''} onChange={(event) => set({ ...choice, note: event.target.value })} />
          </label>
          <p><button type="button" className="link" onClick={() => set(undefined)}>Keep the picture it has</button></p>
          <p className={problemNow ? 'todo' : 'done'} role="status">
            {problemNow ? `Not finished yet: ${problemNow}` : '✓ Chosen. Kept on this computer until you save. The profile will need approving again with its new picture.'}
          </p>
        </>
      )}
    </>
  );
}

export function FilmAdder({ person, titleLimit, onAdd }: {
  person: MediaPerson;
  titleLimit: number;
  onAdd: (key: string, value: FilmChange) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [film, setFilm] = useState<File | null>(null);
  const [playable, setPlayable] = useState<{ duration: number } | null>(null);
  const [filmProblem, setFilmProblem] = useState<string | null>(null);
  const [poster, setPoster] = useState<{ blob: Blob; url: string; at: number } | null>(null);
  const [captions, setCaptions] = useState<{ vtt: string; cues: number; url: string } | null>(null);
  const [captionProblem, setCaptionProblem] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [rights, setRights] = useState(false);
  const [captionsChecked, setCaptionsChecked] = useState(false);
  const [transcriptChecked, setTranscriptChecked] = useState(false);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const filmUrl = useMemo(() => (film ? URL.createObjectURL(film) : null), [film]);
  useEffect(() => () => { if (filmUrl) URL.revokeObjectURL(filmUrl); }, [filmUrl]);

  const reset = () => {
    setAdding(false); setFilm(null); setPlayable(null); setFilmProblem(null); setPoster(null); setCaptions(null); setCaptionProblem(null);
    setTranscript(''); setTitle(''); setRights(false); setCaptionsChecked(false); setTranscriptChecked(false); setNote(''); setProgress(null); setProblem(null);
  };

  if (!adding) return <p><button type="button" onClick={() => setAdding(true)}>Add a film…</button></p>;

  const readCaptions = async (file: File | undefined) => {
    setCaptionProblem(null);
    if (!file) return;
    try {
      const vtt = toVtt(await file.text(), file.name);
      const cues = cueTexts(vtt);
      if (cues.length === 0) throw new Error('That file holds no captions.');
      if (captions) URL.revokeObjectURL(captions.url);
      setCaptions({ vtt, cues: cues.length, url: URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) });
      setTranscript(transcriptFrom(cues));
      setCaptionsChecked(false);
      setTranscriptChecked(false);
    } catch (reason) {
      setCaptions(null);
      setCaptionProblem(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const takePoster = async () => {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const scale = Math.min(1, 1280 / element.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(element, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
    if (!blob) return;
    if (poster) URL.revokeObjectURL(poster.url);
    setPoster({ blob, url: URL.createObjectURL(blob), at: element.currentTime });
  };

  const missing = [
    !film || !playable ? 'a film that plays here' : null,
    !poster ? 'a poster: play the film to a good moment and use the picture showing' : null,
    !captions ? 'its captions' : null,
    !transcript.trim() ? 'its transcript' : null,
    title.trim().length > titleLimit ? `a shorter title (${titleLimit} characters at most)` : null,
    !rights ? 'confirmation that the museum may show it' : null,
    !captionsChecked ? 'confirmation that the captions were checked against the film' : null,
    !transcriptChecked ? 'confirmation that the transcript was checked' : null,
  ].filter(Boolean);

  const add = async () => {
    if (!film || !playable || !poster || !captions) return;
    setProblem(null);
    try {
      setProgress('Sending the film… 0%');
      const sent = await uploadFile(film, 'mp4', (fraction) => setProgress(`Sending the film… ${Math.floor(fraction * 100)}%`));
      setProgress('Sending the poster, captions and transcript…');
      const [posterSent, captionsSent, transcriptSent] = await Promise.all([
        uploadFile(poster.blob, 'jpg'),
        uploadFile(new Blob([captions.vtt], { type: 'text/vtt' }), 'vtt'),
        uploadFile(new Blob([`${transcript.trim()}\n`], { type: 'text/plain' }), 'txt'),
      ]);
      onAdd(`add:${person.id}:${sent.name.slice(0, 12)}`, {
        decision: 'add', personId: person.id, film: sent.name, poster: posterSent.name, captions: captionsSent.name, transcript: transcriptSent.name,
        durationSeconds: Math.round(playable.duration), title: title.trim(), rightsConfirmed: rights, captionsChecked, transcriptChecked, note,
      });
      reset();
    } catch (reason) {
      setProgress(null);
      setProblem(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="media-adder">
      <h3>Add a film</h3>
      <label className="field">
        <span>The film <span className="quiet small">(an MP4 file)</span></span>
        <input type="file" accept="video/mp4,.mp4,.m4v" onChange={(event) => {
          setFilm(event.target.files?.[0] ?? null); setPlayable(null); setFilmProblem(null); setPoster(null);
        }} />
      </label>
      {filmUrl && (
        <video ref={video} className="media-adder__video" src={filmUrl} controls preload="metadata"
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            if (!element.videoWidth || !Number.isFinite(element.duration)) { setFilmProblem('This file has no picture this computer can play, so the display could not play it either. Save it as an MP4 (H.264) and choose it again.'); return; }
            setPlayable({ duration: element.duration });
          }}
          onError={() => setFilmProblem('This film cannot be played here, so the display could not play it either. Save it as an MP4 (H.264) and choose it again.')}>
          {captions && <track kind="captions" src={captions.url} srcLang="en" label="English" default />}
        </video>
      )}
      {filmProblem && <p className="problem" role="alert">{filmProblem}</p>}
      {playable && (
        <>
          <p className="quiet small">{clock(Math.round(playable.duration))} long. Play it to the picture you want visitors to see before it starts.</p>
          <div className="media-adder__poster">
            <button type="button" onClick={() => void takePoster()}>Use the picture showing now as its poster</button>
            {poster && <img src={poster.url} alt="The poster chosen" />}
          </div>
        </>
      )}

      <label className="field">
        <span>Its captions <span className="quiet small">(a .vtt or .srt file; they show on the film above, to check)</span></span>
        <input type="file" accept=".vtt,.srt,text/vtt" onChange={(event) => void readCaptions(event.target.files?.[0])} />
      </label>
      {captionProblem && <p className="problem" role="alert">{captionProblem}</p>}
      {captions && <p className="quiet small">{captions.cues} captions.</p>}

      <label className="field">
        <span>Its transcript <span className="quiet small">(made from the captions; correct anything wrong)</span></span>
        <textarea rows={6} value={transcript} onChange={(event) => { setTranscript(event.target.value); setTranscriptChecked(false); }} />
      </label>

      <label className="field">
        <span>What it is called in {person.name}&rsquo;s films <span className="quiet small">(optional; {title.trim().length} of {titleLimit} characters)</span></span>
        <input value={title} maxLength={titleLimit * 2} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="check">
        <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
        <span>The museum has the right to show this film in the exhibit, permanently.</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={captionsChecked} disabled={!captions} onChange={(event) => setCaptionsChecked(event.target.checked)} />
        <span>I checked the captions against the film: the words, the names and the timing.</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={transcriptChecked} disabled={!transcript.trim()} onChange={(event) => setTranscriptChecked(event.target.checked)} />
        <span>I checked the transcript.</span>
      </label>
      <label className="field">
        <span>A note, if you want one <span className="quiet small">(where the film is from, who gave permission)</span></span>
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      {missing.length > 0 && <p className="todo" role="status">Still needed: {missing.join('; ')}.</p>}
      {progress && <p className="quiet" role="status">{progress}</p>}
      {problem && <p className="problem" role="alert">{problem}</p>}
      <p className="actions">
        <button type="button" onClick={reset}>Cancel</button>
        <button type="button" className="primary" disabled={missing.length > 0 || Boolean(progress)} onClick={() => void add()}>Add it to my decisions</button>
      </p>
    </div>
  );
}

/** What stops a new picture from being saved, or null. */
export function portraitProblem(choice: PortraitChoice, limit: number): string | null {
  if (!choice.portraitAlt.trim()) return 'describe the picture for people who cannot see it.';
  if (choice.portraitAlt.trim().length > limit) return `the description is too long (${limit} characters at most).`;
  if (!choice.rightsConfirmed) return 'confirm the museum may show it.';
  return null;
}

/** A photograph as the exhibit keeps one: upright, at most 1600 pixels on its long side, as a JPEG. */
export async function preparePicture(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That file is not a picture this computer can open. Choose a JPEG, PNG or WebP.');
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The picture could not be prepared.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9));
  if (!blob) throw new Error('The picture could not be prepared.');
  return blob;
}

/** Captions as WebVTT, which the display reads: a .vtt as it is, a .srt converted. */
export function toVtt(text: string, name: string): string {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  if (clean.startsWith('WEBVTT')) return `${clean}\n`;
  if (/\.srt$/i.test(name) || /^\d+\n\d{2}:\d{2}:\d{2},\d{3} --> /m.test(clean)) {
    return `WEBVTT\n\n${clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}\n`;
  }
  throw new Error('That is not a captions file: choose a .vtt or .srt file.');
}

/** The words of each caption, in order, without timings or markup. */
export function cueTexts(vtt: string): string[] {
  return vtt.split(/\n{2,}/).flatMap((block) => {
    const lines = block.split('\n');
    const timing = lines.findIndex((line) => line.includes('-->'));
    if (timing < 0) return [];
    const words = lines.slice(timing + 1).join(' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return words ? [words] : [];
  });
}

/** A first transcript from the captions: their words in order, a caption repeated as it rolls kept once. */
export function transcriptFrom(cues: readonly string[]): string {
  const kept: string[] = [];
  for (const cue of cues) if (cue !== kept.at(-1)) kept.push(cue);
  return kept.join(' ');
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
}
