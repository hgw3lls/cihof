import type { RuntimePerson } from '../data/runtime.ts';

/**
 * A person's cleared portrait, or the placeholder when none is cleared.
 *
 * The focal point keeps a face in frame however the picture is cropped; a
 * portrait without one is held a little above centre, where faces usually are.
 */
export function Portrait({ person, className, lazy = false, decorative = false }: {
  person: RuntimePerson;
  className?: string;
  lazy?: boolean;
  /** When the name is already beside it, the picture adds nothing to read out. */
  decorative?: boolean;
}) {
  if (!person.portrait) {
    return <img className={className} src={asset('media/placeholder.svg')} alt="" aria-hidden="true" />;
  }
  const focal = person.portrait.focalPoint && person.portrait.focalPoint !== 'center' ? person.portrait.focalPoint : '50% 18%';
  return (
    <img
      className={className}
      src={asset(person.portrait.src)}
      alt={decorative ? '' : person.portrait.alt}
      {...(decorative ? { 'aria-hidden': true } : {})}
      {...(lazy ? { loading: 'lazy' as const } : {})}
      decoding="async"
      style={{ objectPosition: focal }}
    />
  );
}

export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
