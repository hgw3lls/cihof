import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import {
  clampPan, field, homeView, pullToOpen, tileFrame, zoomAbout,
  type Pull, type View, type WallLayout,
} from '../state/wall.ts';
import { asset, focalPoint } from './Portrait.tsx';
import { useStageScale } from './Stage.tsx';

type Props = {
  people: readonly RuntimePerson[];
  layout: WallLayout;
  width: number;
  selectedId: string | null;
  pair: readonly [string, string] | null;
  letters: readonly string[];
  letter: string | null;
  /** Changing it puts the view back to the whole wall. */
  viewKey: string;
  onSelect: (personId: string) => void;
  onClear: () => void;
  onPair: (personIds: readonly [string, string]) => void;
  onOpen: (personId: string) => void;
  onLetter: (letter: string | null) => void;
};

type Pointer = { id: string | null; x0: number; y0: number; x: number; y: number; t0: number; moved: boolean; together: boolean };
type Pinch = { dist: number; view: View; cx: number; cy: number };

const holdMs = 420;
const ease = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

/**
 * Every face at once, arranged by the layout it is given.
 *
 * A touch on a face chooses it; holding one lifts it with its name; pulling
 * one down opens its story; two fingers on two faces set them side by side.
 * Pinch, a wheel with Ctrl, or two fingers apart zooms; a drag on the ground
 * pans once zoomed; a double tap on the ground puts the whole wall back.
 *
 * Each face is also a button, so a keyboard or a switch reaches everybody by
 * the same route: Enter chooses, as a touch does.
 */
