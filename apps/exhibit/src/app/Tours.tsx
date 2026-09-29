import type { RuntimePerson, RuntimeTour } from '../data/runtime.ts';
import { Modal } from './Modal.tsx';
import { focalPoint, portraitUrl } from './Portrait.tsx';
import type { Thread } from './threads.ts';

/**
 * The tours on offer: the curated ones a curator approved, and the threads
 * visitors saved in Connections. Choosing one walks the wall a person at a
 * time.
 */
export function TourChooser({ tours, threads, byId, onStart, onFollow, onEdit, onClose }: {
  tours: readonly RuntimeTour[];
  threads: readonly Thread[];
  byId: ReadonlyMap<string, RuntimePerson>;
  onStart: (tour: RuntimeTour) => void;
  onFollow: (thread: Thread) => void;
  onEdit: (thread: Thread) => void;
  onClose: () => void;
}) {
  const faces = (ids: readonly string[], count: number) => ids.slice(0, count).map((id) => byId.get(id)).filter((person) => person !== undefined);
  return (
    <Modal className="tours" labelledBy="toursTitle" onClose={onClose}>
      <div className="dialog-stage tours__frame">
        <p className="tours__kicker">A guided tour</p>
        <h2 id="toursTitle" data-autofocus tabIndex={-1}>Curated tours, and threads that were followed.</h2>

        {tours.length > 0
          ? (
            <ul className="tours__grid">
              {tours.map((tour) => (
                <li key={tour.id}>
                  <button type="button" className="tours__card" onClick={() => onStart(tour)}>
                    <span className="tours__faces" aria-hidden="true">
                      {faces(tour.personIds, 4).map((person) => (
                        <span key={person.id} style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }} />
                      ))}
                    </span>
                    <span className="tours__prompt">{tour.prompt}</span>
                    <span className="tours__label">
                      {tour.label}
                      {tour.unreviewed && <em className="unreviewed">Unreviewed</em>}
                    </span>
                    <span className="tours__description">{tour.description}</span>
                    <span className="tours__count">{tour.personIds.length} people</span>
                  </button>
                </li>
              ))}
            </ul>
          )
          : <p className="tours__none">No curated tour is ready yet. The curators are choosing who each one visits.</p>}

        <section className="tours__threads" aria-labelledby="threadsTitle">
          <p id="threadsTitle" className="tours__kicker">Threads followed</p>
          {threads.length === 0
            ? <p className="tours__none">None yet. In Connections, walk from person to person, then save the thread.</p>
            : (
              <ul>
                {threads.map((thread) => (
                  <li key={thread.id} className="tours__thread">
                    <span className="tours__path" aria-hidden="true">
                      {faces(thread.personIds, 8).map((person, index) => (
                        <span key={`${person.id}:${index}`}>
                          {index > 0 && <span className="tours__join" />}
                          <span className="tours__face" style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }} />
                        </span>
                      ))}
                    </span>
                    <span className="tours__thread-name">{thread.name}</span>
                    <span className="tours__count">{thread.personIds.length} people</span>
                    <span className="tours__thread-actions">
                      <button type="button" className="tours__follow" onClick={() => onFollow(thread)}>Follow it</button>
                      <button type="button" className="tours__edit" aria-label={`Edit ${thread.name}`} onClick={() => onEdit(thread)}>Edit</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <div className="tours__foot">
          <button type="button" className="tours__back" onClick={onClose}>Back to the wall</button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * A saved thread, step by step, with what joins each person to the one before
 * as the records word it. Steps can be moved or taken out, or the thread
 * deleted; its name follows its first and last person.
 */
export function ThreadEditor({ thread, byId, link, onMove, onRemove, onDelete, onFollow, onClose }: {
  thread: Thread;
  byId: ReadonlyMap<string, RuntimePerson>;
  /** What joins one person to the next, and in which layer's colour. */
  link: (from: string, to: string) => { text: string; color: string };
  onMove: (index: number, by: -1 | 1) => void;
  onRemove: (index: number) => void;
  onDelete: () => void;
  onFollow: () => void;
  onClose: () => void;
}) {
  const last = thread.personIds.length - 1;
  return (
    <Modal className="tours" labelledBy="threadTitle" onClose={onClose}>
      <div className="dialog-stage tours__frame tours__frame--centred">
        <div className="editor">
          <p className="tours__kicker">Edit thread · {thread.personIds.length} people</p>
          <h2 id="threadTitle" className="editor__name" data-autofocus tabIndex={-1}>{thread.name}</h2>
          <ol className="editor__steps">
            {thread.personIds.map((id, index) => {
              const person = byId.get(id);
              const joined = index === 0 ? { text: 'where it starts', color: 'var(--muted)' } : link(thread.personIds[index - 1]!, id);
              return (
                <li key={`${id}:${index}`}>
                  <span className="editor__n">{index + 1}</span>
                  {person && <span className="editor__face" aria-hidden="true" style={{ backgroundImage: portraitUrl(person), backgroundPosition: focalPoint(person) }} />}
                  <span className="editor__text">
                    <strong>{person?.name ?? id}</strong>
                    <span style={{ color: joined.color }}>{joined.text}</span>
                  </span>
                  <button type="button" aria-label={`Move ${person?.name ?? ''} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${person?.name ?? ''} down`} disabled={index === last} onClick={() => onMove(index, 1)}>↓</button>
                  <button type="button" className="editor__remove" aria-label={`Remove ${person?.name ?? ''}`} disabled={thread.personIds.length <= 2} onClick={() => onRemove(index)}>Remove</button>
                </li>
              );
            })}
          </ol>
          <div className="editor__foot">
            <button type="button" className="editor__delete" onClick={onDelete}>Delete thread</button>
            <span />
            <button type="button" className="editor__follow" onClick={onFollow}>Follow it</button>
            <button type="button" className="editor__done" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
