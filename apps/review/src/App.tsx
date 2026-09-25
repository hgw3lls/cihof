import { useCallback, useEffect, useRef, useState } from 'react';
import { loadReview, putDraft, type Draft, type Review } from './api.ts';
import { AttractWords } from './AttractWords.tsx';
import { Biographies } from './Biographies.tsx';
import { Connections } from './Connections.tsx';
import { Places } from './Places.tsx';
import { Profiles } from './Profiles.tsx';
import { SaveScreen } from './Save.tsx';

type Screen = 'home' | 'profiles' | 'ties' | 'places' | 'bios' | 'attract' | 'save';

/**
 * The staff review app.
 *
 * One kind of review at a time, one item at a time, in plain words. Every
 * choice is kept on this computer as it is made, so closing the window loses
 * nothing; nothing reaches the exhibit until the reviewer checks and saves on
 * the last screen, and even then it waits for the developer to publish it.
 */
export function App() {
  const [review, setReview] = useState<Review | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [error, setError] = useState<string | null>(null);
  const [biographyFor, setBiographyFor] = useState<string | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      const next = await loadReview();
      setReview(next);
      setDraft(next.draft);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  // Every change is written straight away, in order.
  const update = useCallback((change: (current: Draft) => Draft) => {
    setDraft((current) => {
      if (!current) return current;
      const next = change(current);
      saving.current = saving.current.then(() => putDraft(next)).catch((reason) => {
        setError(`Your last choice was not kept: ${reason instanceof Error ? reason.message : String(reason)}`);
      });
      return next;
    });
  }, []);

  if (error && !review) return <main className="page"><p className="problem">{error}</p></main>;
  if (!review || !draft) return <main className="page"><p className="quiet">Loading…</p></main>;

  if (!draft.reviewer.trim()) {
    return <Welcome onName={(name) => update((current) => ({ ...current, reviewer: name }))} />;
  }

  const counts = {
    profiles: Object.keys(draft.profiles).length,
    ties: Object.keys(draft.ties).length,
    places: Object.values(draft.places).filter((value) => value.approve).length + Object.keys(draft.placeTies).length,
    bios: Object.keys(draft.bios).length,
    attract: Object.keys(draft.attract ?? {}).length,
  };
  const waiting = counts.profiles + counts.ties + counts.places + counts.bios + counts.attract;
  const back = () => setScreen('home');

  return (
    <>
      <header className="bar">
        <button type="button" className="bar__home" onClick={back}>CIHOF staff review</button>
        <span className="bar__who">
          {draft.reviewer}
          <button type="button" className="link" onClick={() => update((current) => ({ ...current, reviewer: '' }))}>Not you?</button>
        </span>
      </header>
      {error && <p className="problem banner" role="alert">{error}</p>}

      {screen === 'home' && (
        <Home
          review={review}
          draft={draft}
          waiting={waiting}
          counts={counts}
          onOpen={setScreen}
        />
      )}
      {screen === 'profiles' && (
        <Profiles review={review} draft={draft} update={update} onDone={back}
          onCorrectBiography={() => setScreen('bios')} onBiography={setBiographyFor} />
      )}
      {screen === 'ties' && <Connections review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'places' && <Places review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'bios' && (
        <Biographies review={review} draft={draft} update={update} onDone={() => { setBiographyFor(null); back(); }} startWith={biographyFor} />
      )}
      {screen === 'attract' && <AttractWords review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'save' && (
        <SaveScreen review={review} draft={draft} onBack={back} onSaved={async () => { await reload(); }} />
      )}
    </>
  );
}

function Welcome({ onName }: { onName: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <main className="page page--narrow">
      <h1>Welcome</h1>
      <p className="lead">
        This is where the Hall of Fame's research is checked before visitors see it.
        You will look at one thing at a time and say what the record shows.
        Nothing you do here changes the exhibit until you choose to save, and even
        then it waits for the developer to publish it.
      </p>
      <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onName(name.trim()); }}>
        <label className="field">
          <span>Who is reviewing today?</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" />
        </label>
        <p className="quiet">Your name is saved with every decision you make, so it is clear who decided what.</p>
        <button type="submit" className="primary" disabled={!name.trim()}>Start</button>
      </form>
    </main>
  );
}

