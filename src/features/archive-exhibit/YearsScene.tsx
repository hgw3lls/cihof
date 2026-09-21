import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject, type PointerEvent, type WheelEvent } from 'react';
import { stopMediaElement } from '../../app/mediaControl';
import type { Inductee } from '../../data/types';
import { assetUrl, duration, type Film } from './archiveModel';

type Props = {
  years: number[];
  people: Inductee[];
  films: Film[];
  selected: Inductee | undefined;
  activeFilm: Film | null;
  scrollRef: MutableRefObject<{ personId: string | undefined; left: number } | null>;
  onPerson: (id: string) => void;
  onPersonRecord: (id: string, origin: HTMLElement) => void;
  onFilm: (film: Film) => void;
  onCloseFilm: () => void;
  onRecord: (origin?: HTMLElement) => void;
  onSessionActivity: () => void;
  portrait: ComponentType<{ person: Inductee; eager?: boolean }>;
};

type PlaybackState = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
type LoadableText = { status: 'loading' | 'ready' | 'error'; text: string };
type ChapterKey = number | 'unknown';

function FilmProjection({ film, onClose, onRecord, onSessionActivity }: {
  film: Film;
  onClose: () => void;
  onRecord: (origin?: HTMLElement) => void;
  onSessionActivity: () => void;
}) {
  const [panel, setPanel] = useState<'video' | 'transcript'>('video');
  const [playback, setPlayback] = useState<PlaybackState>('loading');
  const [captionState, setCaptionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [captionAttempt, setCaptionAttempt] = useState(0);
  const [transcriptAttempt, setTranscriptAttempt] = useState(0);
  const [transcript, setTranscript] = useState<LoadableText>({ status: 'loading', text: '' });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLParagraphElement>(null);
  const videoTabRef = useRef<HTMLButtonElement>(null);
  const transcriptTabRef = useRef<HTMLButtonElement>(null);
  const playingRef = useRef(false);
  const lastProgress = useRef(-1);

  useEffect(() => {
    setPanel('video');
    setPlayback('loading');
    setCaptionState('loading');
    setCaptionAttempt(0);
    setTranscriptAttempt(0);
    playingRef.current = false;
    lastProgress.current = -1;
    const active = document.activeElement;
    if (active === document.body || (active instanceof HTMLElement && active.id.startsWith('film-trigger-'))) {
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [film.key]);

  useEffect(() => {
    const path = film.asset.captionRuntimePath;
    if (!path) {
      setCaptionState('error');
      return;
    }

    const controller = new AbortController();
    setCaptionState('loading');
    void fetch(assetUrl(path), { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Captions unavailable');
      return response.text();
    }).then((content) => {
      if (!content.trimStart().startsWith('WEBVTT')) throw new Error('Captions invalid');
      setCaptionState('ready');
    }).catch(() => {
      if (!controller.signal.aborted) setCaptionState('error');
    });
    return () => controller.abort();
  }, [film.key, film.asset.captionRuntimePath, captionAttempt]);

  useEffect(() => {
    const inlineText = film.asset.transcript?.text?.trim();
    if (inlineText) {
      setTranscript({ status: 'ready', text: inlineText });
      return;
    }

    const path = film.asset.transcriptRuntimePath || film.asset.transcript?.runtimePath;
    if (!path) {
      setTranscript({ status: 'error', text: '' });
      return;
    }

    const controller = new AbortController();
    setTranscript({ status: 'loading', text: '' });
    void fetch(assetUrl(path), { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Transcript unavailable');
      return response.text();
    }).then((content) => {
      const text = content.trim();
      if (!text) throw new Error('Transcript empty');
      setTranscript({ status: 'ready', text });
    }).catch(() => {
      if (!controller.signal.aborted) setTranscript({ status: 'error', text: '' });
    });
    return () => controller.abort();
  }, [film.key, film.asset.transcript?.runtimePath, film.asset.transcript?.text, film.asset.transcriptRuntimePath, transcriptAttempt]);

  useEffect(() => () => stopMediaElement(videoRef.current), [film.key]);

  function setPlaybackActive(active: boolean, state: PlaybackState) {
    playingRef.current = active;
    setPlayback(state);
  }

  function recordProgress(media: HTMLVideoElement) {
    const currentTime = media.currentTime;
    // A replay or backward seek starts a new progress interval.
    if (currentTime < lastProgress.current) lastProgress.current = currentTime - 0.1;
    if (!playingRef.current || !Number.isFinite(currentTime) || currentTime <= lastProgress.current + 0.05) return;
    lastProgress.current = currentTime;
    onSessionActivity();
  }

  async function startPlayback(restart = false) {
    const video = videoRef.current;
    if (!video) return;
    if (restart) {
      if (playback === 'error') video.load();
      else video.currentTime = 0;
    }
    setPlayback('loading');
    try {
      await video.play();
    } catch {
      setPlaybackActive(false, 'error');
    }
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (playingRef.current && !video.paused) {
      video.pause();
      return;
    }
    void startPlayback(playback === 'ended' || playback === 'error');
  }

  function selectPanel(next: 'video' | 'transcript') {
    setPanel(next);
    window.requestAnimationFrame(() => {
      if (next === 'video') videoRef.current?.focus({ preventScroll: true });
      else transcriptRef.current?.focus({ preventScroll: true });
    });
  }

  function moveTab(next: 'video' | 'transcript') {
    setPanel(next);
    (next === 'video' ? videoTabRef : transcriptTabRef).current?.focus();
  }

  const primaryAction = playback === 'playing' ? 'PAUSE' : playback === 'ended' ? 'REPLAY' : playback === 'error' ? 'RETRY' : 'PLAY';
  const titleId = `film-title-${film.key}`;
  const videoPanelId = `film-video-${film.key}`;
  const transcriptPanelId = `film-transcript-${film.key}`;

  return <section className="film-projection" data-panel={panel} aria-labelledby={titleId}>
    <header className="film-projection__header"><div className="film-projection__identity">
      <h2 id={titleId} ref={titleRef} tabIndex={-1}>{film.person.name}</h2>
      <span>INDUCTION CLASS {film.person.classYear ?? 'YEAR NOT RECORDED'} / FILM {film.index + 1} / {duration(film.asset.durationSeconds)}</span>
    </div>
      <button type="button" onClick={togglePlayback}>{primaryAction}</button>
      <button type="button" id="filmRecordButton" onClick={(event) => onRecord(event.currentTarget)}>OPEN RECORD</button>
      <button type="button" aria-label="Close film" onClick={onClose}>CLOSE</button>
    </header>
    <div className="film-projection__tabs" role="tablist" aria-label="Film and transcript">
      <button ref={videoTabRef} type="button" role="tab" aria-selected={panel === 'video'} aria-controls={videoPanelId}
        onClick={() => selectPanel('video')} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); moveTab('transcript'); } }}>FILM</button>
      <button ref={transcriptTabRef} type="button" role="tab" aria-selected={panel === 'transcript'} aria-controls={transcriptPanelId}
        onClick={() => selectPanel('transcript')} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab('video'); } }}>TRANSCRIPT</button>
    </div>
    <div className="film-projection__body">
      <div className="film-projection__screen" id={videoPanelId} role="tabpanel">
        <video key={film.key} ref={videoRef} controls playsInline preload="metadata" poster={assetUrl(film.asset.posterRuntimePath!)} src={assetUrl(film.asset.runtimePath!)}
          aria-label={`Film ${film.index + 1} from ${film.person.name}'s archive`}
          onLoadStart={() => setPlayback('loading')}
          onLoadedMetadata={() => setPlayback((current) => current === 'loading' ? 'ready' : current)}
          onCanPlay={() => setPlayback((current) => current === 'loading' ? 'ready' : current)}
          onPlay={() => { setPlaybackActive(true, 'playing'); onSessionActivity(); }}
          onPlaying={() => setPlaybackActive(true, 'playing')}
          onPause={(event) => { if (!event.currentTarget.ended) setPlaybackActive(false, 'paused'); }}
          onWaiting={() => setPlayback('loading')}
          onStalled={() => setPlayback('loading')}
          onSeeking={() => setPlayback('loading')}
          onSeeked={(event) => setPlayback(event.currentTarget.paused ? 'paused' : 'playing')}
          onEnded={() => setPlaybackActive(false, 'ended')}
          onError={() => setPlaybackActive(false, 'error')}
          onTimeUpdate={(event) => recordProgress(event.currentTarget)}>
          <track key={captionAttempt} kind="captions" src={assetUrl(film.asset.captionRuntimePath!)} srcLang="en" label="English captions" default
            onLoad={() => setCaptionState('ready')} onError={() => setCaptionState('error')} />
        </video>
        {playback === 'loading' && <div className="film-projection__status" role="status">LOADING FILM</div>}
        {playback === 'error' && <div className="film-projection__failure" role="alert"><strong>FILM UNAVAILABLE</strong>
          <span>The record and transcript remain available.</span><div><button type="button" onClick={() => void startPlayback(true)}>RETRY FILM</button>
            <button type="button" onClick={(event) => onRecord(document.getElementById('filmRecordButton') ?? event.currentTarget)}>OPEN PERSON RECORD</button></div></div>}
        {captionState === 'error' && <div className="film-projection__caption-error" role="alert"><span>CAPTIONS COULD NOT LOAD. THE TRANSCRIPT REMAINS AVAILABLE.</span>
          <button type="button" onClick={() => { setCaptionState('loading'); setCaptionAttempt((attempt) => attempt + 1); }}>RETRY CAPTIONS</button></div>}
      </div>
      <section className="film-projection__transcript" id={transcriptPanelId} role="tabpanel" aria-label={`Transcript for ${film.person.name}, film ${film.index + 1}`}>
        <div className="film-projection__transcript-heading"><strong>CAPTIONS + TRANSCRIPT</strong>
          <span>{transcript.status === 'ready' ? 'AVAILABLE' : transcript.status === 'error' ? 'UNAVAILABLE' : 'LOADING'}</span></div>
        {transcript.status === 'ready' && <p ref={transcriptRef} className="film-projection__transcript-body" tabIndex={0}>{transcript.text}</p>}
        {transcript.status === 'loading' && <p className="film-projection__transcript-message" role="status">LOADING TRANSCRIPT</p>}
        {transcript.status === 'error' && <div className="film-projection__transcript-failure" role="alert"><strong>TRANSCRIPT COULD NOT LOAD</strong>
          <button type="button" onClick={() => setTranscriptAttempt((attempt) => attempt + 1)}>RETRY TRANSCRIPT</button></div>}
      </section>
    </div>
  </section>;
}

