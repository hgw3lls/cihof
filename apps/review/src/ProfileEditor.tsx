import { useEffect, useRef, useState } from 'react';
import { previewProfile, type Profile, type ProfileEdit, type ProfilePreview, type Review } from './api.ts';
import { ProfileCard } from './Profiles.tsx';

type Props = {
  profile: Profile;
  review: Review;
  /** Where the editing starts: the profile as stored, or an edit kept earlier. */
  initial: ProfileEdit;
  onKeep: (edit: ProfileEdit) => void;
  onCancel: () => void;
};

/** Where the face sits in the round and square crops; `center` is how the display draws them all now. */
const focalPoints = [
  { value: 'center', label: 'Face towards the top (as usual)' },
  { value: '50% 0%', label: 'Face at the very top' },
  { value: '50% 35%', label: 'Face a little lower' },
  { value: '50% 50%', label: 'Face in the middle' },
  { value: '50% 70%', label: 'Face low in the picture' },
];

/**
 * The profile editor: the words, tags and picture text a visitor sees on one
 * profile, changed by hand and seen, as they change, the way the review shows
 * the profile. The server builds the edited profile as a release would, so
 * what is shown is what visitors would read.
 *
 * The class year and who presented them are the institution's roster, and
 * the biography has its own correction screen, so neither is here. Nothing is
 * written until the reviewer keeps the edit, and then only into their draft.
 * Saved, it changes the profile, so the profile's approval lapses until it is
 * approved as edited.
 */
