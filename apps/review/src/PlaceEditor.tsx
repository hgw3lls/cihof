import { useState } from 'react';
import type { Place, PlaceEdit, Review } from './api.ts';
import { Choice } from './Connections.tsx';
import { historyProblem } from './Places.tsx';

type Props = {
  review: Review;
  /** The place as it is, or null for a new one. */
  place: Place | null;
  initial: PlaceEdit | undefined;
  onKeep: (value: PlaceEdit) => void;
  onCancel: () => void;
};

/**
 * A place's name, neighbourhood, kind and history, the people tied to it who
 * were not, and who may see it as edited: or a new place, which needs all of
 * that and somebody tied to it.
 *
 * The edit is approved as edited for the audience chosen, which starts as the
 * place's own, or left for somebody else to approve. Changing the words of an
 * approved place hides it until somebody does.
 */
export function PlaceEditor({ review, place, initial, onKeep, onCancel }: Props) {
  const [edit, setEdit] = useState<PlaceEdit>(initial ?? (place
    ? {
      decision: 'edit', placeId: place.placeId, seenVersion: place.contentVersion, name: place.name, neighborhood: place.neighborhood,
      type: place.type, shortHistory: place.shortHistory, people: [], audience: audienceOf(place), note: '',
    }
    : {
      decision: 'create', placeId: '', seenVersion: '', name: '', neighborhood: '', type: '', shortHistory: '', people: [], audience: 'kiosk', note: '',
    }));
  const [finding, setFinding] = useState('');
  const change = (next: Partial<PlaceEdit>) => setEdit((current) => ({ ...current, ...next }));
  const tied = new Set([...(place?.ties ?? []).map((tie) => tie.person.id), ...edit.people.map((person) => person.personId)]);
  const name = (id: string) => review.tourPeople.find((person) => person.id === id)?.name ?? id;
  const needle = finding.trim().toLowerCase();
  const found = needle.length < 2 ? [] : review.tourPeople.filter((person) => !tied.has(person.id) && person.name.toLowerCase().includes(needle)).slice(0, 8);
  const problem = placeEditProblem(edit, place, review);

  return (
    <main className="page page--narrow">
      <h1>{place ? `Edit ${place.name}` : 'A new place'}</h1>
      <p className="lead">Only what the records say. Visitors see the name, the neighbourhood, the history and the people tied to it.</p>

      <section className="panel">
        <label className="field">
          <span>Name</span>
          <input value={edit.name} maxLength={80} onChange={(event) => change({ name: event.target.value })} />
        </label>
        <label className="field">
          <span>Neighbourhood <span className="quiet small">(optional)</span></span>
          <input value={edit.neighborhood} maxLength={60} onChange={(event) => change({ neighborhood: event.target.value })} />
        </label>
        <label className="field field--inline">
          <span>Kind of place</span>
          <select value={edit.type} onChange={(event) => change({ type: event.target.value })}>
            <option value="">Choose…</option>
            {review.placeTypes.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>The words visitors read <span className="quiet small">({edit.shortHistory.trim().length} of {review.limits.placeHistory} characters, one paragraph)</span></span>
          <textarea rows={4} value={edit.shortHistory} maxLength={review.limits.placeHistory * 2} onChange={(event) => change({ shortHistory: event.target.value })} />
        </label>
      </section>

      <section className="panel">
        <h2 className="question">People tied to it</h2>
        <ul className="media-films">
          {(place?.ties ?? []).map((tie) => (
            <li key={tie.person.id}>
              <span><strong>{tie.person.name}</strong><span className="quiet small">{tie.role ?? 'no role chosen yet'} · change it in the places review</span></span>
            </li>
          ))}
          {edit.people.map((person) => (
            <li key={person.personId}>
              <span>
                <strong>{name(person.personId)}</strong>
                <span className="chips" role="group" aria-label={`What ${name(person.personId)} did here`}>
                  {review.roles.map((role) => (
                    <button key={role.role} type="button" className="chip" aria-pressed={person.role === role.role} title={role.label}
                      onClick={() => change({ people: edit.people.map((each) => (each.personId === person.personId ? { ...each, role: role.role } : each)) })}>
                      {role.role}
                    </button>
                  ))}
                </span>
              </span>
              <button type="button" className="link" onClick={() => change({ people: edit.people.filter((each) => each.personId !== person.personId) })}>Take off</button>
            </li>
          ))}
          {!place?.ties.length && edit.people.length === 0 && <li className="quiet small">Nobody yet.</li>}
        </ul>
        <label className="field">
          <span>Add somebody <span className="quiet small">(only if their record says they were here)</span></span>
          <input value={finding} placeholder="Type a name" onChange={(event) => setFinding(event.target.value)} />
        </label>
        {found.length > 0 && (
          <ul className="chips">
            {found.map((person) => (
              <li key={person.id}>
                <button type="button" className="chip chip--plain" onClick={() => { change({ people: [...edit.people, { personId: person.id, role: '' }] }); setFinding(''); }}>
                  {person.name}{person.classYear ? ` (${person.classYear})` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="question">Who may see it as edited?</h2>
        <div className="choices choices--small">
          <Choice selected={edit.audience === 'kiosk'} onClick={() => change({ audience: 'kiosk' })}
            title="The exhibit" body="Approved as edited, for the touchscreen in the gallery." />
          <Choice selected={edit.audience === 'kiosk-and-web'} onClick={() => change({ audience: 'kiosk-and-web' })}
            title="The exhibit and the public website" body="Only if it has been agreed that it may go online." />
          <Choice selected={edit.audience === 'nobody'} onClick={() => change({ audience: 'nobody' })}
            title="Leave it for somebody else to approve"
            body={place?.reviewed ? 'If the words changed, it is hidden until somebody approves them.' : 'It stays hidden until somebody approves it.'} />
        </div>
        {place?.publication.publicWeb && edit.audience === 'kiosk' && (
          <p className="notice">It is on the public website now. Approving it for the exhibit only takes it off the website.</p>
        )}
      </section>

      <label className="field">
        <span>A note, if you want one <span className="quiet small">(where the change comes from)</span></span>
        <input value={edit.note ?? ''} onChange={(event) => change({ note: event.target.value })} />
      </label>

      {problem && <p className="todo" role="status">Still needed: {problem}</p>}
      <nav className="pager">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={Boolean(problem)} onClick={() => onKeep({ ...edit, name: edit.name.trim(), neighborhood: edit.neighborhood.trim(), shortHistory: edit.shortHistory.trim() })}>Keep</button>
      </nav>
    </main>
  );
}

/** What stops a place edit from being saved, or null. */
export function placeEditProblem(edit: PlaceEdit, place: Place | null, review: Pick<Review, 'placeTypes' | 'limits'>): string | null {
  const history = historyProblem(edit.shortHistory, review.limits.placeHistory);
  const unchanged = place && edit.name.trim() === place.name && edit.neighborhood.trim() === place.neighborhood && edit.type === place.type
    && edit.shortHistory.trim() === place.shortHistory.trim() && edit.people.length === 0 && edit.audience === audienceOf(place)
    && place.words === 'current';
  const missing = [
    !edit.name.trim() ? 'a name' : null,
    !review.placeTypes.includes(edit.type) ? 'the kind of place' : null,
    history ? history.replace(/\.$/, '').toLowerCase() : null,
    edit.people.some((person) => !person.role) ? 'what each person added did there' : null,
    !place && edit.people.length === 0 ? 'somebody tied to it' : null,
    unchanged ? 'a change' : null,
  ].filter(Boolean);
  return missing.length > 0 ? `${missing.join('; ')}.` : null;
}

function audienceOf(place: Place): PlaceEdit['audience'] {
  if (!place.reviewed) return 'nobody';
  return place.publication.publicWeb ? 'kiosk-and-web' : place.publication.kiosk ? 'kiosk' : 'nobody';
}

function typeLabel(type: string) {
  const words = type.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
