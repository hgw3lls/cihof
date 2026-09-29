/**
 * The stage's shape on the screen it is on.
 *
 * The installed display is drawn at 1920 × 1080 exactly (`fixed`), and a
 * screen of another shape shows the ground around it.
 *
 * The public site fills whatever screen it is opened on (`fill`). A landscape
 * screen keeps the display's arrangement, the stage widened or deepened to the
 * screen's proportions. A screen held upright, a phone's or a tablet's, gets
 * the phone arrangement: the wall above, the controls along the foot, and a
 * chosen person's sheet rising from below. Its design pixel is kept near a
 * screen pixel, so the type stays the size it was drawn at.
 */
export type Fit = 'fixed' | 'fill';

export type Shape = {
  readonly kind: 'wall' | 'phone';
  /** In design pixels. */
  readonly width: number;
  readonly height: number;
  /** Screen pixels per design pixel. */
  readonly scale: number;
};

export const designSize = { width: 1920, height: 1080 } as const;
/** An upright stage is at least this wide, so a small phone scales the design down a little rather than cramping it. */
const phoneWidth = 560;

export function stageShape(screenWidth: number, screenHeight: number, fit: Fit): Shape {
  const vw = Math.max(1, screenWidth);
  const vh = Math.max(1, screenHeight);
  if (fit === 'fixed') {
    return { kind: 'wall', ...designSize, scale: Math.min(vw / designSize.width, vh / designSize.height) };
  }
  if (vw < vh) {
    const scale = Math.min(1, Math.max(0.6, vw / phoneWidth));
    return { kind: 'phone', width: Math.round(vw / scale), height: Math.round(vh / scale), scale };
  }
  const aspect = vw / vh;
  const width = Math.round(Math.max(designSize.width, designSize.height * aspect));
  const height = Math.round(Math.max(designSize.height, designSize.width / aspect));
  return { kind: 'wall', width, height, scale: vw / width };
}

/**
 * Which fit a build uses: the public site fills the screen, the display does
 * not. `?fit=fill` or `?fit=fixed` on the address overrides it, so either can
 * be checked on the other's build.
 */
export function readFit(search: string, target: string | undefined): Fit {
  const asked = new URLSearchParams(search).get('fit');
  if (asked === 'fill' || asked === 'fixed') return asked;
  return target === 'public' ? 'fill' : 'fixed';
}
