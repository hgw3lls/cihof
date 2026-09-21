import type { RuntimePerson } from '../data/runtime.ts';
import { Modal } from './Modal.tsx';

/**
 * The full record, layered over whatever is on the stage.
 *
 * Focus trapping, inertness, Escape and focus return are the Modal's, so this
 * component is only about what a record says.
 */
export function Record({ person, onClose, onShare, onPlay }: {
  person: RuntimePerson;
  onClose: () => void;
  onShare?: () => void;
  onPlay?: (filmId: string) => void;
}) {
  const paragraphs = person.biography.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <Modal className="record" labelledBy="recordTitle" onClose={onClose}>
      <header>
        <button type="button" onClick={onClose}>Close</button>
        <span>Inductee record</span>
        {onShare && <button type="button" style={{ marginLeft: 'auto' }} onClick={onShare}>Take it with you</button>}
      </header>
      <div className="reading">
        <div className="inner">
          <h2 id="recordTitle" data-autofocus tabIndex={-1}>{person.name}</h2>
          <p className="meta">{person.classYear ? `Inducted ${person.classYear}` : 'Induction year not recorded'}</p>

          {onPlay && person.films.length > 0 && (
            <p>
              {person.films.map((film, index) => (
                <button key={film.id} type="button" className="record__film" onClick={() => onPlay(film.id)}>
                  Watch {person.films.length > 1 ? `film ${index + 1}` : 'the film'}
                </button>
              ))}
            </p>
          )}

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
      </div>
    </Modal>
  );
}
