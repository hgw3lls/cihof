import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject, type PointerEvent, type WheelEvent } from 'react';
import type { Inductee } from '../../data/types';
import { assetUrl, duration, type Film } from './archiveModel';

type Props = {
  years: number[];
  people: Inductee[];
  films: Film[];
  selected: Inductee | undefined;
  activeFilm: Film | null;
  scrollRef: MutableRefObject<number | null>;
  onFilm: (film: Film) => void;
  onCloseFilm: () => void;
  onRecord: () => void;
  portrait: ComponentType<{ person: Inductee; eager?: boolean }>;
};

function FilmProjection({ film, onClose, onRecord }: { film: Film; onClose: () => void; onRecord: () => void }) {
  const [panel, setPanel] = useState<'video' | 'transcript'>('video');
  const [transcript, setTranscript] = useState('LOADING TRANSCRIPT');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setPanel('video'); setTranscript('LOADING TRANSCRIPT'); setPlaying(false);
    if (!film.approved) return;
    if (film.asset.transcript?.text) { setTranscript(film.asset.transcript.text); return; }
    const path = film.asset.transcriptRuntimePath || film.asset.transcript?.runtimePath;
    if (!path) { setTranscript('TRANSCRIPT UNAVAILABLE'); return; }
    const controller = new AbortController();
    void fetch(assetUrl(path), { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('Transcript unavailable');
      return response.text();
    }).then((content) => {
      const text = content.trim();
      setTranscript(text.startsWith('Draft transcript generated from ') ? text.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim() : text);
    }).catch(() => { if (!controller.signal.aborted) setTranscript('TRANSCRIPT UNAVAILABLE'); });
    return () => controller.abort();
  }, [film.key, film.approved, film.asset]);

  return <section className={`film-projection${film.approved ? '' : ' film-projection--pending'}`} data-panel={panel} aria-label={`${film.person.name}, film ${film.index + 1}`}>
    <header className="film-projection__header"><div className="film-projection__identity"><strong>{film.person.name}</strong><span>{film.person.classYear} / FILM {film.index + 1} / {duration(film.asset.durationSeconds)}</span></div>
      {film.approved ? <button type="button" onClick={() => { const video = videoRef.current; if (video?.paused) void video.play(); else video?.pause(); }}>{playing ? 'PAUSE' : 'PLAY'}</button>
        : <button type="button" onClick={onRecord}>RECORD</button>}
      <button type="button" aria-label="Close film" onClick={onClose}>CLOSE</button>
    </header>
    {film.approved ? <>
      <div className="film-projection__tabs">{(['video', 'transcript'] as const).map((item) => <button type="button" key={item} aria-pressed={panel === item} onClick={() => setPanel(item)}>{item === 'video' ? 'FILM' : 'TRANSCRIPT'}</button>)}</div>
      <div className="film-projection__body">
        <div className="film-projection__screen"><video key={film.key} ref={videoRef} controls playsInline preload="metadata" poster={assetUrl(film.asset.posterRuntimePath!)} src={assetUrl(film.asset.runtimePath!)}
          aria-label={`Film ${film.index + 1} from ${film.person.name}'s archive`} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
          <track kind="captions" src={assetUrl(film.asset.captionRuntimePath!)} srcLang="en" label="English captions" default />
        </video></div>
        <section className="film-projection__transcript" aria-label={`Transcript for ${film.person.name}, film ${film.index + 1}`}>
          <div className="film-projection__transcript-heading"><strong>CAPTIONS + TRANSCRIPT</strong><span>APPROVED</span></div>
          <p className="film-projection__transcript-body" tabIndex={0}>{transcript}</p>
        </section>
      </div>
    </> : <div className="film-projection__pending"><strong>FILM AWAITING APPROVAL</strong><p>This film is held for rights, caption, and transcript review. The inductee record is available now.</p></div>}
  </section>;
}

