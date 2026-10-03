import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  approveInStudio, refreshStudioPreview, saveInStudio, saveProfileInStudio, studioState, undoInStudio,
  type FilmChange, type PortraitChoice, type ProfileEdit, type Review, type StudioOutcome, type StudioState,
} from './api.ts';
import { Tags } from './ProfileEditor.tsx';
import { FilmAdder, PortraitChooser, portraitProblem } from './Media.tsx';
import { InducteeForm, blankInductee } from './NewInductees.tsx';

type Props = {
  review: Review;
  reload: () => Promise<void>;
  onAllItems: () => void;
  onPublish: () => void;
  onMedia: () => void;
};

/** The marker the exhibit's editor puts on every message (apps/exhibit/src/app/editor.ts). */
const bridge = 'cihof-editor-bridge';
type Picked = { kind: string; id: string };

/**
 * The studio: the exhibit itself, as the display will show it, edited in place.
 *
 * In Preview it is used as a visitor would. In Edit, everything that can be
 * changed is outlined; touching it opens it here, beside the exhibit. Saving
 * a change writes it into this copy straight away and shows it on the exhibit;
 * Undo takes it back. Every change waits for somebody to approve it, the same
 * person or another, and Publish makes a display update only once none is
 * waiting.
 */
export function Studio({ review, reload, onAllItems, onPublish, onMedia }: Props) {
  const [studio, setStudio] = useState<StudioState | null>(null);
  const [editing, setEditing] = useState(true);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  const tell = useCallback((message: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: bridge, ...message }, window.location.origin);
  }, []);

  // The preview's content, published from this copy the first time it is needed.
  useEffect(() => {
    void (async () => {
      let state = await studioState();
      if (!state.preview && state.shell) {
        setBusy('Preparing the preview…');
        await refreshStudioPreview();
        state = await studioState();
        setBusy(null);
      }
      setStudio(state);
    })();
  }, []);

  // The exhibit is drawn at the display's size, 1920 by 1080, and scaled to fit.
  useLayoutEffect(() => {
    const element = holder.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setScale(element.clientWidth / 1920));
    observer.observe(element);
    return () => observer.disconnect();
  }, [studio]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data as { source?: string; type?: string; kind?: string; id?: string };
      if (message?.source !== bridge) return;
      if (message.type === 'ready') tell({ type: 'mode', edit: editing });
      if (message.type === 'pick' && message.kind) { setPicked({ kind: message.kind, id: message.id ?? '' }); setShowWaiting(false); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [editing, tell]);
  useEffect(() => { tell({ type: 'mode', edit: editing }); }, [editing, tell]);

  /** After a change: the copy's words again here, and the exhibit's content again, on the same screen. */
  const refreshed = async (state: StudioState | null, personId?: string) => {
    await reload();
    if (state) setStudio(state);
    else setStudio(await studioState());
    tell({ type: 'reload' });
    if (personId) window.setTimeout(() => tell({ type: 'open-person', id: personId }), 300);
  };

  const undo = async () => {
    setBusy('Undoing…'); setProblem(null);
    try {
      const outcome = await undoInStudio();
      if (!outcome.ok) setProblem(outcome.problem ?? 'It could not be undone.');
      await refreshed(null, picked?.id);
    } finally { setBusy(null); }
  };

  if (!studio) return <main className="page"><p className="quiet">{busy ?? 'Loading the studio…'}</p></main>;
  if (!studio.shell) {
    return (
      <main className="page page--narrow">
        <h1>The exhibit is not in this copy of the portal</h1>
        <p>This copy of the app was built without the exhibit to edit in place. Use <strong>All items</strong> meanwhile, and ask for a new copy of the app.</p>
        <button type="button" className="primary" onClick={onAllItems}>All items</button>
      </main>
    );
  }

  const waiting = studio.changes.filter((change) => change.status === 'waiting');
  const undoable = studio.changes.at(-1) && studio.changes.at(-1)!.status !== 'published';

  return (
    <main className="studio">
      <div className="studio__bar">
        <div className="studio__mode" role="group" aria-label="Mode">
          <button type="button" aria-pressed={!editing} onClick={() => setEditing(false)}>Preview</button>
          <button type="button" aria-pressed={editing} onClick={() => setEditing(true)}>Edit</button>
        </div>
        <button type="button" disabled={!undoable || Boolean(busy)} onClick={() => void undo()}>Undo</button>
        <button type="button" className={waiting.length ? 'studio__waiting' : ''} onClick={() => { setShowWaiting(true); setPicked(null); }}>
          {waiting.length ? `${waiting.length} waiting for approval` : 'Nothing waiting'}
        </button>
        <button type="button" onClick={() => { setPicked({ kind: 'new-inductee', id: '' }); setShowWaiting(false); }}>+ Add an inductee</button>
        <span className="studio__spacer" />
        <button type="button" onClick={onAllItems}>All items</button>
        <button type="button" className="primary" disabled={waiting.length > 0} title={waiting.length ? 'Approve or undo every change first' : ''} onClick={onPublish}>Publish to the display</button>
      </div>
      {busy && <p className="quiet studio__status" role="status">{busy}</p>}
      {problem && <p className="problem studio__status" role="alert">{problem}</p>}

      <div className="studio__body">
        <div ref={holder} className="studio__stage" style={{ height: 1080 * scale }}>
          <iframe ref={frame} title="The exhibit, as the display will show it" src="/exhibit/"
            style={{ width: 1920, height: 1080, transform: `scale(${scale})` }} />
        </div>
        <aside className="studio__inspector" aria-label="Edit">
          {showWaiting
            ? <Waiting studio={studio} onApproved={async (state) => { await refreshed(state); }} />
            : picked?.kind === 'new-inductee'
              ? (
                <InducteeForm review={review} initial={blankInductee()} onCancel={() => setPicked(null)}
                  onKeep={async (person) => {
                    setBusy('Adding them…'); setProblem(null);
                    try {
                      const outcome = await saveInStudio({ kind: 'new-inductee', key: `new-${Date.now()}`, person });
                      if (!outcome.ok) { setProblem(failure(outcome)); return; }
                      const id = outcome.change?.subject.id ?? '';
                      setPicked({ kind: 'profile', id });
                      await refreshed(null, id);
                    } finally { setBusy(null); }
                  }} />
              )
              : picked?.kind === 'films'
                ? <FilmsInspector key={picked.id} review={review} personId={picked.id} onSaved={async () => { await refreshed(null, picked.id); }} />
                : picked
              ? <PersonInspector key={`${picked.id}:${review.profiles.find((each) => each.id === picked.id)?.contentVersion ?? ''}`} review={review} personId={picked.id} kind={picked.kind}
                onSaved={async (state) => { await refreshed(state, picked.id); }} />
              : (
                <div className="studio__hint">
                  <h2>{editing ? 'Touch anything outlined' : 'Using it as a visitor'}</h2>
                  <p className="quiet">
                    {editing
                      ? 'Open a person on the exhibit, then touch their name, lines, biography or portrait to change it here.'
                      : 'Switch to Edit to change what you see.'}
                  </p>
                  <p className="quiet small">Each change is saved into this copy as you save it, and shown on the exhibit here. Nothing reaches the display until every change is approved and you publish.</p>
                </div>
              )}
        </aside>
      </div>
    </main>
  );
}

