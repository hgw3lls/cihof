import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AttractText, RuntimePerson } from '../data/runtime.ts';
import type { AttractMode } from './attract-settings.ts';
import { Portrait } from './Portrait.tsx';
import { Lockup } from './Lockup.tsx';

type Props = {
  people: readonly RuntimePerson[];
  mode: AttractMode;
  spotlightMs: number;
  motion: boolean;
  /** Approved words, or null until a curator approves them. */
  text: AttractText | null;
  onBegin: () => void;
  onBeginWith: (personId: string) => void;
};

const hallName = 'Cleveland International Hall of Fame';

/** Mosaic: twelve portraits across, seven rows down, at 1920 × 1080. */
const mosaicColumns = 12;
const mosaicRows = 7;
/** The text panel covers the bottom-left seven columns from the fourth row down. */
const underPanel = (index: number) => index % mosaicColumns < 7 && Math.floor(index / mosaicColumns) >= 3;
/** Stacked: a strip of twelve across and two down. */
const stripSize = 24;

/**
 * What the display shows while nobody is using it.
 *
 * Three arrangements, chosen in the display's admin. Every one is an
 * invitation: touching a face or a name starts on People with that person
 * chosen, and touching the call to action starts with nobody chosen.
 *
 * Nothing here stays still for months. The spotlight moves on a timer, and the
 * rows of names drift unless motion is off, so no portrait or word burns into
 * the screen. A visitor who has asked their device not to animate gets the
 * rows standing still; the spotlight still moves, without a transition.
 *
 * The words come from the content data and wait for a curator's approval like
 * any visitor text. Until then the screen names the hall and nothing more.
 */
