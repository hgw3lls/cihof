import { useMemo } from 'react';
import type { RuntimePerson } from '../data/runtime.ts';
import type { Discovery } from '../state/exhibit.ts';
import { matching, optionsFor, yearsIn } from '../state/selectors.ts';
import { Portrait } from './Portrait.tsx';

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
  const selected = selectedId ? people.find((person) => person.id === selectedId) ?? null : null;

  return (
    <div className="people">
      <aside className="focus" aria-label="Selected person">
        {selected
          ? (
            <>
              <Portrait person={selected} className="focus__portrait" />
              <p className="focus__year">{selected.classYear ? `Class of ${selected.classYear}` : 'Induction year not recorded'}</p>
              <h2 className="focus__name">{selected.name}</h2>
              <button className="block block--lens focus__open" type="button" onClick={() => onOpen(selected.id)}>
                Read the record
              </button>
            </>
          )
          : <p className="prompt">Choose a portrait to begin. Every person here was recognised for a contribution to Greater Cleveland’s international communities.</p>}
      </aside>

      <div className="people__stage">
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
                    <Portrait person={person} lazy />
                    <span className="caption">{person.name}</span>
                    <span className="year">{person.classYear ?? 'Year not recorded'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>

      <div className="tools">
        <label className="field field--find">
          <span className="visually-hidden">Find</span>
          <input
            type="search"
            value={discovery.query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Find a name or year"
            aria-label="Find a person by name or year"
          />
        </label>

        <Choice
          label="Contribution"
          aria="Filter by contribution"
          value={discovery.contributions[0] ?? ''}
          allLabel="All contributions"
          options={contributions.map((value) => [value, value])}
          onChange={(value) => {
            discovery.contributions.forEach((current) => onFacet('contributions', current));
            if (value) onFacet('contributions', value);
          }}
        />

        <Choice
          label="Community"
          aria="Filter by community"
          value={discovery.communities[0] ?? ''}
          allLabel="All communities"
          options={communities.map((value) => [value, value])}
          onChange={(value) => {
            discovery.communities.forEach((current) => onFacet('communities', current));
            if (value) onFacet('communities', value);
          }}
        />

        <Choice
          label="Class"
          aria="Filter by induction year"
          value={discovery.years[0] === undefined ? '' : String(discovery.years[0])}
          allLabel="All classes"
          options={years.map((year) => [String(year), String(year)])}
          onChange={(value) => {
            discovery.years.forEach((year) => onYear(year));
            if (value) onYear(Number(value));
          }}
        />

        <p className="count" role="status">{matches.length} of {people.length} shown</p>
        {filtering && <button type="button" className="tools__clear" onClick={onClear}>Show everyone</button>}
      </div>
    </div>
  );
}

/**
 * A native select, dressed as a field: the label on the left, the current
 * choice on the right. The select itself stays a select, so the device's own
 * picker and a screen reader both work as they always did.
 */
function Choice({ label, aria, value, allLabel, options, onChange }: {
  label: string;
  aria: string;
  value: string;
  allLabel: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  const current = options.find(([option]) => option === value)?.[1];
  return (
    <label className="field field--choice">
      <span className="field__label">{label}</span>
      <span className="field__value" aria-hidden="true">{current ?? 'All'}</span>
      <select aria-label={aria} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
      </select>
    </label>
  );
}
