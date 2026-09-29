import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * The exhibit is drawn once, at 1920 × 1080, and scaled whole to the screen it
 * is on, without distortion. A screen of another shape shows the ground around
 * it. Every size in the stylesheet is a design pixel.
 *
 * The scale is also a custom property on the root, because a dialog is drawn
 * in the browser's top layer, outside this stage, and scales its own copy.
 */
export const stageSize = { width: 1920, height: 1080 } as const;

const StageScale = createContext(1);

/** Screen pixels per design pixel, for turning a finger's travel into design pixels. */
export function useStageScale(): number {
  return useContext(StageScale);
}

export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(measure);

  useEffect(() => {
    const update = () => setScale(measure());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--stage-scale', String(scale));
  }, [scale]);

  return (
    <StageScale.Provider value={scale}>
      <div className="stage">{children}</div>
    </StageScale.Provider>
  );
}

function measure(): number {
  return Math.min(window.innerWidth / stageSize.width, window.innerHeight / stageSize.height);
}
