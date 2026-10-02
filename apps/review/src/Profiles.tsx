import { useEffect, useMemo, useState } from 'react';
import { previewProfile, type Draft, type Profile, type ProfileEdit, type ProfilePreview, type Review, type Text } from './api.ts';
import { Choice } from './Connections.tsx';
import { Portrait } from './Portrait.tsx';
import { ProfileEditor } from './ProfileEditor.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
  onCorrectBiography: () => void;
  onBiography: (id: string) => void;
};

const needsLook = (profile: Profile) => profile.state !== 'approved';

/**
 * Each profile as a visitor sees it, one at a time: is it right to show?
 *
 * Approving records that the institution stands behind these exact words and
 * this picture. If anything on the profile changes later, it comes back here
 * as changed since approval. It does not hide or show anybody.
 *
 * A profile can also be edited here (ProfileEditor): its name, tags, the two
 * lines under the name, and the picture's description and framing. An edit is
 * kept in the draft until it is saved, and the profile is approved after
 * that, so the approval covers the edited profile.
 */
export function Profiles({ review, draft, update, onDone, onCorrectBiography, onBiography }: Props) {
  const [showAll, setShowAll] = useState(false);
  // One induction class at a time is a good sitting; '' is every class.
  const [classYear, setClassYear] = useState<string>('');
  const [view, setView] = useState<'review' | 'dark' | 'light'>('review');
  const [editing, setEditing] = useState(false);
  // Somebody chosen by name, found once the list includes them.
  const [wanted, setWanted] = useState<string | null>(null);
  const edits = draft.profileEdits ?? {};
  const list = useMemo(
    () => review.profiles.filter((profile) =>
      (showAll || needsLook(profile) || draft.profiles[profile.id] || edits[profile.id])
      && (classYear === '' || String(profile.classYear ?? 'none') === classYear)),
    // Fixed while the reviewer works through it, so a decided profile stays put.
    [review.profiles, showAll, classYear],
  );
  const firstOpen = list.findIndex((profile) => !draft.profiles[profile.id]);
  const [index, setIndex] = useState(Math.max(firstOpen, 0));
  const profile = list[Math.min(index, list.length - 1)];
  const approved = review.profiles.filter((item) => item.state === 'approved').length;
  const nextOpen = list.findIndex((item, position) => position > index && !draft.profiles[item.id]);
  useEffect(() => {
    if (!wanted) return;
    const at = list.findIndex((item) => item.id === wanted);
    if (at >= 0) { setIndex(at); setWanted(null); setEditing(false); }
  }, [wanted, list]);
  const find = (name: string) => {
    const person = review.profiles.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
    if (!person) return;
    setShowAll(true);
    setClassYear('');
    setWanted(person.id);
  };
  const pending = profile ? edits[profile.id] : undefined;
  const pendingPreview = useProfilePreview(profile?.id ?? '', pending?.edit ?? null);
  const chooseClass = (year: string) => {
    setClassYear(year);
    const within = review.profiles.filter((item) =>
      (showAll || needsLook(item) || draft.profiles[item.id]) && (year === '' || String(item.classYear ?? 'none') === year));
    setIndex(Math.max(within.findIndex((item) => !draft.profiles[item.id]), 0));
  };

  // Keys for a reviewer working through many: A approves, → and ← move.
  // Never while typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if (event.ctrlKey || event.metaKey || event.altKey || !profile) return;
      if (event.key === 'ArrowRight' && index < list.length - 1) { event.preventDefault(); setIndex(index + 1); }
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); setIndex(index - 1); }
      if ((event.key === 'a' || event.key === 'A') && !draft.bios[profile.id] && !edits[profile.id] && !editing) {
        event.preventDefault();
        update((current) => ({ ...current, profiles: { ...current.profiles, [profile.id]: { decision: 'approve', seenVersion: profile.contentVersion } } }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profile, index, list.length, draft.bios, edits, editing, update]);

  if (!profile) {
    return (
      <main className="page page--narrow">
        <h1>Profiles</h1>
        <ClassOverview review={review} draft={draft} chosen={classYear} onChoose={chooseClass} />
        <p className="lead">{classYear ? 'Every profile in this class is approved as it stands.' : 'Every profile is approved as it stands.'}</p>
        {/* Approved profiles can still be edited: go to one by name. */}
        <FindPerson profiles={review.profiles} onFind={find} />
        <button type="button" onClick={() => setShowAll(true)}>Look through them anyway</button>{' '}
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </main>
    );
  }

  const value = draft.profiles[profile.id];
  const set = (next: Draft['profiles'][string] | undefined) => update((current) => {
    const profiles = { ...current.profiles };
    if (next) profiles[profile.id] = next; else delete profiles[profile.id];
    return { ...current, profiles };
  });
  const biographyPending = Boolean(draft.bios[profile.id]);
  const setEdit = (next: ProfileEdit | undefined) => update((current) => {
    const profileEdits = { ...(current.profileEdits ?? {}) };
    if (next) profileEdits[profile.id] = { seenVersion: profileEdits[profile.id]?.seenVersion ?? profile.contentVersion, edit: next, note: profileEdits[profile.id]?.note ?? '' };
    else delete profileEdits[profile.id];
    // A decision made before the edit was about the profile before it; it is made again after.
    const profiles = { ...current.profiles };
    if (next) delete profiles[profile.id];
    return { ...current, profileEdits, profiles };
  });
  // Somebody else changed the profile after this edit began: it cannot be laid over theirs.
  const editStale = Boolean(pending && pending.seenVersion !== profile.contentVersion);
  const shown = pending && pendingPreview ? pendingPreview.profile : profile;

  return (
    <main className="page">
      <div className="steps">
        <h1>Profiles</h1>
        <p className="quiet">
          {index + 1} of {list.length} · {approved} of {review.profiles.length} approved ·{' '}
          <label className="inline">
            <input type="checkbox" checked={showAll} onChange={(event) => { setShowAll(event.target.checked); setIndex(0); }} />
            include approved profiles
          </label>
        </p>
      </div>

      <ClassOverview review={review} draft={draft} chosen={classYear} onChoose={chooseClass} />
      <FindPerson profiles={review.profiles} onFind={find} />

      <div className="row views" role="group" aria-label="How to show the profile">
        <button type="button" aria-pressed={view === 'review'} onClick={() => setView('review')}>For review</button>
        <button type="button" aria-pressed={view === 'dark'} onClick={() => setView('dark')}>As on the display (dark)</button>
        <button type="button" aria-pressed={view === 'light'} onClick={() => setView('light')}>As on the display (light)</button>
        <span className="quiet small">Keys: A approves · → next · ← previous</span>
      </div>

      {profile.state === 'changed-since-approval' && (
        <p className="notice">This profile was approved, but something on it has changed since. Look at it again.</p>
      )}
      {profile.state === 'changes-requested' && (
        <p className="notice">Changes were asked for: <em>{profile.reviewNote}</em></p>
      )}

      {editing
        ? (
          <section className="panel">
            <h2 className="question">Editing {profile.name}’s profile</h2>
            <ProfileEditor profile={profile} review={review} initial={pending?.edit ?? profile.edit!}
              onKeep={(next) => { setEdit(next); setEditing(false); }} onCancel={() => setEditing(false)} />
          </section>
        )
        : view === 'review' ? <ProfileCard profile={shown} /> : <DisplayPreview profile={shown} theme={view} />}

      {!editing && (
        <section className="panel">
          {pending
            ? (
              <>
                <p className={editStale ? 'todo' : 'notice'} role="status">
                  {editStale
                    ? 'This profile was changed by somebody else after you began editing it, so your changes cannot be saved over theirs. Discard them and edit it again.'
                    : 'Shown with your changes, not yet saved. Visitors see the profile as it was until they are saved; then approve it, so the approval covers the edited profile.'}
                </p>
                <label className="field">
                  <span>A note about your changes, if you want one <span className="quiet small">(kept with the decision)</span></span>
                  <input value={pending.note ?? ''} onChange={(event) => update((current) => ({
                    ...current, profileEdits: { ...(current.profileEdits ?? {}), [profile.id]: { ...pending, note: event.target.value } },
                  }))} />
                </label>
                <p>
                  <button type="button" onClick={() => setEditing(true)}>Edit my changes</button>{' '}
                  <button type="button" className="link" onClick={() => setEdit(undefined)}>Discard my changes</button>
                </p>
              </>
            )
            : profile.edit && <p><button type="button" onClick={() => setEditing(true)}>Edit this profile</button></p>}
        </section>
      )}

      {!editing && !pending && <section className="panel">
        <h2 className="question">Is this profile right to show visitors?</h2>
        <p className="quiet">Check the name, the class year, the biography, the lines above it and the picture.</p>
        {biographyPending && value?.decision === 'approve' && (
          <p className="notice">
            You approved this profile, then corrected the biography. The approval would not cover the corrected words:
            clear it, save the correction, then approve again.
          </p>
        )}
        {biographyPending && value?.decision !== 'approve'
          ? (
            <p className="notice">
              You have corrected this biography but not saved the correction yet. Save it first, then approve the profile,
              so the approval covers the corrected words.
            </p>
          )
          : (
            <div className="choices choices--small">
              <Choice selected={value?.decision === 'approve'} onClick={() => set({ decision: 'approve', seenVersion: profile.contentVersion })}
                title="Yes, approve it" body="Everything here is right to show." />
              <Choice selected={value?.decision === 'changes'} onClick={() => set({ decision: 'changes', seenVersion: profile.contentVersion, note: value?.note ?? '' })}
                title="Something needs changing" body="Say what, and it is kept with the profile until it is fixed." />
            </div>
          )}
        {value?.decision === 'changes' && (
          <>
            <label className="field">
              <span>What needs changing?</span>
              <input autoFocus value={value.note ?? ''} placeholder="e.g. The class year should be 2014; the portrait is of someone else"
                onChange={(event) => set({ ...value, note: event.target.value })} />
            </label>
            <button type="button" className="link" onClick={() => { onBiography(profile.id); onCorrectBiography(); }}>The biography is wrong: correct it now</button>
          </>
        )}
        {value && <p><button type="button" className="link" onClick={() => set(undefined)}>Clear my answer</button></p>}
        {value && (
          <p className={value.decision === 'changes' && !value.note?.trim() ? 'todo' : 'done'} role="status">
            {value.decision === 'changes' && !value.note?.trim() ? 'Not finished yet: say what needs changing.' : '✓ Decided. Kept on this computer until you save.'}
          </p>
        )}
      </section>}

      <nav className="pager">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</button>
        <button type="button" onClick={onDone}>Stop for now</button>
        {nextOpen > index + 1 && <button type="button" onClick={() => setIndex(nextOpen)}>Next undecided →</button>}
        {index < list.length - 1
          ? <button type="button" className="primary" onClick={() => setIndex(index + 1)}>{value ? 'Next →' : 'Skip for now →'}</button>
          : <button type="button" className="primary" onClick={onDone}>Finish</button>}
      </nav>
    </main>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <article className="panel profile">
      <div className="person person--large">
        {profile.portrait?.shown
          ? <Portrait src={profile.portrait.src} name={profile.name} />
          : <Portrait src={null} name={profile.name} />}
        <div>
          <h2 className="place__name">{profile.name}</h2>
          <p className="quiet">
            {profile.classYear ? `Class of ${profile.classYear}` : 'Class year not recorded'}
            {profile.presentedBy && ` · Presented by ${profile.presentedBy}`}
          </p>
          {profile.portrait && !profile.portrait.shown && (
            <p className="notice">The portrait is not shown to visitors: its rights are {profile.portrait.rights}.</p>
          )}
          {profile.portrait?.shown && <p className="quiet small">Picture description for screen readers: {profile.portrait.alt}</p>}
        </div>
      </div>

      <Line label="Honoured for" text={profile.contribution} />
      <Line label="Context" text={profile.context} />

      {(profile.tags.countries.length + profile.tags.communities.length + profile.tags.contributions.length) > 0 && (
        <p className="tags">
          {[...new Set([...profile.tags.countries, ...profile.tags.communities, ...profile.tags.contributions])].map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </p>
      )}

      <h3>Biography</h3>
      {profile.biography
        ? (
          <>
            <p className="quiet small">{profile.biography.provenance === 'curated' ? "A curator's text." : "The Hall of Fame's own text."}</p>
            <p className="history">{profile.biography.text}</p>
          </>
        )
        : <p className="quiet">No biography.</p>}
      {profile.sourceUrl && <a href={profile.sourceUrl} target="_blank" rel="noreferrer">The Hall of Fame's page for {profile.name}</a>}
    </article>
  );
}

function Line({ label, text }: { label: string; text: Text | null }) {
  if (!text) return null;
  return (
    <p>
      <strong>{label}: </strong>{text.text}
      {text.provenance === 'generated' && (
        <span className="quiet small"> (written by the computer from the tags, not by a person; check it says nothing untrue)</span>
      )}
      {text.provenance === 'curated' && <span className="quiet small"> (a curator’s words)</span>}
    </p>
  );
}

/** Go straight to somebody's profile by name, approved or not. */
function FindPerson({ profiles, onFind }: { profiles: Profile[]; onFind: (name: string) => void }) {
  const [typed, setTyped] = useState('');
  return (
    <form className="row find-person" onSubmit={(event) => { event.preventDefault(); onFind(typed); setTyped(''); }}>
      <label className="field field--inline">
        <span>Find a person</span>
        <input value={typed} list="profile-names" placeholder="Type a name" onChange={(event) => setTyped(event.target.value)} />
      </label>
      <datalist id="profile-names">{profiles.map((profile) => <option key={profile.id} value={profile.name} />)}</datalist>
      <button type="submit" disabled={!profiles.some((profile) => profile.name.toLowerCase() === typed.trim().toLowerCase())}>Go to them</button>
    </form>
  );
}

/** A profile as an edit kept earlier would leave it. */
function useProfilePreview(id: string, edit: ProfileEdit | null): ProfilePreview | null {
  const [preview, setPreview] = useState<ProfilePreview | null>(null);
  const key = edit ? JSON.stringify(edit) : '';
  useEffect(() => {
    if (!edit || !id) { setPreview(null); return; }
    let live = true;
    previewProfile(id, edit).then((answer) => { if (live) setPreview(answer); }).catch(() => { if (live) setPreview(null); });
    return () => { live = false; };
    // Asked again only when the edit itself changes, not each time it is rebuilt.
  }, [id, key]);
  return preview;
}

/**
 * The induction classes, each with how far its review has come. Choosing one
 * works through that class alone.
 */
function ClassOverview({ review, draft, chosen, onChoose }: {
  review: Review;
  draft: Draft;
  chosen: string;
  onChoose: (year: string) => void;
}) {
  const classes = useMemo(() => {
    const groups = new Map<string, Profile[]>();
    for (const profile of review.profiles) {
      const key = String(profile.classYear ?? 'none');
      groups.set(key, [...(groups.get(key) ?? []), profile]);
    }
    return [...groups.entries()].sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : Number(a) - Number(b)));
  }, [review.profiles]);

  return (
    <nav className="classes" aria-label="Induction classes">
      <button type="button" className="class" aria-pressed={chosen === ''} onClick={() => onChoose('')}>
        <strong>All</strong>
        <span className="quiet small">{review.profiles.filter((profile) => profile.state === 'approved').length} of {review.profiles.length}</span>
      </button>
      {classes.map(([year, profiles]) => {
        const approved = profiles.filter((profile) => profile.state === 'approved').length;
        const decided = profiles.filter((profile) => draft.profiles[profile.id]).length;
        return (
          <button key={year} type="button" className={approved === profiles.length ? 'class class--done' : 'class'}
            aria-pressed={chosen === year} onClick={() => onChoose(year)}>
            <strong>{year === 'none' ? 'No year' : year}</strong>
            <span className="quiet small">{approved} of {profiles.length} approved{decided ? ` · ${decided} decided` : ''}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The profile laid out as the display's record shows it, in its colours, so
 * a reviewer judges what a visitor will actually read. Only approximately the
 * display's look: the display itself is the final word.
 */
function DisplayPreview({ profile, theme }: { profile: Profile; theme: 'dark' | 'light' }) {
  const tags = profile.tags.contributions;
  return (
    <article className={`display-preview display-preview--${theme}`} aria-label={`${profile.name} as on the display`}>
      <div className="display-preview__portrait">
        {profile.portrait?.shown ? <img src={profile.portrait.src} alt="" /> : <span aria-hidden="true">{profile.name.slice(0, 1)}</span>}
      </div>
      <div className="display-preview__side">
        <p className="display-preview__label">Inductee record</p>
        <h2>{profile.name}</h2>
        <dl>
          <div><dt>Inducted</dt><dd>{profile.classYear ?? 'Not recorded'}</dd></div>
          {profile.presentedBy && <div><dt>Inducted by</dt><dd>{profile.presentedBy}</dd></div>}
          {profile.tags.communities.length > 0 && <div><dt>Community</dt><dd>{profile.tags.communities.join(', ')}</dd></div>}
        </dl>
        {tags.length > 0 && <p className="display-preview__tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</p>}
        {(profile.biography?.text ?? '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
          .map((part, index) => <p key={index} className="display-preview__bio">{part}</p>)}
        <p className="display-preview__label">
          {profile.biography?.provenance === 'curated'
            ? 'Biography reviewed and edited by Hall of Fame curators.'
            : 'Biography as recorded by the Cleveland International Hall of Fame.'}
        </p>
      </div>
    </article>
  );
}
