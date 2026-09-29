import type { PublishedRelationship, SharedContext } from '@cihof/content';
import type { RuntimePerson, RuntimePlace } from '../data/runtime.ts';
import { kicker, teaser } from '../state/selectors.ts';
import { portraitUrl, focalPoint } from './Portrait.tsx';
import { Rich } from './Rich.tsx';

/**
 * The panel that slides in from the right when somebody is chosen on the wall:
 * who they are, the start of their story, and the ways on from here. With two
 * people chosen at once it sets them side by side, and says what the records
 * say they share.
 */
/** One line of a person's ties in Connections: somebody, a place, or who presented them. */
export type TieLine = {
  readonly key: string;
  readonly name: string;
  /** The reviewed wording, or what the line is. */
  readonly label: string;
  /** A CSS colour: the layer's. */
  readonly color: string;
  readonly person?: RuntimePerson;
  readonly place?: boolean;
  /** Absent when there is nowhere to go: a presenter who is not in the hall. */
  readonly onClick?: () => void;
};

export function PersonSheet({ person, ties, tieLines, onClose, onStory, onFilm, onConnections }: {
  person: RuntimePerson;
  /** How many documented ties they have, for the way into Connections. */
  ties: number;
  /** In Connections: their ties listed, each a step on to somebody else. */
  tieLines?: readonly TieLine[];
  onClose: () => void;
  onStory: () => void;
  onFilm: () => void;
  /** Present only when this release offers Connections. */
  onConnections?: () => void;
}) {
  const films = person.films.length;
  return (
    <>
      <div className="sheet__top">
        {/* No film is offered where none can play: the public site carries none. */}
        {films > 0
          ? (
            <button type="button" className="sheet__film" onClick={onFilm}>
              <span className="play-square" aria-hidden="true"><span className="play" /></span>
              {films > 1 ? `Watch ${films} films` : 'Watch the film'}
            </button>
          )
          : <span />}
        <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="sheet__body">
        <p className="sheet__kicker">{kicker(person)}</p>
        <h2 className="sheet__name">{person.name}</h2>
        {person.contributions.length > 0 && <p className="sheet__honored">Honored for {person.contributions.join(' · ')}</p>}
        <p className="sheet__teaser" data-short={tieLines ? 'true' : undefined}><Rich spans={teaser(person.biography)} /></p>
        {tieLines && tieLines.length > 0 && (
          <ul className="sheet__ties-list" aria-label="Ties">
            {tieLines.map((line) => {
              const body = (
                <>
                  {line.person
                    ? <span className="sheet__tie-face" aria-hidden="true" style={{ backgroundImage: portraitUrl(line.person), backgroundPosition: focalPoint(line.person) }} />
                    : <span className="sheet__tie-face" data-kind={line.place ? 'place' : 'other'} aria-hidden="true" />}
                  <span className="sheet__tie-text">
                    <span style={{ color: line.color }}>{line.label}</span>
                    <strong>{line.name}</strong>
                  </span>
                </>
              );
              return (
                <li key={line.key}>
                  {line.onClick ? <button type="button" onClick={line.onClick}>{body}</button> : <div>{body}</div>}
                </li>
              );
            })}
          </ul>
        )}
        <div className="sheet__actions">
          <button type="button" className="sheet__story" onClick={onStory}>
            Read their story<span aria-hidden="true">→</span>
          </button>
          {onConnections && ties > 0 && !tieLines && (
            <button type="button" className="sheet__ties" onClick={onConnections}>
              {ties} {ties === 1 ? 'connection' : 'connections'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function PairSheet({ a, b, relationships, contexts, onOpen, onClose }: {
  a: RuntimePerson;
  b: RuntimePerson;
  relationships: readonly PublishedRelationship[];
  contexts: readonly SharedContext[];
  onOpen: (personId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="pair">
      <p className="sheet__label">Two at once</p>
      <div className="pair__faces">
        {[a, b].map((person) => (
          <div key={person.id}>
            <div className="pair__portrait" role="img" aria-label={person.name} style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }} />
            <p className="pair__name">{person.name}</p>
            <p className="pair__meta">
              {person.classYear ? `Class of ${person.classYear}` : 'Year not recorded'}
              {person.communities[0] ? ` · ${person.communities[0]}` : ''}
            </p>
          </div>
        ))}
      </div>
      <p className="sheet__label pair__shares">What they share</p>
      <p className="pair__share">{shared(a, b, relationships, contexts)}</p>
      <div className="pair__open">
        {[a, b].map((person) => (
          <button key={person.id} type="button" onClick={() => onOpen(person.id)}>Open {person.name.split(' ')[0]}</button>
        ))}
      </div>
      <button type="button" className="pair__close" onClick={onClose}>Close</button>
    </div>
  );
}

/**
 * What the records say two people share, strongest first: a documented
 * relationship in its reviewed words, then context a reviewer kept, then the
 * collection's own facts (class, community, contribution). Nothing is
 * composed that the records do not say.
 */
export function shared(
  a: RuntimePerson,
  b: RuntimePerson,
  relationships: readonly PublishedRelationship[],
  contexts: readonly SharedContext[],
): string {
  const relationship = relationships.find((each) => (each.from === a.id && each.to === b.id) || (each.from === b.id && each.to === a.id));
  if (relationship) return `${relationship.from === a.id ? a.name : b.name} ${relationship.label}.`;
  const context = contexts.find((each) => each.between.includes(a.id as never) && each.between.includes(b.id as never));
  if (context) return `They appear together in the records: ${context.statement}.`;
  const community = a.communities.find((each) => b.communities.includes(each));
  const contribution = a.contributions.find((each) => b.contributions.includes(each));
  const alsoHonored = contribution ? `, and both are honored for ${contribution.toLowerCase()}` : '';
  if (a.classYear && a.classYear === b.classYear) return `Both were inducted in ${a.classYear}${alsoHonored}.`;
  if (community) return `Both come from Cleveland's ${community} community${alsoHonored}.`;
  if (contribution) return `Both are honored for ${contribution.toLowerCase()}.`;
  return 'Nothing in the records links them yet — which is its own kind of story.';
}

/** A place brought to the centre of Connections: what it is, and the people a curator tied to it. */
export function PlaceSheet({ place, people, onPerson, onClose }: {
  place: RuntimePlace;
  people: readonly RuntimePerson[];
  onPerson: (personId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="sheet__top">
        <span />
        <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div className="sheet__body">
        <p className="sheet__kicker sheet__kicker--place">Place{place.neighborhood && place.neighborhood !== place.name ? ` · ${place.neighborhood}` : ''}</p>
        <h2 className="sheet__name">
          {place.name}
          {place.unreviewed && <em className="unreviewed">Unreviewed</em>}
        </h2>
        {place.shortHistory && <p className="sheet__teaser" data-short="true">{place.shortHistory}</p>}
        <ul className="sheet__ties-list" aria-label="People tied to this place">
          {people.map((person) => (
            <li key={person.id}>
              <button type="button" onClick={() => onPerson(person.id)}>
                <span className="sheet__tie-face" aria-hidden="true" style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }} />
                <span className="sheet__tie-text">
                  <span style={{ color: 'var(--places-ink)' }}>{person.classYear ? `Class of ${person.classYear}` : 'Year not recorded'}</span>
                  <strong>{person.name}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
