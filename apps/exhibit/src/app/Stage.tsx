import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { stageShape, type Fit, type Shape } from './shape.ts';

/**
 * The exhibit is drawn in design pixels and scaled whole to the screen it is
 * on, without distortion. On the display the stage is 1920 × 1080 and a
 * screen of another shape shows the ground around it; on the public site the
 * stage takes the screen's own proportions (shape.ts).
 *
 * On the public site the stage keeps inside the screen's safe area, clear of
 * a phone's notch and home indicator (the page asks for the whole screen with
 * `viewport-fit=cover`), and the ground fills in behind them.
 *
 * The scale and the stage's size are also custom properties on the root,
 * because a dialog is drawn in the browser's top layer, outside this stage,
 * and draws its own copy. The shape's kind is on the root as `data-shape`,
 * for the same reason.
 */
const StageShape = createContext<Shape>(stageShape(1920, 1080, 'fixed'));

/** Screen pixels per design pixel, for turning a finger's travel into design pixels. */
export function useStageScale(): number {
  return useContext(StageShape).scale;
}

export function useStageShape(): Shape {
  return useContext(StageShape);
}

/** The shape of the screen now, measured again whenever the window changes size. */
export function useMeasuredShape(fit: Fit): Shape {
  const [shape, setShape] = useState(() => measure(fit));
  const [shift, setShift] = useState(() => offset(fit));

  useEffect(() => {
    const update = () => setShape((current) => {
      const next = measure(fit);
      // A phone's keyboard shortens the screen while somebody types. The stage
      // keeps its height rather than rearranging everything under their fingers.
      const typing = document.activeElement instanceof HTMLInputElement;
      if (typing && next.kind === 'phone' && current.kind === 'phone' && next.width === current.width) return current;
      return same(current, next) ? current : next;
    });
    const updateAll = () => {
      update();
      const next = offset(fit);
      setShift((current) => (current.x === next.x && current.y === next.y ? current : next));
    };
    updateAll();
    window.addEventListener('resize', updateAll);
    return () => window.removeEventListener('resize', updateAll);
  }, [fit]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--stage-scale', String(shape.scale));
    root.setProperty('--stage-w', `${shape.width}px`);
    root.setProperty('--stage-h', `${shape.height}px`);
    // Where the safe area's centre is, from the screen's: the stage and every dialog's copy sit there.
    root.setProperty('--stage-dx', `${shift.x}px`);
    root.setProperty('--stage-dy', `${shift.y}px`);
    document.documentElement.dataset.shape = shape.kind;
  }, [shape, shift]);

  return shape;
}

/** The shape, for the stage and for the dialogs drawn outside it. */
export function ShapeProvider({ shape, children }: { shape: Shape; children: ReactNode }) {
  return <StageShape.Provider value={shape}>{children}</StageShape.Provider>;
}

export function Stage({ children }: { children: ReactNode }) {
  const shape = useStageShape();
  return <div className="stage" style={{ width: shape.width, height: shape.height }}>{children}</div>;
}

function measure(fit: Fit): Shape {
  const inset = fit === 'fill' ? safeArea() : none;
  return stageShape(window.innerWidth - inset.left - inset.right, window.innerHeight - inset.top - inset.bottom, fit);
}

function offset(fit: Fit): { x: number; y: number } {
  const inset = fit === 'fill' ? safeArea() : none;
  return { x: (inset.left - inset.right) / 2, y: (inset.top - inset.bottom) / 2 };
}

type Insets = { top: number; right: number; bottom: number; left: number };
const none: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
let probe: HTMLElement | null = null;

/** The screen's safe-area insets, in screen pixels, read from CSS (0 where there are none). */
function safeArea(): Insets {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;'
      + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const px = (value: string) => Number.parseFloat(value) || 0;
  return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
}

function same(a: Shape, b: Shape): boolean {
  return a.kind === b.kind && a.width === b.width && a.height === b.height && a.scale === b.scale;
}
