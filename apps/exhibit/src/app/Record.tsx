import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import { kicker, paragraphs } from '../state/selectors.ts';
import { Modal } from './Modal.tsx';
import { Portrait, focalPoint, portraitUrl } from './Portrait.tsx';
import { Rich } from './Rich.tsx';

/**
 * A page is as wide as the window onto the columns: on the display two
 * columns of 456 with a 56 gap (968), on a phone one. The next page begins a
 * further gap along, so on the display pages are 1024 apart.
 */
const columnGap = 56;
const swipe = 60;

/**
 * A person's story, over the wall: their portrait full height on the left,
 * the story on the right in columns, turned a page at a time by a swipe or the
 * arrows below it, and the next person's story one touch away.
 *
 * No scrolling: a visitor at a wall turns pages. Focus trapping, inertness,
 * Escape and focus return are the Modal's, so this is only about what a story
 * says and how it is read.
 */
export function Record({ person, next, ties, onClose, onNext, onShare, onPlay, onConnections }: {
  person: RuntimePerson;
  /** The next story along the wall, if there is anybody else. */
  next: RuntimePerson | null;
  /** How many documented ties they have, for the way into Connections. */
  ties: number;
  onClose: () => void;
  onNext: (personId: string) => void;
  onShare?: () => void;
  onPlay?: (filmId: string) => void;
  /** Present only when this release offers Connections. */
  onConnections?: () => void;
}) {
  const parts = paragraphs(person.biography);
  const columns = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [stride, setStride] = useState(1024);
  const start = useRef<number | null>(null);

  // Each story starts on its first page.
  useEffect(() => { setPage(0); }, [person.id]);

  // How many pages the columns ran to, once the words are laid out in their
  // own face; measured again when the fonts arrive.
  const measure = useCallback(() => {
    const element = columns.current;
    if (!element) return;
    const across = element.clientWidth + columnGap;
    setStride(across);
    setPages(Math.max(1, Math.round((element.scrollWidth + columnGap) / across)));
  }, []);
  useLayoutEffect(measure, [measure, person.id]);
  useEffect(() => { void document.fonts?.ready.then(measure); }, [measure]);
  // A phone turned, or a window resized, lays the columns out again.
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const turn = (by: number) => setPage((current) => Math.min(pages - 1, Math.max(0, current + by)));
  const onDown = (event: PointerEvent) => { start.current = event.clientX; };
  const onUp = (event: PointerEvent) => {
    if (start.current === null) return;
    // In design pixels: the story is drawn outside the stage, at its scale.
    const scale = Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')) || 1;
    const dx = (event.clientX - start.current) / scale;
    start.current = null;
    if (Math.abs(dx) > swipe) turn(dx < 0 ? 1 : -1);
  };

  const films = onPlay ? person.films : [];
  const shown = Math.min(page, pages - 1);

  return (
    <Modal className="record" labelledBy="recordTitle" onClose={onClose}>
      <div
        className="dialog-stage story"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') turn(1);
          if (event.key === 'ArrowLeft') turn(-1);
        }}
      >
        <div className="story__portrait">
          <Portrait person={person} className="story__image" />
          <div className="story__fade" aria-hidden="true" />
          {/* No film is offered where none can play: the public site carries none. */}
          {films.length > 0 && (
            <button type="button" className="story__film" onClick={() => onPlay?.(films[0]!.id)}>
              <span className="story__play" aria-hidden="true"><span /></span>
              {films.length > 1 ? `Watch ${films.length} films` : 'Watch the film'}
            </button>
          )}
          <div className="story__who">
            <p className="story__kicker">{kicker(person)}</p>
            <h2 id="recordTitle" data-autofocus tabIndex={-1}>{person.name}</h2>
            {person.contributions.length > 0 && <p className="story__honored">Honored for {person.contributions.join(' · ')}</p>}
            {/* The roster's own record of who presented them, as text: most
                were presented by somebody who is not in the hall. */}
            {person.presentedBy && <p className="story__honored">Presented by {person.presentedBy.recordedName}</p>}
          </div>
        </div>

        <div className="story__reading" onPointerDown={onDown} onPointerUp={onUp}>
          {(onConnections || onShare) && (
            <div className="story__ways">
              {onConnections && ties > 0 && (
                <button type="button" onClick={onConnections}>{ties} {ties === 1 ? 'connection' : 'connections'}</button>
              )}
              {onShare && <button type="button" onClick={onShare}>Take it with you</button>}
            </div>
          )}
          <div className="story__window">
            <div ref={columns} className="story__columns" style={{ transform: `translateX(${-shown * stride}px)` }}>
              {parts.map((part, index) => <p key={index}><Rich text={part} /></p>)}
              <p className="story__credit">
                {person.biographyCurated
                  ? 'Biography reviewed and edited by Hall of Fame curators.'
                  : 'Biography as recorded by the Cleveland International Hall of Fame.'}
              </p>
            </div>
          </div>
          {pages > 1 && <p className="story__hint" aria-hidden="true">Swipe to turn the page</p>}
        </div>

        <div className="story__bar">
          <button type="button" className="story__back" onClick={onClose}><span aria-hidden="true">←</span>Back to the wall</button>
          <div className="story__paging">
            <button type="button" aria-label="Previous page" disabled={shown <= 0} onClick={() => turn(-1)}>‹</button>
            <span className="story__page">
              <span aria-live="polite">Page {shown + 1} of {pages}</span>
              <span className="story__dots" aria-hidden="true">
                {Array.from({ length: pages }, (_, index) => <span key={index} data-current={index === shown ? 'true' : undefined} />)}
              </span>
            </span>
            <button type="button" aria-label="Next page" disabled={shown >= pages - 1} onClick={() => turn(1)}>›</button>
          </div>
          {next
            ? (
              <button type="button" className="story__next" onClick={() => onNext(next.id)}>
                <span className="story__thumb" aria-hidden="true" style={{ backgroundImage: portraitUrl(next), backgroundPosition: focalPoint(next) }} />
                <span className="story__next-text">
                  <span className="story__next-label">Next story</span>
                  <span className="story__next-name">{next.name}</span>
                </span>
                <span aria-hidden="true" className="story__arrow">→</span>
              </button>
            )
            : <span />}
        </div>
      </div>
    </Modal>
  );
}
