/**
 * The Hall of Fame's name with its skyline, as the brand guide sets it
 * (docs/brand/skyline-guidelines.md).
 *
 * The skyline is a mask filled in CSS: the four lens bands on the dark ground,
 * or one colour where fewer than four would show. It is decoration; the words
 * beside it carry the name for a screen reader, and only "of" is italic.
 *
 * `header` is the one-line lockup for the 72px header; `display` sets the
 * name in two lines into the open space right of the skyline's baseline, for
 * the attract screen.
 */
export function Lockup({ variant = 'header' }: { variant?: 'header' | 'display' }) {
  return (
    <span className={`lockup lockup--${variant}`}>
      <span className="skyline" aria-hidden="true" />
      {variant === 'header'
        ? <span className="lockup__name">Cleveland International Hall <i className="lockup__of">of</i> Fame</span>
        : (
          <span className="lockup__name">
            <span className="lockup__line1">Cleveland International </span>
            <span className="lockup__line2">Hall <i className="lockup__of">of</i> Fame</span>
          </span>
        )}
    </span>
  );
}
