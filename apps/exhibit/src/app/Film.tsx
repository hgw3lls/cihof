import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal.tsx';
import type { PublishedFilm } from '@cihof/content';
import { mediaCountsAsActivity } from '../state/session.ts';

type Props = {
  film: PublishedFilm;
  personName: string;
  onClose: () => void;
  /** Called while playback is genuinely progressing, to hold the session open. */
  onProgress: () => void;
};

/**
 * Plays a cleared film.
 *
 * The transcript sits beside the film rather than behind a control, because it
 * is the only way in for a visitor who cannot hear it and the only way to read
 * it on a wall with no sound. Captions are a track on the element, so they are
 * the browser's to render and the visitor's to turn off.
 *
 * Progress is reported to the session only while the film is actually moving.
 * A film paused, ended or stalled on a broken network is not somebody standing
 * there, and must not hold the display open all evening.
 */
export function Film({ film, personName, onClose, onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // A ceremony film opens at this person's part of it, when a curator has
  // approved where that is. Seeking there is not a visitor watching, so it
  // does not count as progress.
  const start = film.startSeconds ?? 0;
  const lastTime = useRef(start);
  const seeked = useRef(false);
  const [problem, setProblem] = useState('');
  // Three states, not two. An empty string meant both "still fetching" and
  // "could not be fetched", so every film announced that its transcript had
  // failed for as long as the request was in flight — a message that is not
  // true yet, on the one part of the panel a visitor is told to rely on.
  const [transcript, setTranscript] = useState<string | null>(null);

  useEffect(() => {
    // Stop the film before the element goes, so audio cannot outlive the panel,
    // and let go of its captions and its source. Chromium keeps a caption
    // track that still has cues registered with the page after the panel has
    // gone, and through it the video and every caption: one more of each for
    // every film watched, on a display that runs for weeks. `npm run
    // endurance` found it. Focus, Escape and inertness belong to the Modal.
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      // Still on the page means this was not the panel closing (development
      // mode runs every effect twice), and the film must keep its captions.
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(asset(film.transcript))
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then((text) => { if (!cancelled) setTranscript(text); })
      .catch(() => { if (!cancelled) setTranscript(''); });
    setTranscript(null);
    return () => { cancelled = true; };
  }, [film.transcript]);

  const [playingNow, setPlayingNow] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [time, setTime] = useState({ current: 0, duration: film.durationSeconds ?? 0 });

  const reportProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const progressing = video.currentTime > lastTime.current;
    lastTime.current = video.currentTime;
    setTime({ current: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : film.durationSeconds ?? 0 });
    if (mediaCountsAsActivity({ paused: video.paused, ended: video.ended, progressing })) onProgress();
  }, [onProgress, film.durationSeconds]);

  // A bundle that names no playable source is a build fault, not a visitor's
  // problem. Fall through to the words rather than taking the modal down.
  const source = film.source;
  const playable = source?.kind === 'youtube'
    ? Boolean(source.embedUrl)
    : Boolean(source?.kind === 'local-file' && source.src);
  const ownControls = playable && !problem && source?.kind === 'local-file';

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
    reportProgress();
  };
  const fromBeginning = () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  };
  const back = () => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  };
  const toggleCaptions = () => {
    const track = videoRef.current?.textTracks[0];
    const next = !captionsOn;
    if (track) track.mode = next ? 'showing' : 'hidden';
    setCaptionsOn(next);
  };
  const share = time.duration > 0 ? Math.min(time.current / time.duration, 1) : 0;

  return (
    <Modal className="film" labelledBy="filmTitle" onClose={onClose}>
      <header className="film__header">
        <h2 id="filmTitle" data-autofocus tabIndex={-1}>{personName}</h2>
        <span>{start > 0 ? 'Film · from their part of the ceremony' : 'Film'}</span>
      </header>

      <div className="film__body">
        <div className="film__screen">
          {problem || !playable
            ? (
              <div className="film__problem" role="alert">
                <p>{problem}</p>
                <p>The transcript beside it carries the whole of what was said.</p>
              </div>
            )
            : source.kind === 'youtube'
              ? (
                // The embedded player carries YouTube's own captions, not the
                // reviewed ones: an iframe cannot be given a track element.
                // The reviewed transcript beside it is what this release stands
                // behind, so it is announced rather than left to be noticed.
                <div className="film__embed">
                  <iframe
                    title={`Film of ${personName}`}
                    src={source.embedUrl}
                    allow="accelerometer; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                  <p className="film__note">
                    This film plays from the hall&rsquo;s channel and uses that player&rsquo;s own captions.
                    The reviewed transcript is beside it.
                  </p>
                </div>
              )
              : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    preload="metadata"
                    poster={asset(film.poster)}
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
                  <div className="film__progress" aria-hidden="true">
                    <span className="film__track"><span style={{ width: `${share * 100}%` }} /></span>
                    <span className="film__times">{clock(time.current)} / {clock(time.duration)}</span>
                  </div>
                </>
              )}
        </div>

        <section className="film__transcript" aria-label={`Transcript of ${personName}`}>
          <h3>Transcript</h3>
          {transcript === null
            ? <p className="film__loading">Loading the transcript…</p>
            : transcript
              ? <div>{transcript.split(/\n{2,}/).map((part, index) => <p key={index}>{part.trim()}</p>)}</div>
              : <p className="film__problem">The transcript could not be loaded.</p>}
        </section>
      </div>

      <div className="film__controls">
        <button type="button" className="film__close" onClick={onClose}>Close film</button>
        {ownControls && (
          <>
            <button type="button" className="block block--people" onClick={togglePlay}>
              <span className={playingNow ? 'pause' : 'play'} aria-hidden="true" />
              {playingNow ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={back}>Back 10 s</button>
            {start > 0 && <button type="button" className="film__beginning" onClick={fromBeginning}>From the beginning</button>}
          </>
        )}
        <span className="film__who">{personName}</span>
        {ownControls && (
          <button type="button" aria-pressed={captionsOn} onClick={toggleCaptions}>
            Captions {captionsOn ? 'on' : 'off'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** m:ss, or h:mm:ss for a ceremony, for the times under the film. */
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
