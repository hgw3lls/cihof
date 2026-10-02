import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Modal } from './Modal.tsx';
import type { TutorialStep } from './tutorial.ts';

/**
 * A walk round the controls, one at a time, for anybody who asks for it: from
 * the invitation a visitor is offered on coming in, or the key on the bar.
 *
 * It points at each control rather than describing where it is: the control
 * is lit and the rest of the display dimmed. Nothing in it moves on a timer;
 * each step waits for the visitor. It never keeps anyone. Every step has the
 * same three ways on: Next skips to the following step, Start again goes back
 * to the first, and Stop closes it; Escape and a touch anywhere outside the
 * panel close it too.
 */
export function Tutorial({ steps, motion, onClose }: {
  steps: readonly TutorialStep[];
  /** The display's motion setting. A visitor's own reduced-motion preference is honoured by the stylesheet. */
  motion: boolean;
  onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const step = steps[Math.min(at, steps.length - 1)]!;
  const last = at >= steps.length - 1;
  const lit = useTargetBox(step.target);
  const panel = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  // A key that goes away with the step it was on (Back, on the first) would
  // drop focus to the page behind; the step's title takes it instead.
  useEffect(() => {
    if (!panel.current?.contains(document.activeElement)) title.current?.focus();
  }, [at]);
  const goTo = (next: number) => {
    setAt(next);
    if (next === 0) title.current?.focus();
  };

  return (
    <Modal className="tutorial" labelledBy="tutorialTitle" onClose={onClose}>
      <div
        className="tutorial__layer"
        data-motion={motion ? 'on' : 'off'}
        data-lit={lit ? 'true' : undefined}
        // A touch that is not on the panel is a visitor getting on with it.
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        {lit && (
          <span
            className="tutorial__ring"
            aria-hidden="true"
            style={{ left: lit.left, top: lit.top, width: lit.width, height: lit.height } as CSSProperties}
          />
        )}
        <div ref={panel} className="tutorial__panel" data-step={step.id}>
          <p className="tutorial__kicker">How this works · {at + 1} of {steps.length}</p>
          <h2 ref={title} id="tutorialTitle" data-autofocus tabIndex={-1}>{step.title}</h2>
          <p className="tutorial__body" aria-live="polite">{step.body}</p>
          <div className="tutorial__actions">
            <button type="button" className="tutorial__stop" onClick={onClose}>Stop</button>
            <button type="button" className="tutorial__restart" disabled={at === 0} onClick={() => goTo(0)}>Start again</button>
            <button type="button" className="tutorial__back" disabled={at === 0} onClick={() => goTo(at - 1)}>Back</button>
            <button type="button" className="tutorial__next" onClick={() => (last ? onClose() : goTo(at + 1))}>
              {last ? 'Start exploring' : 'Next'}
            </button>
          </div>
          <p className="tutorial__hint">
            {last ? 'Or touch anywhere outside this box to close it.' : 'Next skips to the following step. Or touch anywhere outside this box to stop.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The offer of How this works, for somebody who has just come in from the
 * attract screen. One line in the masthead, where the subtitle sits, so it
 * covers none of the wall a visitor came to see.
 *
 * It asks nothing of anyone who ignores it. Their first touch anywhere else
 * retires it, and so does being left alone for `retireMs` (config.ts); the key
 * on the bar offers the same guide for the rest of the visit either way.
 */
export function TutorialInvitation({ retireMs, onOpen, onDismiss }: {
  retireMs: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), retireMs);
    // Captured, so a touch on the wall still does what it was for as well.
    const elsewhere = (event: PointerEvent) => {
      if (!(event.target instanceof Node && root.current?.contains(event.target))) dismiss.current();
    };
    document.addEventListener('pointerdown', elsewhere, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', elsewhere, true);
    };
  }, [retireMs]);
  return (
    <div ref={root} className="invitation" role="status">
      <span className="invitation__text">New here?</span>
      <button type="button" className="invitation__open" aria-haspopup="dialog" onClick={onOpen}>How this works</button>
      <button type="button" className="invitation__dismiss" onClick={onDismiss}>No thanks</button>
    </div>
  );
}

type Box = { left: number; top: number; width: number; height: number };

/**
 * Where the control a step is about sits on the screen, in screen pixels. The
 * dialog is drawn in the top layer, outside the scaled stage, so it reads the
 * box the browser measured rather than working it out from design pixels.
 *
 * Measured again whenever the stage may have moved it: a resize or a phone
 * turned arrives before the stage is redrawn at its new size, so the stage's
 * own record of its size and scale on the root element (Stage.tsx) is watched
 * too, and the control itself, and each change is measured on the next frame,
 * once the new layout is in place.
 */
function useTargetBox(selector: string | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const element = selector ? document.querySelector(selector) : null;
      const rect = element?.getBoundingClientRect();
      setBox(rect && rect.width > 0 && rect.height > 0
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : null);
    };
    const soon = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', soon);
    const stage = new MutationObserver(soon);
    stage.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-shape'] });
    const element = selector ? document.querySelector(selector) : null;
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    if (element) resized?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', soon);
      stage.disconnect();
      resized?.disconnect();
    };
  }, [selector]);
  return box;
}