export function Attract({ people, mode, spotlightMs, motion, text, onBegin, onBeginWith }: Props) {
  // A fresh order each time the screen appears, so over a day every person has
  // their turn at the front of the mosaic and in the strip.
  const order = useMemo(() => shuffled(people), [people]);
  const cells = mode === 'mosaic' ? fill(order, mosaicColumns * mosaicRows) : mode === 'stacked' ? order.slice(0, stripSize) : order;
  const candidates = mode === 'mosaic' ? cells.map((_, index) => index).filter((index) => !underPanel(index)) : cells.map((_, index) => index);
  const spot = useSpotlight(candidates, spotlightMs, mode === 'stacked');
  const spotPerson = spot === null ? null : cells[spot] ?? null;

  // With approved words, the name sits small above the headline. Without
  // them, the name with its skyline is the headline.
  const words = text
    ? (
      <>
        <p className="attract__label"><Lockup /></p>
        <h2 className="attract__headline">
          {text.headline}
          {text.unreviewed && <em className="unreviewed">Unreviewed</em>}
        </h2>
        {text.tagline && <p className="attract__tagline">{text.tagline}</p>}
      </>
    )
    : <h2 className="attract__headline attract__headline--name"><Lockup variant="display" /></h2>;

  return (
    <div className={`attract attract--${mode}`} data-motion={motion ? 'on' : 'off'} style={{ '--spotlight-ms': `${spotlightMs}ms` } as CSSProperties}>
      <h1 className="visually-hidden">{hallName}</h1>
      {/* The call to action comes first in the document, so it is the first
          thing a keyboard or a screen reader reaches; the layout places it. */}

      {mode === 'mosaic' && (
        <>
          <div className="attract__panel" onClick={onBegin}>
            <button type="button" className="block block--people attract__cta" data-begin onClick={(event) => { event.stopPropagation(); onBegin(); }}>
              <span>Touch any face</span>
              <span className="attract__or">or here to see everyone</span>
            </button>
            <div className="attract__words">{words}</div>
          </div>
          <ul className="attract__mosaic" aria-label="Inductees">
            {cells.map((person, index) => (
              <li key={`${person.id}:${index}`}>
                <button
                  type="button"
                  className="attract__face"
                  aria-current={index === spot ? 'true' : undefined}
                  // A repeated face is the same person again; one button each is enough to hear.
                  {...(cells.indexOf(person) !== index ? { tabIndex: -1, 'aria-hidden': true } : {})}
                  aria-label={person.name}
                  onClick={() => onBeginWith(person.id)}
                >
                  <Portrait person={person} decorative />
                  {index === spot && <span className="attract__tag">{person.name}{person.classYear ? ` · ${person.classYear}` : ''}</span>}
                </button>
              </li>
            ))}
          </ul>

        </>
      )}

      {mode !== 'mosaic' && (
        <>
          <header className="attract__masthead">
            <p>{text ? <Lockup /> : null}</p>
            <p>{people.length} {people.length === 1 ? 'name' : 'names'}</p>
          </header>

          <div className="attract__bar">
            <button type="button" className="block block--people attract__cta" data-begin onClick={onBegin}>
              {mode === 'names' ? 'Touch a name' : 'Touch a name or face'}
              <span className="square" aria-hidden="true" />
            </button>
            <div className="attract__words">{words}</div>
          </div>
          <NameRows people={order} rows={mode === 'names' ? 6 : 3} spotId={spotPerson?.id ?? null} onBeginWith={onBeginWith} />

          {mode === 'stacked' && (
            <ul className="attract__strip" aria-label="Inductees">
              {cells.map((person, index) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className="attract__face"
                    aria-current={index === spot ? 'true' : undefined}
                    aria-label={person.name}
                    onClick={() => onBeginWith(person.id)}
                  >
                    <Portrait person={person} decorative />
                    {index === spot && <span className="attract__chip">{person.name}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

        </>
      )}
    </div>
  );
}

/**
 * Rows of names drifting sideways. Each row holds its names twice so the loop
 * has no seam; the second copy is for the eye only.
 */
function NameRows({ people, rows, spotId, onBeginWith }: {
  people: readonly RuntimePerson[];
  rows: number;
  spotId: string | null;
  onBeginWith: (personId: string) => void;
}) {
  const lines = Array.from({ length: rows }, (_, row) => people.filter((_, index) => index % rows === row));
  return (
    <div className="attract__names">
      {lines.map((line, row) => (
        <div
          key={row}
          className={`attract__row${row % 2 === 1 ? ' attract__row--dim' : ''}`}
          style={{ '--row-seconds': `${120 + row * 14}s`, '--row-direction': row % 2 === 0 ? 'normal' : 'reverse' } as CSSProperties}
        >
          <ul className="attract__track">
            {[0, 1].flatMap((copy) => line.map((person) => (
              <li key={`${copy}:${person.id}`} {...(copy === 1 ? { 'aria-hidden': true } : {})}>
                <button
                  type="button"
                  className="attract__name"
                  aria-current={person.id === spotId ? 'true' : undefined}
                  {...(copy === 1 ? { tabIndex: -1 } : {})}
                  onClick={() => onBeginWith(person.id)}
                >
                  {person.name}
                </button>
              </li>
            )))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Which cell is lit. It moves every `intervalMs`, to a random cell or to the
 * next one along, and stops while the page is hidden. Every timer it starts it
 * clears: a display runs for weeks.
 */
function useSpotlight(candidates: readonly number[], intervalMs: number, sequential: boolean): number | null {
  const key = candidates.join(',');
  const [spot, setSpot] = useState<number | null>(candidates[0] ?? null);

  useEffect(() => {
    if (candidates.length === 0) { setSpot(null); return undefined; }
    setSpot((current) => (current !== null && candidates.includes(current) ? current : candidates[0]!));
    let timer: number | null = null;
    const move = () => setSpot((current) => {
      if (sequential) {
        const at = current === null ? -1 : candidates.indexOf(current);
        return candidates[(at + 1) % candidates.length]!;
      }
      const others = candidates.filter((index) => index !== current);
      return others[Math.floor(Math.random() * others.length)] ?? candidates[0]!;
    });
    const start = () => { if (timer === null) timer = window.setInterval(move, intervalMs); };
    const stop = () => { if (timer !== null) { window.clearInterval(timer); timer = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // `key` stands for the candidates’ contents.
  }, [key, intervalMs, sequential]);

  return spot;
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

/** Enough cells to fill the screen, repeating the list when it is short. */
function fill<T>(items: readonly T[], count: number): T[] {
  if (items.length === 0) return [];
  return Array.from({ length: count }, (_, index) => items[index % items.length]!);
}
