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
  const lastTime = useRef(0);
  const [problem, setProblem] = useState('');
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    // Stop the film before the element goes, so audio cannot outlive the panel.
    // Focus, Escape and inertness belong to the Modal.
    const video = videoRef.current;
    return () => { video?.pause(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
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
    if (mediaCountsAsActivity({ paused: video.paused, ended: video.ended, progressing })) onProgress();
  }, [onProgress]);

  return (
    <Modal className="film" labelledBy="filmTitle" onClose={onClose}>
      <header>
        <h2 id="filmTitle" data-autofocus tabIndex={-1}>{personName}</h2>
        <button type="button" onClick={onClose}>Close film</button>
      </header>

      <div className="film__body">
        <div className="film__screen">
          {problem
            ? (
              <div className="film__problem" role="alert">
                <p>{problem}</p>
                <p>The transcript below carries the whole of what was said.</p>
              </div>
            )
            : (
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={asset(film.poster)}
                onTimeUpdate={reportProgress}
                onError={() => setProblem('This film could not be played on this display.')}
              >
                <source src={asset(film.src)} type="video/mp4" />
                <track kind="captions" src={asset(film.captions)} srcLang="en" label="English captions" default />
              </video>
            )}
        </div>

        <section className="film__transcript" aria-label={`Transcript of ${personName}`}>
          <h3>Transcript</h3>
          {transcript
            ? <div>{transcript.split(/\n{2,}/).map((part, index) => <p key={index}>{part.trim()}</p>)}</div>
            : <p className="film__problem">The transcript could not be loaded.</p>}
        </section>
      </div>
    </Modal>
  );
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
