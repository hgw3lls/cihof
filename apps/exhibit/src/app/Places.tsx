import { useMemo } from 'react';
import type { PublishedPlace } from '@cihof/content';
import type { RuntimePerson } from '../data/runtime.ts';

type Props = {
  places: readonly PublishedPlace[];
  people: readonly RuntimePerson[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

/**
 * The collection as the places its people worked in.
 *
 * Only reviewed places reach this component. `publishedPlaces` filters the
 * seeds by the same publication rules as everything else, and the lens is
 * absent below its threshold — so an unreviewed lead, of which this collection
 * currently holds sixty-eight, cannot appear here by any route.
 *
 * The people under a place are the ties a curator gave a role to. A tie with no
 * role is refused upstream, including the catch-all `associated`, on the
 * grounds that it does not say what the person did there. That is why a place
 * can appear with nobody under it: the place was reviewed and its ties were
 * not, and saying so is better than implying the place stood empty.
 *
 * Discovery is deliberately absent, as it is in Connections. A place is a fact
 * about the collection rather than a row in a list a visitor is filtering, and
 * narrowing it removes the people they came here to find.
 */
export function Places({ places, people, selectedId, onSelect, onOpen }: Props) {
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  const shown = useMemo(() => places
    .map((place) => ({
      place,
      // A place may name somebody this release withholds. A tile linking to a
      // portrait that is not here is a dead end on a wall.
      present: (place.personIds ?? []).flatMap((id) => {
        const person = byId.get(id);
        return person ? [person] : [];
      }),
    }))
    .sort((a, b) => b.present.length - a.present.length || a.place.name.localeCompare(b.place.name)),
  [places, byId]);

  if (shown.length === 0) {
    return <p className="empty">No reviewed place is published in this release.</p>;
  }

  return (
    <div className="places">
      <p className="places__note">
        {shown.length} {shown.length === 1 ? 'place' : 'places'} in Greater Cleveland, each one reviewed.
      </p>

      {shown.map(({ place, present }) => (
        <section key={place.id} className="places__place" aria-labelledby={`place-${place.id}`}>
          <h2 id={`place-${place.id}`}>
            {place.name}
            {place.neighborhood && <span>{place.neighborhood}</span>}
          </h2>

          {place.shortHistory && <p className="places__history">{place.shortHistory}</p>}

          {present.length > 0
            ? (
              <ul className="grid">
                {present.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      className="tile"
                      aria-pressed={selectedId === person.id}
                      onClick={() => onSelect(person.id)}
                      onDoubleClick={() => onOpen(person.id)}
                    >
                      {person.portrait
                        ? (
                          <img
                            src={asset(person.portrait.src)}
                            alt={person.portrait.alt}
                            loading="lazy"
                            decoding="async"
                            {...(person.portrait.focalPoint ? { style: { objectPosition: person.portrait.focalPoint } } : {})}
                          />
                        )
                        : <img src={asset('media/placeholder.svg')} alt="" aria-hidden="true" />}
                      <span className="caption">{person.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
            : (
              <p className="places__pending">
                Nobody is shown here yet. The place has been reviewed; the people connected to it
                have not.
              </p>
            )}
        </section>
      ))}
    </div>
  );
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
