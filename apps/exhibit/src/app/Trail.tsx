import type { RuntimePerson } from '../data/runtime.ts';
import { focalPoint, portraitUrl } from './Portrait.tsx';

/**
 * The walk through Connections so far, along the top of the diagram: each
 * person chosen, joined to the one before. Touching an earlier face goes back
 * to them. A note on the right says what the diagram cannot draw, such as
 * a presenter who is not in the hall.
 */
export function Trail({ people, note, onStep }: {
  people: readonly RuntimePerson[];
  note: string;
  onStep: (personId: string) => void;
}) {
  return (
    <>
      {people.length > 1 && (
        <nav className="trail" aria-label="Your thread" onPointerDown={(event) => event.stopPropagation()}>
          <span className="trail__label">Your thread</span>
          {people.map((person, index) => (
            <span key={`${person.id}:${index}`} className="trail__step">
              {index > 0 && <span className="trail__join" aria-hidden="true" />}
              <button
                type="button"
                aria-label={person.name}
                aria-current={index === people.length - 1 ? 'step' : undefined}
                style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }}
                onClick={() => onStep(person.id)}
              />
            </span>
          ))}
        </nav>
      )}
      {note && <p className="trail__note">{note}</p>}
    </>
  );
}