export function YearsScene({ years, people, films, selected, activeFilm, scrollRef, onFilm, onCloseFilm, onRecord, portrait: Portrait }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [currentYear, setCurrentYear] = useState(years[0] ?? 0);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dragged = useRef(false);
  const filmsByYear = useMemo(() => {
    const grouped = new Map<number, Film[]>();
    for (const year of years) grouped.set(year, []);
    for (const film of films) { const year = film.person.classYear; if (year !== null) grouped.get(year)?.push(film); }
    return grouped;
  }, [films, years]);
  const peopleByYear = useMemo(() => {
    const grouped = new Map<number, number>();
    for (const person of people) if (person.classYear !== null) grouped.set(person.classYear, (grouped.get(person.classYear) ?? 0) + 1);
    return grouped;
  }, [people]);

  function chapter(year: number) { return viewportRef.current?.querySelector<HTMLElement>(`#film-year-${year}`); }
  function jump(year: number, smooth = true) {
    const viewport = viewportRef.current;
    const target = chapter(year);
    if (!viewport || !target) return;
    viewport.scrollTo({ left: target.offsetLeft, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    setCurrentYear(year);
  }
  function visibleYear() {
    const viewport = viewportRef.current;
    if (!viewport) return years[0] ?? 0;
    const start = viewport.scrollLeft;
    for (const year of years) {
      const target = chapter(year);
      if (!target) continue;
      if (start < target.offsetLeft + target.offsetWidth - 2) return year;
    }
    return years[years.length - 1] ?? 0;
  }
  function onScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    scrollRef.current = viewport.scrollLeft;
    const year = visibleYear();
    setCurrentYear(year);
    const button = railRef.current?.querySelector<HTMLElement>(`[data-year='${year}']`);
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function relative(step: number) { const index = years.indexOf(visibleYear()); jump(years[Math.max(0, Math.min(years.length - 1, index + step))]); }
  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
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
    if (dragged.current) event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
  }
  function endDrag() { drag.current = null; window.setTimeout(() => { dragged.current = false; }, 0); }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !years.length) return;
    if (scrollRef.current !== null) viewport.scrollLeft = scrollRef.current;
    else {
      const year = selected?.classYear && (filmsByYear.get(selected.classYear)?.length ?? 0) > 0
        ? selected.classYear : years.find((item) => (filmsByYear.get(item)?.length ?? 0) > 0) ?? years[0];
      const target = chapter(year);
      if (target) viewport.scrollLeft = target.offsetLeft;
    }
    setCurrentYear(visibleYear());
  }, []);

  return <section className={`film-line${activeFilm ? ' film-line--playing' : ''}`} aria-label="Horizontal archive film timeline">
    <header className="film-line__heading"><strong>THE FILM LINE</strong><span className="film-line__current" data-year={currentYear}>{currentYear} / {years[years.length - 1]} · {films.length} FILMS</span>
      <div className="film-line__controls"><button type="button" aria-label="Previous year" title="Previous year" disabled={currentYear === years[0]} onClick={() => relative(-1)}>←</button>
        <button type="button" aria-label="Next year" title="Next year" disabled={currentYear === years[years.length - 1]} onClick={() => relative(1)}>→</button></div></header>
    {activeFilm && <FilmProjection film={activeFilm} onClose={onCloseFilm} onRecord={onRecord} />}
    <div className="film-line__viewport" ref={viewportRef} tabIndex={0} aria-label={`Film timeline, ${years[0]} to ${years[years.length - 1]}; use left and right arrow keys to navigate`}
      onScroll={onScroll} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      onClickCapture={(event) => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); } }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { relative(event.key === 'ArrowLeft' ? -1 : 1); event.preventDefault(); }
        if (event.key === 'Home' || event.key === 'End') { jump(event.key === 'Home' ? years[0] : years[years.length - 1]); event.preventDefault(); }
      }}>
      <div className="film-line__strip">{years.map((year) => {
        const entries = filmsByYear.get(year) ?? [];
        const count = peopleByYear.get(year) ?? 0;
        return <section className={`film-year${entries.length ? '' : ' film-year--empty'}${selected?.classYear === year ? ' film-year--selected' : ''}`} key={year} id={`film-year-${year}`}>
          <header className="film-year__heading"><h2>{year}</h2><span>{entries.length ? `${entries.length} ${entries.length === 1 ? 'FILM' : 'FILMS'} / ${count} PEOPLE` : count ? `${count} PEOPLE / NO LOCAL FILMS` : 'NO CLASS RECORD'}</span></header>
          <div className="film-year__events">{entries.map((film) => {
            const open = activeFilm?.key === film.key;
            return <article key={film.key} className={`film-event${open ? ' is-open' : ''}${selected?.id === film.person.id ? ' is-selected' : ''}`} id={`film-${film.key}`}>
              <button className="film-event__trigger" type="button" aria-expanded={open} aria-label={`${open ? 'Close' : 'Open'} film ${film.index + 1} for ${film.person.name}, ${film.approved ? duration(film.asset.durationSeconds) : 'awaiting approval'}`}
                onClick={() => open ? onCloseFilm() : onFilm(film)}>
                <span className="film-event__poster">{open ? <span className="film-event__showing">{film.approved ? 'NOW SHOWING' : 'REVIEW PENDING'}</span>
                  : <>{film.approved ? <img src={assetUrl(film.asset.posterRuntimePath!)} alt="" loading="lazy" draggable={false} /> : <Portrait person={film.person} />}
                    <span className="film-event__play" aria-hidden="true">{film.approved ? '▶' : '…'}</span></>}</span>
                <span className="film-event__copy"><strong>{film.person.name}</strong><small>FILM {film.index + 1} · {film.approved ? `${duration(film.asset.durationSeconds)} · CC + TRANSCRIPT` : 'AWAITING APPROVAL'}</small></span>
              </button>
            </article>;
          })}</div>
        </section>;
      })}</div>
    </div>
    <nav className="film-line__rail" aria-label="Jump to year" ref={railRef}>{years.map((year) => <button className="film-line__year" type="button" key={year} data-year={year} data-films={filmsByYear.get(year)?.length ?? 0}
      aria-current={currentYear === year ? 'date' : undefined} aria-label={`Jump to ${year}, ${filmsByYear.get(year)?.length ?? 0} films`} onClick={() => jump(year)}>{year}</button>)}</nav>
  </section>;
}
