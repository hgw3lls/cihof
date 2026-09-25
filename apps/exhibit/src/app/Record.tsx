import type { RuntimePerson } from '../data/runtime.ts';
import { Modal } from './Modal.tsx';
import { Portrait } from './Portrait.tsx';

/**
 * The full record, layered over whatever is on the stage.
 *
 * Laid out like a wall label: the portrait full height on the left, the words
 * on the right, and every action along the base where a hand can reach it.
 * Focus trapping, inertness, Escape and focus return are the Modal's, so this
 * component is only about what a record says.
 */
export function Record({ person, onClose, onShare, onPlay, onConnections }: {
  person: RuntimePerson;
  onClose: () => void;
  onShare?: () => void;
  onPlay?: (filmId: string) => void;
  /** Present only when this release offers Connections. */
  onConnections?: () => void;
}) {
  const paragraphs = person.biography.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const facts = [
    ['Inducted', person.classYear ? String(person.classYear) : 'Not recorded'],
    ...(person.presentedBy ? [['Inducted by', person.presentedBy.recordedName]] : []),
    ...(person.communities.length > 0 ? [['Community', person.communities.join(', ')]] : []),
  ];

  return (
    <Modal className="record" labelledBy="recordTitle" onClose={onClose}>
      <div className="record__portrait">
        <Portrait person={person} />
      </div>

      <div className="record__side">
        <header className="record__header">
          <span>Inductee record</span>
          <span>People</span>
        </header>

        <div className="reading">
          <h2 id="recordTitle" data-autofocus tabIndex={-1}>{person.name}</h2>
          {/* The roster's own record of who presented them. Text, not a link
              into the graph: 63 of the 111 were presented by somebody who is
              not in the hall, and a name a visitor can press and find nothing
              behind is worse than a name they cannot. */}
          <dl className="facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          {person.contributions.length > 0 && (
            <ul className="tags" aria-label="Honored for">
              {person.contributions.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          )}

          <div className="bio">
            {paragraphs.map((part, index) => <p key={index}>{part}</p>)}
          </div>

          <p className="credit">
            {person.biographyCurated
              ? 'Biography reviewed and edited by Hall of Fame curators.'
              : 'Biography as recorded by the Cleveland International Hall of Fame.'}
          </p>
        </div>

        <div className="record__actions">
          <button type="button" className="record__close" onClick={onClose}>Close</button>
          {onPlay && person.films.map((film, index) => (
            <button key={film.id} type="button" className="block block--people record__film" onClick={() => onPlay(film.id)}>
              Watch {person.films.length > 1 ? `film ${index + 1}` : 'the film'}
              <span className="play" aria-hidden="true" />
            </button>
          ))}
          {onConnections && (
            <button type="button" className="record__action" data-lens="links" onClick={onConnections}>
              <span className="swatch" aria-hidden="true" />
              Connections
            </button>
          )}
          {onShare && <button type="button" className="record__action" onClick={onShare}>Take it with you</button>}
        </div>
      </div>
    </Modal>
  );
}