function chapterId(key: ChapterKey) {
  return key === 'unknown' ? 'induction-year-unknown' : `induction-year-${key}`;
}

function chapterLabel(key: ChapterKey) {
  return key === 'unknown' ? 'YEAR NOT RECORDED' : String(key);
}

export function YearsScene({ years, people, films, selected, activeFilm, scrollRef, onPerson, onPersonRecord, onFilm, onCloseFilm, onRecord, onSessionActivity, portrait: Portrait }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const unknownPeople = useMemo(() => people.filter((person) => person.classYear === null).sort((a, b) => a.name.localeCompare(b.name)), [people]);
  const chapters = useMemo<ChapterKey[]>(() => [...years, ...(unknownPeople.length ? ['unknown' as const] : [])], [years, unknownPeople.length]);
  const [currentChapter, setCurrentChapter] = useState<ChapterKey>(chapters[0] ?? 'unknown');
  const pendingJump = useRef<ChapterKey | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dragged = useRef(false);
  const peopleByYear = useMemo(() => {
    const grouped = new Map<number, Inductee[]>();
    for (const year of years) grouped.set(year, []);
    for (const person of people) {
      if (person.classYear !== null) grouped.get(person.classYear)?.push(person);
    }
    for (const entries of grouped.values()) entries.sort((a, b) => a.name.localeCompare(b.name));
    return grouped;
  }, [people, years]);
  const filmsByPerson = useMemo(() => {
    const grouped = new Map<string, Film[]>();
    for (const film of films) grouped.set(film.person.id, [...(grouped.get(film.person.id) ?? []), film]);
    return grouped;
  }, [films]);

  function chapter(key: ChapterKey) {
    return viewportRef.current?.querySelector<HTMLElement>(`#${chapterId(key)}`);
  }

  // Portraits and web fonts land after the first paint, and every one of them
  // widens the class it belongs to. A scroll offset computed before that is
  // pointing at a different class afterwards, which left the visitor in 2011
  // having asked for 2026. Re-aim at the class they chose until it stops moving.
  useEffect(() => {
    const strip = stripRef.current;
    const viewport = viewportRef.current;
    if (!strip || !viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const key = pendingJump.current;
      const target = key ? chapter(key) : null;
      if (!target) return;
      const left = chapterScrollLeft(viewport, target);
      if (Math.abs(viewport.scrollLeft - left) > 2) viewport.scrollTo({ left, behavior: 'instant' });
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  function revealInRail(key: ChapterKey) {
    railRef.current?.querySelector<HTMLElement>(`[data-year='${key}']`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function chapterScrollLeft(viewport: HTMLElement, target: HTMLElement) {
    return Math.max(0, Math.min(target.offsetLeft, viewport.scrollWidth - viewport.clientWidth));
  }

  function jump(key: ChapterKey, smooth = true) {
    const viewport = viewportRef.current;
    const target = chapter(key);
    if (!viewport || !target) return;
    const left = chapterScrollLeft(viewport, target);
    // A smooth jump crosses every class in between, and each of those scroll
    // events used to re-announce the chronology and re-scroll the rail. That
    // slid the year chips out from under the visitor mid-tap, so asking for
    // 2026 could land on whichever year the animation happened to be passing.
    // An explicit jump now owns the rail until the scroll reaches it.
    pendingJump.current = Math.abs(viewport.scrollLeft - left) > 2 ? key : null;
    viewport.scrollTo({ left, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    setCurrentChapter(key);
    revealInRail(key);
  }

  function visibleChapter() {
    const viewport = viewportRef.current;
    if (!viewport) return chapters[0] ?? 'unknown';
    const start = viewport.scrollLeft;
    for (const key of chapters) {
      const target = chapter(key);
      if (target && start < target.offsetLeft + target.offsetWidth - 2) return key;
    }
    return chapters[chapters.length - 1] ?? 'unknown';
  }

  function onScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    scrollRef.current = { personId: selected?.id, left: viewport.scrollLeft };
    const pending = pendingJump.current;
    if (pending) {
      const target = chapter(pending);
      if (target && Math.abs(viewport.scrollLeft - chapterScrollLeft(viewport, target)) > 2) return;
      pendingJump.current = null;
    }
    const key = visibleChapter();
    setCurrentChapter(key);
    revealInRail(key);
  }

  function relative(step: number) {
    const index = chapters.indexOf(pendingJump.current ?? visibleChapter());
    jump(chapters[Math.max(0, Math.min(chapters.length - 1, index + step))]);
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    pendingJump.current = null;
    event.currentTarget.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    if (Math.abs(event.clientX - drag.current.x) > 6) dragged.current = true;
    if (dragged.current) { pendingJump.current = null; event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); }
  }

  function endDrag() {
    drag.current = null;
    window.setTimeout(() => { dragged.current = false; }, 0);
  }

  function closeFilm() {
    const triggerId = activeFilm ? `film-trigger-${activeFilm.key}` : '';
    onCloseFilm();
    window.requestAnimationFrame(() => document.getElementById(triggerId)?.focus({ preventScroll: true }));
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !chapters.length) return;
    pendingJump.current = null;
    const selectedChapter: ChapterKey | undefined = selected ? selected.classYear ?? 'unknown' : undefined;
    const key = selectedChapter ?? chapters[0];
    const target = chapter(key);
    if (scrollRef.current && scrollRef.current.personId === selected?.id) viewport.scrollLeft = scrollRef.current.left;
    else if (selected && target) viewport.scrollLeft = target.offsetLeft;
    else if (target) viewport.scrollLeft = target.offsetLeft;
    scrollRef.current = { personId: selected?.id, left: viewport.scrollLeft };
    setCurrentChapter(visibleChapter());
  }, [selected?.id, chapters]);

  function renderPerson(person: Inductee) {
    const personFilms = filmsByPerson.get(person.id) ?? [];
    const selectedPerson = selected?.id === person.id;
    const yearText = person.classYear === null ? 'induction year not recorded' : `inducted ${person.classYear}`;
    return <article className={`year-person${selectedPerson ? ' is-selected' : ''}`} key={person.id} data-person-id={person.id}>
      <button className="year-person__identity" type="button" aria-pressed={selectedPerson} aria-label={`Select ${person.name}, ${yearText}`} onClick={() => onPerson(person.id)}>
        <Portrait person={person} eager={selectedPerson} />
        <span className="year-person__copy"><strong>{person.name}</strong><small>{person.classYear === null ? 'INDUCTION YEAR NOT RECORDED' : `INDUCTED ${person.classYear}`}</small>
          {personFilms.length > 0 && <em>{personFilms.length} {personFilms.length === 1 ? 'FILM' : 'FILMS'} AVAILABLE</em>}</span>
      </button>
      <div className="year-person__actions">
        <button id={`year-record-${person.id}`} type="button" onClick={(event) => onPersonRecord(person.id, event.currentTarget)}>READ RECORD</button>
        {personFilms.map((film) => <button id={`film-trigger-${film.key}`} type="button" key={film.key} aria-expanded={activeFilm?.key === film.key}
          aria-label={`${activeFilm?.key === film.key ? 'Close' : 'Watch'} film ${film.index + 1} for ${person.name}, ${duration(film.asset.durationSeconds)}`}
          onClick={() => activeFilm?.key === film.key ? closeFilm() : onFilm(film)}>{activeFilm?.key === film.key ? 'CLOSE FILM' : `WATCH FILM ${film.index + 1}`}<span>{duration(film.asset.durationSeconds)}</span></button>)}
      </div>
    </article>;
  }

  return <section className={`film-line${activeFilm ? ' film-line--playing' : ''}`} aria-label="Induction class chronology"
    onKeyDown={(event) => { if (event.key === 'Escape' && activeFilm) { event.stopPropagation(); closeFilm(); } }}>
    {activeFilm && <FilmProjection film={activeFilm} onClose={closeFilm} onRecord={onRecord} onSessionActivity={onSessionActivity} />}
    <div className="film-line__viewport" ref={viewportRef} tabIndex={0} aria-label="Induction chronology; use left and right arrow keys to move between classes"
      onScroll={onScroll} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { relative(event.key === 'ArrowLeft' ? -1 : 1); event.preventDefault(); }
        if (event.key === 'Home' || event.key === 'End') { jump(event.key === 'Home' ? chapters[0] : chapters[chapters.length - 1]); event.preventDefault(); }
      }}>
      <div className="film-line__strip" ref={stripRef}>{chapters.map((key) => {
        const entries = key === 'unknown' ? unknownPeople : peopleByYear.get(key) ?? [];
        const availableFilmCount = entries.reduce((count, person) => count + (filmsByPerson.get(person.id)?.length ?? 0), 0);
        const selectedHere = selected ? (selected.classYear ?? 'unknown') === key : false;
        return <section className={`film-year${selectedHere ? ' film-year--selected' : ''}`} key={key} id={chapterId(key)} aria-label={key === 'unknown' ? 'Induction year not recorded' : `${key} induction class`}>
          <header className="film-year__heading"><span>{key === 'unknown' ? 'INDUCTION DATE' : 'INDUCTION CLASS'}</span><h2>{chapterLabel(key)}</h2>
            <p>{entries.length} {entries.length === 1 ? 'INDUCTEE' : 'INDUCTEES'}{availableFilmCount ? ` / ${availableFilmCount} ${availableFilmCount === 1 ? 'FILM' : 'FILMS'} AVAILABLE` : ''}</p></header>
          <div className="film-year__people">{entries.map(renderPerson)}</div>
        </section>;
      })}{chapters.length === 0 && <p className="empty">NO INDUCTION RECORDS AVAILABLE</p>}</div>
    </div>
    <nav className="film-line__rail" aria-label="Jump to induction class">
      <span className="film-line__current" data-year={chapterLabel(currentChapter)}>{people.length} INDUCTEES / {films.length} FILMS AVAILABLE</span>
      <div className="film-line__controls"><button type="button" aria-label="Previous induction class" title="Previous induction class" disabled={currentChapter === chapters[0]} onClick={() => relative(-1)}>←</button>
        <button type="button" aria-label="Next induction class" title="Next induction class" disabled={currentChapter === chapters[chapters.length - 1]} onClick={() => relative(1)}>→</button></div>
      <div className="film-line__years" ref={railRef}>{chapters.map((key) => <button className="film-line__year" type="button" key={key} data-year={key}
        aria-current={currentChapter === key ? 'date' : undefined} aria-label={key === 'unknown' ? `Jump to records with no induction year, ${unknownPeople.length} people` : `Jump to ${key} induction class, ${peopleByYear.get(key)?.length ?? 0} people`}
        onClick={() => jump(key)}>{key === 'unknown' ? 'YEAR ?' : key}</button>)}</div>
    </nav>
  </section>;
}