export function Wall({ people, layout, width, selectedId, pair, letters, letter, viewKey, onSelect, onClear, onPair, onOpen, onLetter }: Props) {
  const scale = useStageScale();
  const fieldRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const pinch = useRef<Pinch | null>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const [view, setView] = useState<View>(homeView);
  const [held, setHeldState] = useState<string | null>(null);
  const [pull, setPullState] = useState<(Pull & { id: string }) | null>(null);
  const [gesturing, setGesturingState] = useState(false);
  // A gesture's events can arrive faster than React draws, so the handlers
  // read what is happening from these, never from the last render.
  const viewRef = useRef(view);
  viewRef.current = view;
  const heldRef = useRef<string | null>(null);
  const pullRef = useRef<(Pull & { id: string }) | null>(null);
  const gesturingRef = useRef(false);
  const setHeld = (id: string | null) => { heldRef.current = id; setHeldState(id); };
  const setPull = (next: (Pull & { id: string }) | null) => { pullRef.current = next; setPullState(next); };
  const setGesturing = (on: boolean) => { gesturingRef.current = on; setGesturingState(on); };

  useEffect(() => { setView(homeView); }, [viewKey]);
  // A narrower field (the sheet opening) must not leave the wall panned past its edge.
  useEffect(() => { setView((current) => ({ ...current, pan: clampPan(current.pan, current.zoom, width) })); }, [width]);
  useEffect(() => () => clearHold(), []);

  // Ctrl or ⌘ with the wheel zooms, as a trackpad pinch does. It has to be a
  // listener of our own: React's wheel listener is passive and cannot stop the
  // page itself zooming.
  useEffect(() => {
    const element = fieldRef.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const at = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
      setView((current) => zoomAbout(current, event.deltaY < 0 ? 1.08 : 0.93, at, width));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [scale, width]);

  function clearHold() {
    if (holdTimer.current !== null) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
  }

  const tileAt = (target: EventTarget | null): string | null => {
    const element = target instanceof Element ? target.closest<HTMLElement>('[data-id]') : null;
    return element?.dataset.id ?? null;
  };

  const choose = (personId: string) => {
    if (selectedId === personId && !pair) onClear(); else onSelect(personId);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const id = tileAt(event.target);
    const pointer: Pointer = { id, x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY, t0: Date.now(), moved: false, together: false };
    pointers.current.set(event.pointerId, pointer);
    // Keep the gesture when a finger strays off the face, or off the field.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointers.current.size === 1 && id) {
      clearHold();
      holdTimer.current = window.setTimeout(() => {
        if (pointers.current.size === 1 && !pointer.moved) setHeld(id);
      }, holdMs);
    }
    if (pointers.current.size === 2) {
      clearHold();
      const [a, b] = [...pointers.current.values()] as [Pointer, Pointer];
      // Neither finger of a two-finger gesture counts as a tap when it lifts.
      a.together = true;
      b.together = true;
      if (a.id && b.id && a.id !== b.id) {
        onPair([a.id, b.id]);
        setHeld(null);
        setPull(null);
      }
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), view: viewRef.current, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointers.current.get(event.pointerId);
    if (!pointer) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const dx = (pointer.x - pointer.x0) / scale;
    const dy = (pointer.y - pointer.y0) / scale;
    if (!pointer.moved && Math.hypot(dx, dy) > 10) {
      pointer.moved = true;
      clearHold();
      if (heldRef.current) setHeld(null);
    }

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [Pointer, Pointer];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(dist - pinch.current.dist) <= 14 && !gesturingRef.current) return;
      const start = pinch.current;
      const rect = fieldRef.current!.getBoundingClientRect();
      const at = { x: (start.cx - rect.left) / scale, y: (start.cy - rect.top) / scale };
      const next = zoomAbout(start.view, dist / Math.max(1, start.dist), at, width);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      setView({ zoom: next.zoom, pan: clampPan({ x: next.pan.x + (cx - start.cx) / scale, y: next.pan.y + (cy - start.cy) / scale }, next.zoom, width) });
      setGesturing(true);
      setPull(null);
      return;
    }

    if (pointers.current.size !== 1 || !pointer.moved) return;
    if (pointer.id && !heldRef.current) {
      setPull({ id: pointer.id, dx, dy, ready: dy > pullToOpen });
    } else if (!pointer.id && viewRef.current.zoom > 1) {
      const from = panStart.current ?? (panStart.current = { ...viewRef.current.pan });
      setView((current) => ({ ...current, pan: clampPan({ x: from.x + dx, y: from.y + dy }, current.zoom, width) }));
      setGesturing(true);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointers.current.get(event.pointerId);
    if (!pointer) return;
    pointers.current.delete(event.pointerId);
    clearHold();
    if (pointers.current.size === 0) { pinch.current = null; panStart.current = null; }

    const pulled = pullRef.current;
    if (pulled && pulled.id === pointer.id) {
      setPull(null);
      setGesturing(false);
      if (pulled.ready) onOpen(pulled.id);
      return;
    }
    if (heldRef.current && heldRef.current === pointer.id) { setHeld(null); return; }
    if (pointers.current.size === 0 && gesturingRef.current) { setGesturing(false); return; }
    if (event.type === 'pointercancel' || pointer.together) return;
    if (pointer.id && !pointer.moved && Date.now() - pointer.t0 < holdMs) {
      if (event.shiftKey && selectedId && selectedId !== pointer.id) { onPair([selectedId, pointer.id]); return; }
      choose(pointer.id);
    }
  };

  const zoomed = Math.abs(view.zoom - 1) > 0.01;
  const locked = Boolean(selectedId || pair);

  return (
    <div
      ref={fieldRef}
      className="field"
      style={{ width }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => { if (!tileAt(event.target)) setView(homeView); }}
    >
      <div
        className="field__view"
        style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`, transition: gesturing ? 'none' : `transform 450ms ${ease}` }}
      >
        {layout.labels.map((label) => (
          <div
            key={`${label.text}:${label.x}:${label.y}`}
            className="wall__label"
            aria-hidden="true"
            style={{ transform: `translate(${label.x}px, ${label.y}px)`, width: label.w, fontSize: label.size, color: label.color }}
          >
            {label.text}
          </div>
        ))}
        {people.map((person, index) => {
          const slot = layout.slots.get(person.id) ?? { x: 0, y: field.height + 40, size: 8, dim: 2 };
          const selected = selectedId === person.id || Boolean(pair?.includes(person.id));
          const frame = tileFrame({
            slot, person, selected, held: held === person.id,
            pull: pull && pull.id === person.id ? pull : null, view, width,
          });
          const away = slot.dim >= 2 && !selected;
          const moving = (pull && pull.id === person.id) || gesturing;
          return (
            <button
              key={person.id}
              type="button"
              className="tile"
              data-id={person.id}
              aria-label={person.name}
              aria-pressed={selected}
              {...(away ? { tabIndex: -1, 'aria-hidden': true } : {})}
              // Only a keyboard or a switch arrives here: a touch is handled by
              // the field, which is also watching for a hold or a pull.
              onClick={(event) => { if (event.detail === 0) choose(person.id); }}
              style={{
                transform: `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`,
                zIndex: frame.z,
                opacity: frame.opacity,
                pointerEvents: away ? 'none' : 'auto',
                transition: moving
                  ? 'transform 60ms linear, opacity 500ms'
                  : `transform 900ms ${ease} ${(index % 37) * 9}ms, opacity 500ms`,
              } as CSSProperties}
            >
              <img
                src={person.portrait ? asset(person.portrait.src) : asset('media/placeholder.svg')}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                data-colour={frame.colour ? 'true' : undefined}
                style={{ objectPosition: focalPoint(person) }}
              />
              {frame.plate && (
                <span
                  className="tile__plate"
                  data-ready={pull?.ready && pull.id === person.id ? 'true' : undefined}
                  data-up={frame.plateUp ? 'true' : undefined}
                  data-right={frame.plateRight ? 'true' : undefined}
                >
                  {frame.plate}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {layout.rail && (
        <nav
          className="rail"
          aria-label="Letters"
          aria-disabled={locked}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {letters.map((each) => (
            <button
              key={each}
              type="button"
              disabled={locked}
              aria-pressed={letter === each}
              onClick={() => onLetter(letter === each ? null : each)}
            >
              {each}
            </button>
          ))}
        </nav>
      )}

      {zoomed && (
        <button
          type="button"
          className="field__reset"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setView(homeView)}
        >
          Zoomed {view.zoom.toFixed(1)}× · reset
        </button>
      )}
    </div>
  );
}
