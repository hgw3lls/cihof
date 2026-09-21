import { useMemo } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import type { Discovery } from '../state/exhibit.ts';
import { inductionClasses, matching, undatedCount } from '../state/selectors.ts';

type Props = {
  people: readonly RuntimePerson[];
  discovery: Discovery;
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

/**
 * The collection as a chronology of induction classes.
 *
 * Discovery narrows which people appear, exactly as it does in People — it is
 * the same question asked of the same collection. A class that loses everyone
 * to a filter disappears rather than showing an empty year.
 */
export function Years({ people, discovery, selectedId, onSelect, onOpen }: Props) {
  const matches = useMemo(() => matching(people, discovery), [people, discovery]);
  const classes = useMemo(() => inductionClasses(matches), [matches]);
  const undated = useMemo(() => undatedCount(matches), [matches]);

  if (classes.length === 0) {
    return <p className="empty">No induction class matches those choices.</p>;
  }

  return (
    <div className="years">
      {classes.map((entry) => (
        <section key={entry.year} className="class" aria-labelledby={`class-${entry.year}`}>
          <h2 id={`class-${entry.year}`}>
            {entry.year}
            <span>{entry.people.length} {entry.people.length === 1 ? 'person' : 'people'}</span>
          </h2>
          <ul className="grid">
            {entry.people.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="tile"
                  aria-pressed={selectedId === person.id}
                  onClick={() => onSelect(person.id)}
                  onDoubleClick={() => onOpen(person.id)}
                >
                  {person.portrait
                    ? <img src={asset(person.portrait.src)} alt={person.portrait.alt} loading="lazy" decoding="async" style={person.portrait.focalPoint ? { objectPosition: person.portrait.focalPoint } : undefined} />
                    : <img src={asset('media/placeholder.svg')} alt="" aria-hidden="true" />}
                  <span className="caption">{person.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {undated > 0 && (
        <p className="empty">
          {undated} {undated === 1 ? 'person has' : 'people have'} no recorded induction year and {undated === 1 ? 'is' : 'are'} not placed in a class.
        </p>
      )}
    </div>
  );
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
