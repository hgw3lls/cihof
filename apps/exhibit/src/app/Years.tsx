import { useEffect, useMemo, useState } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import { inductionClasses, undatedCount } from '../state/selectors.ts';
import { Portrait } from './Portrait.tsx';

type Props = {
  people: readonly RuntimePerson[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

/**
 * The collection as a chronology of induction classes, one class at a time.
 *
 * The year stands large on the left, the class beside it, and every class year
 * along the bottom within reach. A strip cell exists only for a year that has
 * a class, so there is no empty year to land on.
 *
 * Every class, always. The search and filters belong to People and narrow only
 * its grid; a visitor who chose somebody there arrives here on their class.
 */
export function Years({ people, selectedId, onSelect, onOpen }: Props) {
  const classes = useMemo(() => inductionClasses(people), [people]);
  const undated = useMemo(() => undatedCount(people), [people]);
  const selectedYear = people.find((person) => person.id === selectedId)?.classYear ?? null;
  const [year, setYear] = useState<number | null>(selectedYear);

  // Opening Years with somebody chosen opens on their class; otherwise the first.
  const shown = classes.find((entry) => entry.year === year) ?? classes[0] ?? null;
  useEffect(() => { if (selectedYear !== null) setYear(selectedYear); }, [selectedYear]);

  const chosen = shown?.people.find((person) => person.id === selectedId) ?? null;

  if (!shown) {
    return <p className="empty">No induction classes yet.</p>;
  }

  return (
    <div className="years">
      <section className="years__class" aria-labelledby={`class-${shown.year}`}>
        <div className="years__poster">
          {/* A touch chooses a portrait; opening it is a second, visible step,
              as in People. Nothing asks a visitor to guess at a double tap. */}
          {chosen && (
            <div className="chosen" aria-label="Selected person" role="group">
              <p className="chosen__name">{chosen.name}</p>
              <button type="button" className="block block--lens" onClick={() => onOpen(chosen.id)}>Read the record</button>
            </div>
          )}
          <p className="years__label" aria-hidden="true">Class of</p>
          <p className="years__numeral" aria-hidden="true">{shown.year}</p>
        </div>

        <div className="years__people">
          <h2 id={`class-${shown.year}`}>
            {/* Not "the first class": the earliest year here is the earliest in
                this collection, and nothing in it says the hall began then. */}
            Class of {shown.year}
            <span className="years__count">{shown.people.length} {shown.people.length === 1 ? 'person' : 'people'}</span>
          </h2>
          <ul className="years__grid">
            {shown.people.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="tile tile--tall"
                  aria-pressed={selectedId === person.id}
                  onClick={() => onSelect(person.id)}
                  onDoubleClick={() => onOpen(person.id)}
                >
                  <Portrait person={person} lazy />
                  <span className="caption">{person.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {undated > 0 && (
            <p className="empty">
              {undated} {undated === 1 ? 'person has' : 'people have'} no recorded induction year and {undated === 1 ? 'is' : 'are'} not placed in a class.
            </p>
          )}
        </div>
      </section>

      <nav className="years__strip" aria-label="Induction classes">
        {classes.map((entry) => (
          <button
            key={entry.year}
            type="button"
            aria-current={entry.year === shown.year ? 'true' : undefined}
            onClick={() => setYear(entry.year)}
          >
            {entry.year}
          </button>
        ))}
      </nav>
    </div>
  );
}
