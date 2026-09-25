import { useMemo, useState } from 'react';
import type { RuntimePerson, RuntimePlace } from '../data/runtime.ts';
import { Portrait } from './Portrait.tsx';

type Props = {
  places: readonly RuntimePlace[];
  people: readonly RuntimePerson[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

/**
 * The collection as the places its people worked in: an index of places on
 * the left, the chosen place on the right.
 *
 * Only reviewed places reach this component. `publishedPlaces` filters the
 * seeds by the same publication rules as everything else, and the lens is
 * absent below its threshold — so an unreviewed lead cannot appear here by any
 * route outside an editor's preview, where it is marked.
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

  // Opening Places with somebody chosen opens on a place tied to them.
  const [chosenId, setChosenId] = useState<string | null>(
    () => shown.find(({ present }) => present.some((person) => person.id === selectedId))?.place.id ?? null,
  );

  if (shown.length === 0) {
    return <p className="empty">No reviewed place is published in this release.</p>;
  }

  const unreviewed = shown.filter(({ place }) => place.unreviewed).length;
  const current = shown.find(({ place }) => place.id === chosenId) ?? shown[0]!;
  const { place, present } = current;

  return (
    <div className="places">
      <nav className="places__index" aria-label="Places">
        <p className="places__note">
          {unreviewed === 0
            ? `${shown.length} ${shown.length === 1 ? 'place' : 'places'} in Greater Cleveland, each one reviewed.`
            : `${shown.length} ${shown.length === 1 ? 'place' : 'places'}, ${unreviewed} of them not yet reviewed.`}
        </p>
        <ul>
          {shown.map((entry) => (
            <li key={entry.place.id}>
              <button
                type="button"
                aria-current={entry.place.id === place.id ? 'true' : undefined}
                onClick={() => setChosenId(entry.place.id)}
              >
                {entry.place.neighborhood && <span className="places__hood">{entry.place.neighborhood}</span>}
                <span className="places__name">
                  {entry.place.name}
                  {entry.place.unreviewed && <em className="unreviewed">Unreviewed</em>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="places__place" aria-labelledby={`place-${place.id}`}>
        {place.neighborhood && <p className="places__kicker">{place.neighborhood}</p>}
        <h2 id={`place-${place.id}`}>
          {place.name}
          {place.unreviewed && <em className="unreviewed">Unreviewed</em>}
        </h2>

        {place.shortHistory && <p className="places__history">{place.shortHistory}</p>}

        <h3 className="places__tied">People tied here</h3>
        {present.length > 0
          ? (
            <ul className="places__people">
              {present.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className="tile"
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
          )
          : (
            <p className="places__pending">
              {place.unreviewed
                ? 'Nobody is tied to this place in the sources yet.'
                : 'Nobody is shown here yet. The place has been reviewed; the people connected to it have not.'}
            </p>
          )}
      </section>
    </div>
  );
}
