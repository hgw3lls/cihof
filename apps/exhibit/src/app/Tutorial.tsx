import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { Modal } from './Modal.tsx';
import type { TutorialStep } from './tutorial.ts';

/**
 * A walk round the controls, one at a time, for somebody who has just come in
 * from the attract screen, and for anybody who asks with How this works.
 *
 * It points at each control rather than describing where it is: the control
 * is lit and the rest of the display dimmed. Nothing in it moves on a timer;
 * each step waits for the visitor. It never keeps anyone: Skip is on every
 * step, Escape closes it, and a touch anywhere outside the panel lets it go.
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
        <div className="tutorial__panel" data-step={step.id}>
          <p className="tutorial__kicker">How this works · {at + 1} of {steps.length}</p>
          <h2 id="tutorialTitle" data-autofocus tabIndex={-1}>{step.title}</h2>
          <p className="tutorial__body" aria-live="polite">{step.body}</p>
          <div className="tutorial__actions">
            {!last && <button type="button" className="tutorial__skip" onClick={onClose}>Skip</button>}
            {at > 0 && <button type="button" onClick={() => setAt(at - 1)}>Back</button>}
            <button type="button" className="tutorial__next" onClick={() => (last ? onClose() : setAt(at + 1))}>
              {last ? 'Start exploring' : 'Next'}
            </button>
          </div>
          <p className="tutorial__hint">Or touch anywhere outside this box to close it.</p>
        </div>
      </div>
    </Modal>
  );
}

type Box = { left: number; top: number; width: number; height: number };

/**
 * Where the control a step is about sits on the screen, in screen pixels. The
 * dialog is drawn in the top layer, outside the scaled stage, so it reads the
 * box the browser measured rather than working it out from design pixels.
 */
function useTargetBox(selector: string | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const element = selector ? document.querySelector(selector) : null;
      const rect = element?.getBoundingClientRect();
      setBox(rect && rect.width > 0 && rect.height > 0
        ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selector]);
  return box;
}
