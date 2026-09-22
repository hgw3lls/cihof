import { useMemo } from 'react';
import type { PublishedRelationship } from '@cihof/content';
import type { RuntimePerson } from '../data/runtime.ts';
import { connectionNodes } from '../state/selectors.ts';

type Props = {
  people: readonly RuntimePerson[];
  relationships: readonly PublishedRelationship[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
  onOpen: (personId: string) => void;
};

/**
 * The collection as documented relationships between people.
 *
 * Only relationships a curator approved with evidence reach this component —
 * the bundle carries no others, because `publishedRelationships` filters them
 * out upstream and the lens is absent below its threshold. So there is nothing
 * to weaken here: every line drawn is a claim somebody signed.
 *
 * Two things this deliberately does not do.
 *
 * It does not draw shared context. Twelve dashed lines per person meaning
 * "inducted the same year" is what the previous Links scene showed, and beside
 * a documented relationship they were indistinguishable in shape. A visitor
 * cannot be expected to hold a distinction the display collapses.
 *
 * It does not take `discovery`. A search term narrowing a relationship graph
 * removes the people a visitor is looking at the graph to find, which is how a
 * query once emptied the constellation it was meant to help navigate. Selection
 * moves the focus; it never removes anyone.
 */
export function Links({ people, relationships, selectedId, onSelect, onOpen }: Props) {
  const nodes = useMemo(() => connectionNodes(people, relationships), [people, relationships]);

  if (nodes.length === 0) {
    return <p className="empty">No documented relationship is published in this release.</p>;
  }

  // The selected person leads, so choosing a portrait elsewhere in the exhibit
  // and coming here answers "who did they work with" without a search.
  const ordered = selectedId
    ? [...nodes].sort((a, b) => Number(b.person.id === selectedId) - Number(a.person.id === selectedId))
    : nodes;

  return (
    <div className="links">
      <p className="links__note">
        {relationships.length} documented {relationships.length === 1 ? 'relationship' : 'relationships'} between
        {' '}{nodes.length} people. Each one rests on a source a curator reviewed.
      </p>

      {ordered.map(({ person, ties }) => (
        <section
          key={person.id}
          className="links__person"
          aria-labelledby={`links-${person.id}`}
          aria-current={person.id === selectedId ? 'true' : undefined}
        >
          <h2 id={`links-${person.id}`}>
            <button
              type="button"
              className="links__subject"
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
            <span>{ties.length} {ties.length === 1 ? 'connection' : 'connections'}</span>
          </h2>

          <ul className="links__ties">
            {ties.map((tie) => (
              <li key={tie.connectionId}>
                <button
                  type="button"
                  className="links__tie"
                  onClick={() => onSelect(tie.other.id)}
                  onDoubleClick={() => onOpen(tie.other.id)}
                >
                  {tie.other.portrait
                    ? <img src={asset(tie.other.portrait.src)} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                    : <img src={asset('media/placeholder.svg')} alt="" aria-hidden="true" />}
                  {/* The approved wording, which already names the other person.
                      Restating the name beside it would say it twice and invite
                      an edit here that disagrees with what was signed. */}
                  <span className="links__label">{tie.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
