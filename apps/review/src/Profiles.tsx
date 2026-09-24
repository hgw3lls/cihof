import { useMemo, useState } from 'react';
import type { Draft, Profile, Review, Text } from './api.ts';
import { Choice } from './Connections.tsx';
import { Portrait } from './Portrait.tsx';

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
 */
export function Profiles({ review, draft, update, onDone, onCorrectBiography, onBiography }: Props) {
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(
    () => review.profiles.filter((profile) => showAll || needsLook(profile) || draft.profiles[profile.id]),
    // Fixed while the reviewer works through it, so a decided profile stays put.
    [review.profiles, showAll],
  );
  const firstOpen = list.findIndex((profile) => !draft.profiles[profile.id]);
  const [index, setIndex] = useState(Math.max(firstOpen, 0));
  const profile = list[Math.min(index, list.length - 1)];
  const approved = review.profiles.filter((item) => item.state === 'approved').length;

  if (!profile) {
    return (
      <main className="page page--narrow">
        <h1>Profiles</h1>
        <p className="lead">Every profile is approved as it stands.</p>
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

      {profile.state === 'changed-since-approval' && (
        <p className="notice">This profile was approved, but something on it has changed since. Look at it again.</p>
      )}
      {profile.state === 'changes-requested' && (
        <p className="notice">Changes were asked for: <em>{profile.reviewNote}</em></p>
      )}

      <ProfileCard profile={profile} />

      <section className="panel">
        <h2 className="question">Is this profile right to show visitors?</h2>
        <p className="quiet">Check the name, the class year, the biography, the lines above it and the picture.</p>
        {biographyPending
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
      </section>

      <nav className="pager">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</button>
        <button type="button" onClick={onDone}>Stop for now</button>
        {index < list.length - 1
          ? <button type="button" className="primary" onClick={() => setIndex(index + 1)}>{value ? 'Next →' : 'Skip for now →'}</button>
          : <button type="button" className="primary" onClick={onDone}>Finish</button>}
      </nav>
    </main>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
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
    </p>
  );
}
