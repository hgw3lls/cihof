import { useMemo } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import type { Discovery } from '../state/exhibit.ts';
import { matching, optionsFor, yearsIn } from '../state/selectors.ts';

type Props = {
  people: readonly RuntimePerson[];
  discovery: Discovery;
  selectedId: string | null;
  onQuery: (query: string) => void;
  onFacet: (dimension: 'communities' | 'contributions', value: string) => void;
  onYear: (year: number) => void;
  onClear: () => void;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

export function People({ people, discovery, selectedId, onQuery, onFacet, onYear, onClear, onSelect, onOpen }: Props) {
  const matches = useMemo(() => matching(people, discovery), [people, discovery]);
  const communities = useMemo(() => optionsFor(people, 'communities'), [people]);
  const contributions = useMemo(() => optionsFor(people, 'contributions'), [people]);
  const years = useMemo(() => yearsIn(people), [people]);
  const filtering = matches.length !== people.length;

  return (
    <>
      <div className="tools">
        <label>
          Find
          <input
            type="search"
            value={discovery.query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Name or year"
            aria-label="Find a person by name or year"
          />
        </label>

        <label>
          Contribution
          <select
            aria-label="Filter by contribution"
            value={discovery.contributions[0] ?? ''}
            onChange={(event) => {
              discovery.contributions.forEach((value) => onFacet('contributions', value));
              if (event.target.value) onFacet('contributions', event.target.value);
            }}
          >
            <option value="">All contributions</option>
            {contributions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        <label>
          Community
          <select
            aria-label="Filter by community"
            value={discovery.communities[0] ?? ''}
            onChange={(event) => {
              discovery.communities.forEach((value) => onFacet('communities', value));
              if (event.target.value) onFacet('communities', event.target.value);
            }}
          >
            <option value="">All communities</option>
            {communities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        <label>
          Class
          <select
            aria-label="Filter by induction year"
            value={discovery.years[0] ?? ''}
            onChange={(event) => {
              discovery.years.forEach((year) => onYear(year));
              if (event.target.value) onYear(Number(event.target.value));
            }}
          >
            <option value="">All classes</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>

        <p className="count" role="status">{matches.length} of {people.length} shown</p>
        {filtering && <button type="button" onClick={onClear}>Show everyone</button>}
      </div>

      {matches.length === 0
        ? <p className="empty">Nobody matches those choices. Clear them to see the whole collection.</p>
        : (
          <ul className="grid">
            {matches.map((person) => (
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
                  <span className="year">{person.classYear ?? 'Year not recorded'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