function Home({ review, draft, waiting, counts, onOpen }: {
  review: Review;
  draft: Draft;
  waiting: number;
  counts: { profiles: number; ties: number; places: number; bios: number; attract: number };
  onOpen: (screen: Screen) => void;
}) {
  // Undecided, or decided with wording that cannot go on the map: the same
  // ties the Connections screen brings back.
  const tiesOpen = review.ties.filter((tie) => (tie.status === 'unreviewed' || tie.wordingProblem) && !draft.ties[tie.tieId]).length;
  // Only places with something to decide count: a place with no history and
  // nobody tied to it has nothing to review yet.
  const reviewable = review.places.filter((place) => (place.canApprove && !place.reviewed) || place.ties.length > 0);
  const placesOpen = reviewable.filter((place) => placeNeedsWork(place, draft)).length;

  return (
    <main className="page">
      <h1>What would you like to review?</h1>
      <p className="lead">Pick one. You can stop at any point; your choices are kept on this computer.</p>

      <div className="cards">
        <Card
          title="Profiles"
          body="Each inductee's profile as visitors see it. Approve it, or say what needs changing."
          progress={{ done: review.profiles.filter((profile) => profile.state === 'approved').length, total: review.profiles.length }}
          pending={counts.profiles}
          onOpen={() => onOpen('profiles')}
        />
        <Card
          title="Connections"
          body="Links the research found between two inductees. Say whether each is a real relationship, two people who simply appear together, or a mistake."
          progress={{ done: review.ties.length - tiesOpen, total: review.ties.length }}
          pending={counts.ties}
          onOpen={() => onOpen('ties')}
        />
        <Card
          title="Places"
          body="Places in Greater Cleveland tied to inductees. Decide which to show, and what each person did there."
          progress={{ done: reviewable.length - placesOpen, total: reviewable.length }}
          pending={counts.places}
          onOpen={() => onOpen('places')}
        />
        <Card
          title="Biographies"
          body="Correct a biography: a misspelt name, a wrong date, a sentence that needs fixing."
          pending={counts.bios}
          onOpen={() => onOpen('bios')}
        />
        <Card
          title="Attract screen words"
          body="The headline and line beneath on the display while nobody is using it. Approve them, or write your own."
          progress={{ done: review.attract.approved ? 1 : 0, total: 1 }}
          pending={counts.attract}
          onOpen={() => onOpen('attract')}
        />
      </div>

      <section className="save-call">
        {waiting === 0
          ? <p className="quiet">When you have made some decisions, you will save them here.</p>
          : (
            <>
              <p><strong>{waiting} decision{waiting === 1 ? '' : 's'}</strong> ready to check and save.</p>
              <button type="button" className="primary" onClick={() => onOpen('save')}>Check and save</button>
            </>
          )}
        {review.git.unpushed ? (
          <p className="quiet">
            {review.git.unpushed} saved review{review.git.unpushed === 1 ? ' is' : 's are'} waiting for the developer to publish.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Card({ title, body, progress, pending, onOpen }: {
  title: string;
  body: string;
  progress?: { done: number; total: number };
  pending: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="card" onClick={onOpen}>
      <h2>{title}</h2>
      <p>{body}</p>
      {progress && (
        <span className="progress" aria-label={`${progress.done} of ${progress.total} done`}>
          <span className="progress__bar"><span style={{ width: `${(100 * progress.done) / Math.max(progress.total, 1)}%` }} /></span>
          <span>{progress.done} of {progress.total} done</span>
        </span>
      )}
      {pending > 0 && <span className="badge">{pending} not yet saved</span>}
    </button>
  );
}

/** A place still has something to decide: an approval it could have, or a person with no role. */
export function placeNeedsWork(place: Review['places'][number], draft: Draft): boolean {
  const approvalOpen = place.canApprove && !place.reviewed && draft.places[place.placeId] === undefined;
  const tiesOpen = place.ties.some((tie) => !tie.role && !draft.placeTies[`${place.placeId}|${tie.person.id}`]);
  return approvalOpen || tiesOpen;
}