function Waiting({ studio, onApproved }: { studio: StudioState; onApproved: (state: StudioState | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const waiting = studio.changes.filter((change) => change.status === 'waiting');
  const approve = async (id: string) => {
    setBusy(true); setProblem(null);
    try {
      const outcome = await approveInStudio(id);
      if (!outcome.ok) setProblem(outcome.problem ?? outcome.results?.find((result) => !result.ok)?.output ?? 'It was not approved.');
      await onApproved(null);
    } finally { setBusy(false); }
  };
  return (
    <div>
      <h2>Waiting for approval</h2>
      {waiting.length === 0 && <p className="quiet">Nothing is waiting. Every change saved here has been approved.</p>}
      <ul className="studio__changes">
        {waiting.map((change) => (
          <li key={change.id}>
            <strong>{change.title}</strong>
            <span className="quiet small">Saved by {change.by}, {new Date(change.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <button type="button" disabled={busy} onClick={() => void approve(change.id)}>Approve</button>
          </li>
        ))}
      </ul>
      {problem && <pre className="output">{problem}</pre>}
      <p className="quiet small">Approving says you have looked at the change on the exhibit and stand behind it. A profile is approved as it now reads.</p>
    </div>
  );
}

function PersonInspector({ review, personId, kind, onSaved }: {
  review: Review; personId: string; kind: string; onSaved: (state: StudioState | null) => Promise<void>; onMedia?: () => void;
}) {
  const profile = review.profiles.find((each) => each.id === personId);
  const bio = review.bios.find((each) => each.id === personId);
  const [edit, setEdit] = useState<ProfileEdit | null>(profile?.edit ?? null);
  const [biography, setBiography] = useState(bio?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!profile || !edit) return <p className="quiet">That is not somebody this copy can edit.</p>;
  const change = (next: Partial<ProfileEdit>) => setEdit((current) => (current ? { ...current, ...next } : current));
  const limit = review.limits.profile;
  const editChanged = JSON.stringify(edit) !== JSON.stringify(profile.edit);
  const bioChanged = biography.trim() !== (bio?.text ?? '').trim();

  const save = async () => {
    setBusy(true); setProblem(null);
    try {
      const outcome = await saveProfileInStudio({ id: personId, seenVersion: profile.contentVersion, name: edit.name, edit: editChanged ? edit : null, biography: bioChanged ? biography.trim() : null });
      if (!outcome.ok) { setProblem(outcome.results?.filter((result) => !result.ok).map((result) => result.output).join('\n\n') || 'It was not saved.'); return; }
      await onSaved(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="studio__form">
      <h2>{profile.name}</h2>
      <p className="quiet small">Class of {profile.classYear} · {profile.state === 'approved' ? 'approved' : 'not yet approved'}</p>
      {kind === 'portrait' && <PortraitSection review={review} personId={personId} onSaved={() => onSaved(null)} />}
      <label className="field"><span>Name</span><input value={edit.name} maxLength={limit.name} onChange={(event) => change({ name: event.target.value })} /></label>
      <label className="field"><span>Alphabetised as</span><input value={edit.sortName} maxLength={limit.name} onChange={(event) => change({ sortName: event.target.value })} /></label>
      <Tags title="Communities (above the name, with the class)" field="studio-communities" tags={edit.communities} known={review.profileTags.communities} limit={limit.tags} onChange={(communities) => change({ communities })} />
      <Tags title="Honours (the “Honored for” line under the name)" field="studio-contributions" tags={edit.contributions} known={review.profileTags.contributions} limit={limit.tags} onChange={(contributions) => change({ contributions })} />
 <Tags title="Countries (for search and grouping)" field="studio-countries" tags={edit.countries} known={review.profileTags.countries} limit={limit.tags} onChange={(countries) => change({ countries })} />
      <label className="field"><span>The portrait, described for people who cannot see it</span>
        <textarea rows={2} value={edit.portraitAlt} maxLength={limit.portraitAlt} onChange={(event) => change({ portraitAlt: event.target.value })} /></label>
      <label className="field"><span>Biography</span>
        <textarea rows={10} value={biography} onChange={(event) => setBiography(event.target.value)} /></label>
      {problem && <pre className="output" role="alert">{problem}</pre>}
      <p className="actions">
        <button type="button" disabled={busy || (!editChanged && !bioChanged)} onClick={() => { setEdit(profile.edit ?? null); setBiography(bio?.text ?? ''); }}>Discard</button>
        <button type="button" className="primary" disabled={busy || (!editChanged && !bioChanged)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
      </p>
      <p className="quiet small">Saved changes show on the exhibit at once, and wait for approval before they can be published. The lines the exhibit does not show (what they are honoured for, the context line) are in All items, Profiles.</p>
    </div>
  );
}

/** What a refused save says, for the editor to read. */
function failure(outcome: StudioOutcome): string {
  return outcome.problem ?? outcome.results?.filter((result) => !result.ok).map((result) => result.output).join('\n\n') ?? 'It was not saved.';
}

/** A new picture for this person, chosen, described and confirmed, saved straight into this copy. */
function PortraitSection({ review, personId, onSaved }: { review: Review; personId: string; onSaved: () => Promise<void> }) {
  const person = review.media.find((each) => each.id === personId);
  const [choice, setChoice] = useState<PortraitChoice | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!person) return null;
  const limit = review.limits.profile.portraitAlt;
  const save = async () => {
    if (!choice) return;
    setBusy(true); setProblem(null);
    try {
      const outcome = await saveInStudio({ kind: 'portrait', id: personId, name: person.name, choice });
      if (!outcome.ok) { setProblem(failure(outcome)); return; }
      setChoice(undefined);
      await onSaved();
    } finally { setBusy(false); }
  };
  return (
    <section className="studio__section">
      <h3>A new portrait</h3>
      <PortraitChooser person={person} choice={choice} set={setChoice} limit={limit} />
      {choice && (
        <p className="actions">
          <button type="button" className="primary" disabled={busy || Boolean(portraitProblem(choice, limit))} onClick={() => void save()}>{busy ? 'Saving…' : 'Save the new portrait'}</button>
        </p>
      )}
      {problem && <pre className="output" role="alert">{problem}</pre>}
    </section>
  );
}

/** A person's films: each one on the display can be taken off, and a new one added, each saved straight into this copy. */
function FilmsInspector({ review, personId, onSaved }: { review: Review; personId: string; onSaved: () => Promise<void> }) {
  const person = review.media.find((each) => each.id === personId);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!person) return <p className="quiet">That is not somebody this copy can edit.</p>;
  const save = async (key: string, film: FilmChange) => {
    setBusy(true); setProblem(null);
    try {
      const outcome = await saveInStudio({ kind: 'film', key, film, name: person.name });
      if (!outcome.ok) { setProblem(failure(outcome)); return; }
      await onSaved();
    } finally { setBusy(false); }
  };
  return (
    <div className="studio__form">
      <h2>{person.name}&rsquo;s films</h2>
      <ul className="media-films">
        {person.films.map((film) => (
          <li key={film.filmId}>
            {film.poster ? <img src={film.poster} alt="" loading="lazy" /> : <span className="media-film__none" />}
            <span>
              <strong>{film.title ?? (film.durationSeconds ? `A ${Math.max(1, Math.round(film.durationSeconds / 60))}-minute film` : 'A film')}</strong>
              <span className="quiet small">{film.shown ? 'On the display' : 'Not on the display'}</span>
            </span>
            {film.shown && (
              <button type="button" disabled={busy} onClick={() => {
                if (window.confirm('Take this film off the display? Its record is kept, and it can be put back from All items.')) {
                  void save(`withdraw:${person.id}:${film.filmId}`, { decision: 'withdraw', personId: person.id, filmId: film.filmId, note: '' });
                }
              }}>Take it off the display</button>
            )}
          </li>
        ))}
        {person.films.length === 0 && <li className="quiet small">No films yet.</li>}
      </ul>
      {busy && <p className="quiet" role="status">Saving…</p>}
      {problem && <pre className="output" role="alert">{problem}</pre>}
      <FilmAdder person={person} titleLimit={review.limits.filmTitle} onAdd={(key, value) => { void save(key, value); }} />
    </div>
  );
}
