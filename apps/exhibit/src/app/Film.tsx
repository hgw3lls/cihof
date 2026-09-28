import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal.tsx';
import type { PublishedFilm } from '@cihof/content';
import type { RuntimePerson } from '../data/runtime.ts';
import { mediaCountsAsActivity } from '../state/session.ts';

type Props = {
  person: RuntimePerson;
  film: PublishedFilm;
  onClose: () => void;
  /** Another of this person's films, from the list beside the screen. */
  onChoose: (filmId: string) => void;
  /** Whether the list of their films is showing; it stays as the visitor left it. */
  listOpen: boolean;
  onList: (open: boolean) => void;
  /** Called while playback is genuinely progressing, to hold the session open. */
  onProgress: () => void;
  /** Where to open, when a search found words said part way through. */
  startAt?: number;
};

/**
 * Plays a cleared film, full screen and always on black.
 *
 * Captions are a track on the element, so they are the browser's to render
 * and the visitor's to turn off. The transcript, the only way in for somebody
 * who cannot hear the film, is one touch away in a drawer over the right of
 * the screen. A person with several films has them listed beside it.
 *
 * Progress is reported to the session only while the film is actually moving.
 * A film paused, ended or stalled on a broken network is not somebody standing
 * there, and must not hold the display open all evening.
 */
