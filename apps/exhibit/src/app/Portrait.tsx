import type { CSSProperties } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';

/**
 * A person's cleared portrait, or the placeholder when none is cleared.
 *
 * The focal point keeps a face in frame however the picture is cropped; a
 * portrait without one is held a little above centre, where faces usually are.
 */
export function Portrait({ person, className, lazy = false, decorative = false, style }: {
  person: RuntimePerson;
  className?: string;
  lazy?: boolean;
  style?: CSSProperties;
  /** When the name is already beside it, the picture adds nothing to read out. */
  decorative?: boolean;
}) {
  if (!person.portrait) {
    return <img className={className} src={asset('media/placeholder.svg')} alt="" aria-hidden="true" />;
  }
  const focal = focalPoint(person);
  return (
    <img
      className={className}
      src={asset(person.portrait.src)}
      alt={decorative ? '' : person.portrait.alt}
      {...(decorative ? { 'aria-hidden': true } : {})}
      {...(lazy ? { loading: 'lazy' as const } : {})}
      decoding="async"
      style={{ ...style, objectPosition: focal }}
    />
  );
}

/** Where a face sits in its portrait; without a recorded point, a little above centre. */
export function focalPoint(person: RuntimePerson): string {
  const point = person.portrait?.focalPoint;
  return point && point !== 'center' ? point : '50% 18%';
}

/** A portrait as a CSS background, for a square that is decoration beside a name. */
export function portraitUrl(person: RuntimePerson): string {
  return `url("${asset(person.portrait?.src ?? 'media/placeholder.svg')}")`;
}

export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
