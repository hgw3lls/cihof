import { useState } from 'react';
import { uploadFile, type Draft, type NewInductee, type Review } from './api.ts';
import { preparePicture } from './Media.tsx';
import { Tags } from './ProfileEditor.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * New inductees: this year's class, added to the exhibit.
 *
 * Each person is written from the Hall of Fame's own record of the
 * induction: the name, the year, who inducted them, the biography in the
 * institution's own words, the tags, and a portrait. Nothing is filled in for
 * them: the permanent id comes from the name and year as for everybody else,
 * and the line about what they are honoured for is left for the profile
 * editor once they are added. A portrait whose rights nobody confirmed is
 * kept off the display until somebody does.
 */
export function NewInductees({ review, draft, update, onDone }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const people = Object.entries(draft.newClass ?? {});
  const set = (key: string, value: NewInductee | undefined) => update((current) => {
    const newClass = { ...(current.newClass ?? {}) };
    if (value) newClass[key] = value; else delete newClass[key];
    return { ...current, newClass };
  });

  if (editing) {
    return (
      <main className="page page--narrow">
        <InducteeForm review={review} initial={draft.newClass?.[editing] ?? blank()}
          onKeep={(value) => { set(editing, value); setEditing(null); }} onCancel={() => setEditing(null)} />
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <h1>New inductees</h1>
      <p className="lead">
        Add this year&rsquo;s class to the exhibit, one person at a time, from the Hall of Fame&rsquo;s own record of the induction.
        They are added when you check and save.
      </p>
      {people.length > 0 && (
        <section className="panel">
          <h2 className="question">Ready to add</h2>
          <ul className="media-films">
            {people.map(([key, person]) => (
              <li key={key}>
                {person.portrait ? <img src={`/api/uploads/${person.portrait}`} alt="" className="new-inductee__portrait" /> : <span className="media-person__none" />}
                <span>
                  <strong>{person.displayName || person.name}</strong>
                  <span className="quiet small">
                    Class of {person.classYear}{inducteeProblem(person, review) ? ` · not finished: ${inducteeProblem(person, review)}` : ''}
                    {!person.rightsConfirmed ? ' · portrait kept off the display until its rights are confirmed' : ''}
                  </span>
                </span>
                <button type="button" onClick={() => setEditing(key)}>Edit</button>
                <button type="button" className="link" onClick={() => set(key, undefined)}>Don&rsquo;t add</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p><button type="button" className="primary" onClick={() => setEditing(`new-${Date.now()}`)}>Add an inductee…</button></p>
      <p className="quiet small">
        Once they are added, their profiles can be approved and edited, and their films added, like everybody else&rsquo;s.
      </p>
      <nav className="pager">
        <span />
        <button type="button" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function InducteeForm({ review, initial, onKeep, onCancel }: {
  review: Review;
  initial: NewInductee;
  onKeep: (value: NewInductee) => void;
  onCancel: () => void;
}) {
  const [person, setPerson] = useState<NewInductee>(initial);
  const [sortTouched, setSortTouched] = useState(Boolean(initial.sortName));
  const [busy, setBusy] = useState(false);
  const [pictureProblem, setPictureProblem] = useState<string | null>(null);
  const change = (next: Partial<NewInductee>) => setPerson((current) => ({ ...current, ...next }));
  const limit = review.limits.profile;

  const choosePicture = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setPictureProblem(null);
    try {
      const uploaded = await uploadFile(await preparePicture(file), 'jpg');
      if (!uploaded.width || !uploaded.height || uploaded.width < 200 || uploaded.height < 200) throw new Error('The picture is too small to show well: it needs to be at least 200 by 200 pixels.');
      change({ portrait: uploaded.name, portraitWidth: uploaded.width, portraitHeight: uploaded.height });
    } catch (reason) {
      setPictureProblem(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const problem = inducteeProblem(person, review);
  return (
    <>
      <h1>{initial.name ? `${initial.name}` : 'A new inductee'}</h1>
      <p className="lead">From the Hall of Fame&rsquo;s own record of the induction. Only how the name is alphabetised is suggested; check it.</p>

      <section className="panel">
        <label className="field">
          <span>Full name <span className="quiet small">(as the Hall of Fame records it)</span></span>
          <input value={person.name} maxLength={limit.name} onChange={(event) => {
            const name = event.target.value;
            change({ name, ...(sortTouched ? {} : { sortName: sortNameOf(name) }) });
          }} />
        </label>
        <label className="field">
          <span>Name as visitors see it <span className="quiet small">(leave empty to use the full name)</span></span>
          <input value={person.displayName} maxLength={limit.name} placeholder={person.name} onChange={(event) => change({ displayName: event.target.value })} />
        </label>
        <label className="field">
          <span>Name as it is alphabetised <span className="quiet small">(e.g. Brown, Jeanette Grasselli)</span></span>
          <input value={person.sortName} maxLength={limit.name} onChange={(event) => { setSortTouched(true); change({ sortName: event.target.value }); }} />
        </label>
        <div className="field-row">
          <label className="field field--inline">
            <span>Class of</span>
            <input inputMode="numeric" value={person.classYear ?? ''} maxLength={4}
              onChange={(event) => change({ classYear: /^\d{1,4}$/.test(event.target.value) ? Number(event.target.value) : null })} />
          </label>
          <label className="field field--inline">
            <span>Region</span>
            <select value={person.region} onChange={(event) => change({ region: event.target.value })}>
              <option value="">Choose…</option>
              {review.regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Inducted by <span className="quiet small">(the person who presented them)</span></span>
          <input value={person.inductedBy} maxLength={200} onChange={(event) => change({ inductedBy: event.target.value })} />
        </label>
        <label className="field">
          <span>Biography <span className="quiet small">(the Hall of Fame&rsquo;s own text)</span></span>
          <textarea rows={8} value={person.biography} onChange={(event) => change({ biography: event.target.value })} />
        </label>
        <label className="field">
          <span>Their page on the Hall of Fame&rsquo;s website <span className="quiet small">(optional)</span></span>
          <input value={person.profileUrl} placeholder="https://" onChange={(event) => change({ profileUrl: event.target.value })} />
        </label>
      </section>

      <section className="panel">
        <h2 className="question">Communities, honours and countries</h2>
        <Tags title="Communities" field="new-communities" tags={person.communityTags} known={review.profileTags.communities} limit={limit.tags}
          onChange={(communityTags) => change({ communityTags })} />
        <Tags title="Honoured for" field="new-contributions" tags={person.themeTags} known={review.profileTags.contributions} limit={limit.tags}
          onChange={(themeTags) => change({ themeTags })} />
        <Tags title="Countries" field="new-countries" tags={person.countryTags} known={review.profileTags.countries} limit={limit.tags}
          onChange={(countryTags) => change({ countryTags })} />
      </section>

      <section className="panel">
        <h2 className="question">Portrait</h2>
        {person.portrait && (
          <figure className="media-portraits">
            <img src={`/api/uploads/${person.portrait}`} alt={person.portraitAltText} />
          </figure>
        )}
        <label className="field">
          <span>{person.portrait ? 'Choose a different picture' : 'Choose a picture'} <span className="quiet small">(JPEG, PNG or WebP)</span></span>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void choosePicture(event.target.files?.[0])} />
        </label>
        {busy && <p className="quiet" role="status">Preparing the picture…</p>}
        {pictureProblem && <p className="problem" role="alert">{pictureProblem}</p>}
        <label className="field">
          <span>Describe the picture for people who cannot see it <span className="quiet small">({person.portraitAltText.trim().length} of {limit.portraitAlt} characters)</span></span>
          <textarea rows={2} value={person.portraitAltText} maxLength={limit.portraitAlt * 2} onChange={(event) => change({ portraitAltText: event.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={person.rightsConfirmed} onChange={(event) => change({ rightsConfirmed: event.target.checked })} />
          <span>The museum has the right to show this picture in the exhibit, permanently. <span className="quiet small">Leave it unticked to add them with the portrait kept off the display for now.</span></span>
        </label>
      </section>

      <label className="field">
        <span>A note, if you want one <span className="quiet small">(kept with the decision)</span></span>
        <input value={person.note ?? ''} onChange={(event) => change({ note: event.target.value })} />
      </label>

      {problem && <p className="todo" role="status">Still needed: {problem}</p>}
      <nav className="pager">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={Boolean(problem) || busy} onClick={() => onKeep({ ...person, displayName: person.displayName.trim(), name: person.name.trim() })}>
          Keep
        </button>
      </nav>
    </>
  );
}

/** What stops a new inductee from being added, or null. */
export function inducteeProblem(person: NewInductee, review: Pick<Review, 'regions' | 'limits'>): string | null {
  const missing = [
    !person.name.trim() ? 'their full name' : null,
    !person.classYear || person.classYear < 1900 || person.classYear > 2100 ? 'the year of their class' : null,
    !person.sortName.trim() ? 'how their name is alphabetised' : null,
    !review.regions.includes(person.region) ? 'a region' : null,
    !person.biography.trim() ? 'their biography' : null,
    !person.portrait ? 'a portrait' : null,
    !person.portraitAltText.trim() ? 'a description of the portrait' : null,
    person.portraitAltText.trim().length > review.limits.profile.portraitAlt ? 'a shorter description of the portrait' : null,
  ].filter(Boolean);
  return missing.length > 0 ? `${missing.join(', ')}.` : null;
}

/** "Jeanette Grasselli Brown" sorts as "Brown, Jeanette Grasselli": a suggestion, changed freely. */
export function sortNameOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return name.trim();
  return `${words.at(-1)}, ${words.slice(0, -1).join(' ')}`;
}

function blank(): NewInductee {
  return {
    name: '', classYear: new Date().getFullYear(), displayName: '', sortName: '', region: '', profileUrl: '', inductedBy: '', biography: '',
    themeTags: [], countryTags: [], communityTags: [], portrait: '', portraitAltText: '', rightsConfirmed: false, note: '',
  };
}