export function Film({ person, film, onClose, onChoose, listOpen, onList, onProgress, startAt }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // A ceremony film opens at this person's part of it, when a curator has
  // approved where that is. Seeking there is not a visitor watching, so it
  // does not count as progress. A moment a search found opens a couple of
  // seconds early, so the words are heard whole.
  const start = startAt !== undefined ? Math.max(0, startAt - 2) : film.startSeconds ?? 0;
  const lastTime = useRef(start);
  const seeked = useRef(false);
  const [problem, setProblem] = useState('');
  const [playingNow, setPlayingNow] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [time, setTime] = useState({ current: start, duration: film.durationSeconds ?? 0 });
  // Three states, not two: still fetching, fetched, and could not be fetched.
  const [transcript, setTranscript] = useState<string | null>(null);

  const source = film.source;
  const embedded = source?.kind === 'youtube' && Boolean(source.embedUrl);
  const playable = embedded || Boolean(source?.kind === 'local-file' && source.src);
  const ownControls = playable && !problem && source?.kind === 'local-file';
  // Where our own captions cannot be shown, the reviewed words start open.
  const [drawer, setDrawer] = useState(!ownControls);

  // A different film starts afresh: at its beginning (or its part of the
  // ceremony), paused, with nothing wrong yet.
  useEffect(() => {
    lastTime.current = start;
    seeked.current = false;
    setProblem('');
    setPlayingNow(false);
    setTime({ current: start, duration: film.durationSeconds ?? 0 });
  }, [film.id]);

  useEffect(() => {
    // Stop the film before the element goes, so audio cannot outlive it, and
    // let go of its captions and its source. Chromium keeps a caption track
    // that still has cues registered with the page after the element has
    // gone, and through it the video and every caption: one more of each for
    // every film watched, on a display that runs for weeks. `npm run
    // endurance` found it. The video is keyed by film, so this runs for each
    // film left as well as when the player closes.
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      // Still on the page means this was not the film going (development
      // mode runs every effect twice), and it must keep its captions.
      if (video.isConnected) return;
      for (const element of video.querySelectorAll('track')) {
        const track = element.track;
        for (const cue of [...(track.cues ?? [])]) track.removeCue(cue);
        track.mode = 'disabled';
      }
      for (const child of video.querySelectorAll('track, source')) child.remove();
      video.removeAttribute('src');
      video.load();
    };
  }, [film.id]);

  useEffect(() => {
    let cancelled = false;
    setTranscript(null);
    fetch(asset(film.transcript))
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then((text) => { if (!cancelled) setTranscript(text); })
      .catch(() => { if (!cancelled) setTranscript(''); });
    return () => { cancelled = true; };
  }, [film.transcript]);

  const reportProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const progressing = video.currentTime > lastTime.current;
    lastTime.current = video.currentTime;
    setTime({ current: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : film.durationSeconds ?? 0 });
    if (mediaCountsAsActivity({ paused: video.paused, ended: video.ended, progressing })) onProgress();
  }, [onProgress, film.durationSeconds]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined); else video.pause();
  };
  const openAtStart = () => {
    const video = videoRef.current;
    if (video && start > 0 && !seeked.current) {
      seeked.current = true;
      video.currentTime = start;
    }
    // A track added by React starts hidden in some browsers; say what the button says.
    const track = video?.textTracks[0];
    if (track) track.mode = captionsOn ? 'showing' : 'hidden';
    reportProgress();
  };
  const fromBeginning = () => { const video = videoRef.current; if (video) video.currentTime = 0; };
  const back = () => { const video = videoRef.current; if (video) video.currentTime = Math.max(0, video.currentTime - 10); };
  const toggleCaptions = () => {
    const track = videoRef.current?.textTracks[0];
    const next = !captionsOn;
    if (track) track.mode = next ? 'showing' : 'hidden';
    setCaptionsOn(next);
  };

  const films = person.films;
  const index = Math.max(0, films.findIndex((each) => each.id === film.id));
  const several = films.length > 1;
  const share = time.duration > 0 ? Math.min(time.current / time.duration, 1) : 0;
  const kicker = startAt !== undefined
    ? 'Film · from the words you searched for'
    : (film.startSeconds ?? 0) > 0
      ? 'Film · from their part of the ceremony'
      : `Film · ${clock(film.durationSeconds ?? 0)}`;

  return (
    <Modal className="film" labelledBy="filmTitle" onClose={onClose}>
      <div className="dialog-stage film__frame">
        <div className="film__main">
          <div className="film__screen">
            {problem || !playable
              ? (
                <div className="film__problem" role="alert">
                  <p>{problem || 'This film could not be played on this display.'}</p>
                  <p>The transcript carries the whole of what was said.</p>
                </div>
              )
              : embedded && source?.kind === 'youtube'
                ? (
                  // The embedded player carries YouTube's own captions, not the
                  // reviewed ones: an iframe cannot be given a track element.
                  // The reviewed transcript is what this release stands behind,
                  // so it opens beside the film and the bar says why.
                  <div className="film__embed" data-shifted={drawer ? 'true' : undefined}>
                    <iframe title={`Film of ${person.name}`} src={source.embedUrl} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                )
                : source?.kind === 'local-file'
                  ? (
                    <>
                      <video
                        key={film.id}
                        ref={videoRef}
                        className="film__video"
                        data-shifted={drawer ? 'true' : undefined}
                        playsInline
                        preload="metadata"
                        poster={asset(film.poster)}
                        onClick={togglePlay}
                        onTimeUpdate={reportProgress}
                        onLoadedMetadata={openAtStart}
                        onPlay={() => setPlayingNow(true)}
                        onPause={() => setPlayingNow(false)}
                        onEnded={() => setPlayingNow(false)}
                        onError={() => setProblem('This film could not be played on this display.')}
                      >
                        <source src={asset(source.src)} type="video/mp4" />
                        <track kind="captions" src={asset(film.captions)} srcLang="en" label="English captions" default />
                      </video>
                      {/* The big square is for a hand; the bar's Play is the one a keyboard reaches. */}
                      <button type="button" className="film__big" aria-hidden="true" tabIndex={-1} data-hidden={playingNow ? 'true' : undefined} data-shifted={drawer ? 'true' : undefined} onClick={togglePlay}>
                        <span />
                      </button>
                      <div className="film__progress" aria-hidden="true">
                        <span className="film__track"><span style={{ width: `${share * 100}%` }} /></span>
                        <span className="film__times">{clock(time.current)} / {clock(time.duration)}</span>
                      </div>
                    </>
                  )
                  : null}

            <header className="film__header">
              <span>{kicker}</span>
              <h2 id="filmTitle" data-autofocus tabIndex={-1}>{person.name}</h2>
            </header>

            <section className="film__transcript" data-open={drawer ? 'true' : undefined} aria-label={`Transcript of ${person.name}`}>
              <h3>Transcript</h3>
              {transcript === null
                ? <p className="film__loading">Loading the transcript…</p>
                : transcript
                  ? <div>{transcript.split(/\n{2,}/).map((part, at) => <p key={at}>{part.trim()}</p>)}</div>
                  : <p className="film__problem">The transcript could not be loaded.</p>}
            </section>
          </div>

          {several && (
            <aside className="film__list" data-open={listOpen ? 'true' : undefined} aria-label="Films" aria-hidden={!listOpen} {...(!listOpen ? { inert: '' } : {})}>
              <p className="film__list-title">{films.length} films · {index + 1} of {films.length}</p>
              <ol>
                {films.map((each, at) => {
                  const current = each.id === film.id;
                  return (
                    <li key={each.id}>
                      <button type="button" aria-current={current ? 'true' : undefined} onClick={() => { if (!current) onChoose(each.id); }}>
                        <span className="film__thumb" style={{ backgroundImage: `url("${asset(each.poster)}")` }}>
                          <span>{clock(each.durationSeconds ?? 0)}</span>
                        </span>
                        <span className="film__item">
                          <span className="film__state">{current ? (playingNow ? 'Now playing' : 'Selected') : `Film ${at + 1} of ${films.length}`}</span>
                          <span className="film__item-title">{title(each)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>
          )}
        </div>

        <div className="film__controls">
          <button type="button" className="film__close" onClick={onClose}><span aria-hidden="true">←</span>Close film</button>
          <button type="button" className="film__play" disabled={!ownControls} onClick={togglePlay}>{playingNow ? 'Pause' : 'Play'}</button>
          <button type="button" className="film__back" disabled={!ownControls} onClick={back}>Back 10 s</button>
          <span className="film__note">
            {embedded
              ? 'Plays from the hall’s channel, with that player’s own captions. The reviewed words are in the transcript.'
              : start > 0 && ownControls
                ? <button type="button" className="film__beginning" onClick={fromBeginning}>From the beginning</button>
                : person.name}
          </span>
          <button type="button" className="film__captions" disabled={!ownControls} aria-pressed={captionsOn} onClick={toggleCaptions}>
            Captions {captionsOn ? 'on' : 'off'}
          </button>
          <button type="button" className="film__drawer" aria-pressed={drawer} onClick={() => setDrawer((open) => !open)}>
            {drawer ? 'Hide transcript' : 'Transcript'}
          </button>
          {several && (
            <button
              type="button"
              className="film__list-toggle"
              aria-label={listOpen ? 'Hide films' : `Show ${films.length} films`}
              aria-pressed={listOpen}
              onClick={() => onList(!listOpen)}
            >
              <span aria-hidden="true">{[0, 1, 2].map((row) => <span key={row}><span /><span /></span>)}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * What a film is called in the list. The collection holds no titles for its
 * films, so none is made up: a ceremony film says so, because its start time
 * says so, and any other is described by its length.
 */
function title(film: PublishedFilm): string {
  if ((film.startSeconds ?? 0) > 0) return 'From the ceremony';
  const minutes = Math.max(1, Math.round((film.durationSeconds ?? 0) / 60));
  return `A ${minutes}-minute film`;
}

/** m:ss, or h:mm:ss for a ceremony. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const mm = Math.floor(whole / 60) % 60;
  const ss = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