export function ProfileEditor({ profile, review, initial, onKeep, onCancel }: Props) {
  const [edit, setEdit] = useState<ProfileEdit>(initial);
  const [previewed, setPreviewed] = useState<{ edit: ProfileEdit; preview: ProfilePreview } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const asked = useRef(0);
  const limits = review.limits.profile;
  const stored = profile.edit ?? initial;

  useEffect(() => {
    const ask = ++asked.current;
    const timer = window.setTimeout(() => {
      previewProfile(profile.id, edit)
        .then((answer) => { if (ask === asked.current) { setPreviewed({ edit, preview: answer }); setFailed(null); } })
        .catch((error: Error) => { if (ask === asked.current) setFailed(error.message); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [profile.id, edit]);

  const preview = previewed?.preview ?? null;
  const current = previewed !== null && JSON.stringify(previewed.edit) === JSON.stringify(edit) && !failed;
  const unchanged = JSON.stringify(edit) === JSON.stringify(stored);
  const problems = preview?.problems ?? [];
  const tagsChanged = ['communities', 'contributions', 'countries'].some((field) =>
    JSON.stringify(edit[field as 'communities']) !== JSON.stringify(stored[field as 'communities']));
  const set = <K extends keyof ProfileEdit>(field: K, value: ProfileEdit[K]) => setEdit((now) => ({ ...now, [field]: value }));

  return (
    <section className="profile-editor" aria-label={`Editing ${profile.name}'s profile`}>
      <div className="profile-editor__form">
        <h3 className="question">The name</h3>
        <label className="field">
          <span>As visitors read it <span className="quiet small">({edit.name.trim().length} of {limits.name} characters)</span></span>
          <input value={edit.name} maxLength={limits.name * 2} onChange={(event) => set('name', event.target.value)} />
        </label>
        <label className="field">
          <span>As it is alphabetised <span className="quiet small">(usually surname first, such as “Machaskee, Alex”)</span></span>
          <input value={edit.sortName} maxLength={limits.name * 2} onChange={(event) => set('sortName', event.target.value)} />
        </label>

        <h3 className="question">Tags</h3>
        <p className="quiet small">What visitors can find them by. Choose from the tags already in use where one fits.</p>
        <Tags title="Communities" field="communities" tags={edit.communities} known={review.profileTags.communities} limit={limits.tags} onChange={(tags) => set('communities', tags)} />
        <Tags title="Honoured for" field="contributions" tags={edit.contributions} known={review.profileTags.contributions} limit={limits.tags} onChange={(tags) => set('contributions', tags)} />
        <Tags title="Countries and heritage" field="countries" tags={edit.countries} known={review.profileTags.countries} limit={limits.tags} onChange={(tags) => set('countries', tags)} />

        <h3 className="question">The two lines under the name</h3>
        <p className="quiet small">
          The computer first wrote these from the tags, and they do not change when the tags do. Keep a line, use the computer’s
          wording for the tags as they are now, or write your own: your own words are shown as a curator’s, the computer’s as the computer’s.
        </p>
        {(['honoredFor', 'contextLine'] as const).map((field) => (
          <div key={field} className="profile-editor__line">
            <label className="field">
              <span>{field === 'honoredFor' ? '“Honoured for”' : 'The context line'} <span className="quiet small">({edit[field].trim().length} of {limits.line} characters; empty hides it)</span></span>
              <textarea rows={2} value={edit[field]} maxLength={limits.line * 2} onChange={(event) => set(field, event.target.value)} />
            </label>
            {preview && current && preview.composed[field] && preview.composed[field] !== edit[field].trim() && (
              <p className="small profile-editor__suggestion">
                The computer’s wording for these tags: “{preview.composed[field]}”{' '}
                <button type="button" className="link" onClick={() => set(field, preview.composed[field])}>Use it</button>
              </p>
            )}
            {/* Only when the tags this line is written from changed: its wording for them is not what it says. */}
            {tagsChanged && current && preview && edit[field].trim() === stored[field].trim() && preview.composed[field] !== edit[field].trim() && (
              <p className="todo small">The tags have changed, but this line still says what it said before.</p>
            )}
          </div>
        ))}

        <h3 className="question">The picture</h3>
        <label className="field">
          <span>Description for people who cannot see it <span className="quiet small">({edit.portraitAlt.trim().length} of {limits.portraitAlt} characters)</span></span>
          <textarea rows={2} value={edit.portraitAlt} maxLength={limits.portraitAlt * 2} onChange={(event) => set('portraitAlt', event.target.value)} />
        </label>
        <div className="profile-editor__focal">
          <label className="field field--inline">
            <span>Where the face sits</span>
            <select value={focalPoints.some((point) => point.value === edit.focalPoint) ? edit.focalPoint : ''}
              onChange={(event) => set('focalPoint', event.target.value)}>
              {!focalPoints.some((point) => point.value === edit.focalPoint) && <option value="">{edit.focalPoint}</option>}
              {focalPoints.map((point) => <option key={point.value} value={point.value}>{point.label}</option>)}
            </select>
          </label>
          {profile.portrait?.src && (
            <span className="profile-editor__crop" aria-hidden="true"
              style={{ backgroundImage: `url("${profile.portrait.src}")`, backgroundPosition: edit.focalPoint === 'center' ? '50% 18%' : edit.focalPoint }} />
          )}
        </div>

        {failed && <p className="todo" role="alert">The preview could not be worked out: {failed}</p>}
        {problems.length > 0 && (
          <ul className="todo" role="status">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        )}
        <div className="tour-editor__actions">
          <button type="button" className="primary" disabled={unchanged || problems.length > 0 || !current || preview?.changed === false}
            onClick={() => onKeep(edit)}>
            Keep these changes
          </button>
          <button type="button" onClick={onCancel}>Cancel</button>
          {!unchanged && <button type="button" className="link" onClick={() => setEdit(stored)}>Start again from the profile as it is</button>}
        </div>
        {unchanged && <p className="quiet small">Nothing has been changed yet.</p>}
      </div>

      <div className="profile-editor__preview" aria-label="As it would be" aria-busy={!current}>
        <p className="quiet small">As it would be</p>
        <ProfileCard profile={preview?.profile ?? profile} />
      </div>
    </section>
  );
}

export function Tags({ title, field, tags, known, limit, onChange }: {
  title: string; field: string; tags: string[]; known: string[]; limit: number; onChange: (tags: string[]) => void;
}) {
  const [typed, setTyped] = useState('');
  const add = () => {
    const value = typed.trim();
    if (value && !tags.some((tag) => tag.toLowerCase() === value.toLowerCase())) onChange([...tags, value]);
    setTyped('');
  };
  const list = `profile-tags-${field}`;
  return (
    <div className="tour-editor__words">
      <p className="small"><strong>{title}</strong> <span className="quiet">({tags.length} of {limit})</span></p>
      <ul className="chips">
        {tags.map((tag) => (
          <li key={tag}>
            <button type="button" className="chip chip--plain" onClick={() => onChange(tags.filter((each) => each !== tag))} aria-label={`Take off ${tag}`}>
              {tag} <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
        {tags.length === 0 && <li className="quiet small">None.</li>}
      </ul>
      <form className="tour-editor__word" onSubmit={(event) => { event.preventDefault(); add(); }}>
        <input value={typed} list={list} aria-label={`Add to ${title.toLowerCase()}`} placeholder="Add one" onChange={(event) => setTyped(event.target.value)} />
        <datalist id={list}>{known.filter((tag) => !tags.includes(tag)).map((tag) => <option key={tag} value={tag} />)}</datalist>
        <button type="submit" disabled={!typed.trim()}>Add</button>
      </form>
    </div>
  );
}
