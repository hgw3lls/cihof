import { useCallback, useEffect, useRef, useState } from 'react';
import { loadReview, putDraft, type Draft, type Review } from './api.ts';
import { AttractWords } from './AttractWords.tsx';
import { FilmStarts } from './FilmStarts.tsx';
import { Tours } from './Tours.tsx';
import { FilmTitles } from './FilmTitles.tsx';
import { Signoffs } from './Signoffs.tsx';
import { History } from './History.tsx';
import { FilmCaptions } from './FilmCaptions.tsx';
import { Biographies } from './Biographies.tsx';
import { Connections } from './Connections.tsx';
import { Places } from './Places.tsx';
import { Profiles } from './Profiles.tsx';
import { SaveScreen } from './Save.tsx';
import { DisplayUpdateScreen } from './DisplayUpdate.tsx';
import { Media } from './Media.tsx';
import { NewInductees } from './NewInductees.tsx';

type Screen = 'home' | 'profiles' | 'ties' | 'places' | 'bios' | 'attract' | 'tours' | 'filmTitles' | 'filmStarts' | 'filmFixes' | 'signoffs' | 'history' | 'save' | 'update' | 'media' | 'newClass';

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
    return <Welcome portal={review.mode === 'portal'} onName={(name) => update((current) => ({ ...current, reviewer: name }))} />;
  }

  const counts = {
    profiles: Object.keys(draft.profiles).length + Object.keys(draft.profileEdits ?? {}).length,
    ties: Object.keys(draft.ties).length,
    places: Object.values(draft.places).filter((value) => value.approve).length + Object.keys(draft.placeTies).length + Object.keys(draft.placeEdits ?? {}).length,
    bios: Object.keys(draft.bios).length,
    attract: Object.keys(draft.attract ?? {}).length,
    tours: Object.keys(draft.tours ?? {}).length,
    filmTitles: Object.keys(draft.filmTitles ?? {}).length,
    filmStarts: Object.keys(draft.filmStarts ?? {}).length,
    signoffs: Object.keys(draft.signoffs ?? {}).length,
    filmFixes: Object.keys(draft.filmFixes ?? {}).length,
    media: Object.keys(draft.portraits ?? {}).length + Object.keys(draft.films ?? {}).length,
    newClass: Object.keys(draft.newClass ?? {}).length,
  };
  const waiting = counts.newClass + counts.profiles + counts.ties + counts.places + counts.bios + counts.attract + counts.tours + counts.filmTitles + counts.filmStarts + counts.signoffs + counts.filmFixes + counts.media;
  const back = () => setScreen('home');

  return (
    <>
      <header className="bar">
        <button type="button" className="bar__home" onClick={back}>{review.mode === 'portal' ? 'CIHOF staff portal' : 'CIHOF staff review'}</button>
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
      {screen === 'filmTitles' && <FilmTitles review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'tours' && <Tours review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'filmStarts' && <FilmStarts review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'signoffs' && <Signoffs review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'history' && <History onDone={back} />}
      {screen === 'newClass' && <NewInductees review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'media' && <Media review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'filmFixes' && <FilmCaptions review={review} draft={draft} update={update} onDone={back} />}
      {screen === 'save' && (
        <SaveScreen review={review} draft={draft} onBack={back} onSaved={async () => { await reload(); }}
          onUpdate={() => setScreen('update')} />
      )}
      {screen === 'update' && review.portal && (
        <DisplayUpdateScreen portal={review.portal} waiting={waiting} onBack={back} onSave={() => setScreen('save')}
          onMade={async () => { await reload(); }} />
      )}
    </>
  );
}

function Welcome({ portal, onName }: { portal: boolean; onName: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <main className="page page--narrow">
      <h1>Welcome</h1>
      {portal ? (
        <p className="lead">
          This is where what the display shows is checked and changed.
          You will look at one thing at a time and say what the record shows.
          Nothing you do here changes the display until you save it and load a
          display update onto it, and the display can always go back.
        </p>
      ) : (
        <p className="lead">
          This is where the Hall of Fame's research is checked before visitors see it.
          You will look at one thing at a time and say what the record shows.
          Nothing you do here changes the exhibit until you choose to save, and even
          then it waits for the developer to publish it.
        </p>
      )}
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
  counts: { profiles: number; ties: number; places: number; bios: number; attract: number; tours: number; filmTitles: number; filmStarts: number; signoffs: number; filmFixes: number; media: number; newClass: number };
  onOpen: (screen: Screen) => void;
}) {
  // Undecided, or decided with wording that cannot go on the map: the same
  // ties the Connections screen brings back.
  const tiesOpen = review.ties.filter((tie) => (tie.status === 'unreviewed' || tie.wordingProblem) && !draft.ties[tie.tieId]).length;
  // Only places with something to decide count: a place with no history and
  // nobody tied to it has nothing to review yet.
  const reviewable = review.places.filter((place) => (place.canApprove && !place.reviewed) || place.words === 'legacy' || place.words === 'changed' || place.ties.length > 0);
  const placesOpen = reviewable.filter((place) => placeNeedsWork(place, draft)).length;

  return (
    <main className="page">
      <Readiness lines={review.readiness} />

      <h1>{review.mode === 'portal' ? 'What would you like to review or change?' : 'What would you like to review?'}</h1>
      <p className="lead">
        Pick one. You can stop at any point; your choices are kept on this computer.
        {review.mode === 'portal' ? ' Saved changes reach the display in a display update, made below.' : ''}
      </p>

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
        {/* Always offered, even with no tours: it is where a new one is started. */}
        <Card
          title="Tours"
          body="The curated tours a visitor can choose. Check each one's words and the people it visits, approve it for visitors, edit it, or start a new one."
          progress={{ done: review.tours.filter((tour) => tour.state === 'approved').length, total: review.tours.length }}
          pending={counts.tours}
          onOpen={() => onOpen('tours')}
        />
        {review.filmTitles.length > 0 && (
          <Card
            title="Film titles"
            body="What each film is called in a person's list of films. Use the title it has on YouTube, after checking it, or write one."
            progress={{ done: review.filmTitles.filter((film) => film.approvedTitle).length, total: review.filmTitles.length }}
            pending={counts.filmTitles}
            onOpen={() => onOpen('filmTitles')}
          />
        )}
        {review.filmStarts.length > 0 && (
          <Card
            title="Where ceremony films start"
            body="Some inductees' film is a whole ceremony shared with others. Choose where it opens for each of them."
            progress={{ done: review.filmStarts.filter((entry) => entry.approvedSeconds !== null).length, total: review.filmStarts.length }}
            pending={counts.filmStarts}
            onOpen={() => onOpen('filmStarts')}
          />
        )}
        <Card
          title="Film captions and transcripts"
          body={`Fix what the automatic captions got wrong: music heard as words, blank-audio marks, misheard names. Noise found in ${
            review.films.filter((film) => film.music.transcriptCount + film.music.captionCount + film.blank.transcriptCount + film.blank.captionCount > 0).length
          } of ${review.films.length} films.`}
          pending={counts.filmFixes}
          onOpen={() => onOpen('filmFixes')}
        />
        {/* The files chosen stay on this computer, so not where decisions are exported for somebody else to bring in. */}
        {review.mode !== 'export' && (
          <Card
            title="New inductees"
            body="Add this year's class: each person's name, class, biography, tags and portrait, from the Hall of Fame's own record."
            pending={counts.newClass}
            onOpen={() => onOpen('newClass')}
          />
        )}
        {review.mode !== 'export' && (
          <Card
            title="Portraits and films"
            body="Give somebody a new portrait, add a film to their films, or take a film off the display."
            pending={counts.media}
            onOpen={() => onOpen('media')}
          />
        )}
        <Card
          title="Sign-offs"
          body="Record a signature given outside the app: the logo, the installation checks, the approval to open."
          progress={{ done: review.signoffs.filter((item) => item.signed).length, total: review.signoffs.length }}
          pending={counts.signoffs}
          onOpen={() => onOpen('signoffs')}
        />
      </div>

      <section className="save-call">
        {waiting === 0
          ? <p className="quiet">When you have made some decisions, you will {review.mode === 'export' ? 'export' : 'save'} them here.</p>
          : (
            <>
              <p><strong>{waiting} decision{waiting === 1 ? '' : 's'}</strong> ready to check and {review.mode === 'export' ? 'export' : 'save'}.</p>
              <button type="button" className="primary" onClick={() => onOpen('save')}>{review.mode === 'export' ? 'Check and export' : 'Check and save'}</button>
            </>
          )}
        {review.portal && (
          <p>
            {review.portal.pending.length > 0
              ? <><strong>{review.portal.pending.length} saved change{review.portal.pending.length === 1 ? '' : 's'}</strong> not yet on the display. </>
              : null}
            <button type="button" className={review.portal.pending.length > 0 ? 'primary' : 'link'} onClick={() => onOpen('update')}>
              {review.portal.pending.length > 0 ? 'Make a display update' : 'Display updates'}
            </button>
          </p>
        )}
        {review.git.unpushed ? (
          <p className="quiet">
            {review.git.unpushed} saved review{review.git.unpushed === 1 ? ' is' : 's are'} waiting for the developer to publish.
          </p>
        ) : null}
        {review.mode !== 'portal' && (
          <p><button type="button" className="link" onClick={() => onOpen('history')}>
            {review.mode === 'export' ? 'History: the decisions exported from this computer' : 'History: who decided what, and when'}
          </button></p>
        )}
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
  // An approval that does not cover the words visitors read needs a look, as
  // does a place nobody has approved. A choice made about other words (the
  // place changed since) does not count as an answer.
  const wanted = (place.canApprove && !place.reviewed) || place.words === 'legacy' || place.words === 'changed';
  const answered = placeAnswered(place, draft);
  const approvalOpen = wanted && !answered;
  const tiesOpen = place.ties.some((tie) => !tie.role && !draft.placeTies[`${place.placeId}|${tie.person.id}`]);
  return approvalOpen || tiesOpen;
}

/** Whether the reviewer's choice about this place still applies to its words. */
export function placeAnswered(place: Review['places'][number], draft: Draft): boolean {
  const value = draft.places[place.placeId];
  if (!value) return false;
  if (!value.approve) return true;
  return value.seenVersion === place.contentVersion;
}

/**
 * What still stands between the exhibit and opening day, read from the
 * records. Nothing here is ticked by hand: it changes when the work is saved,
 * or when a sign-off is recorded.
 */
function Readiness({ lines }: { lines: Review['readiness'] }) {
  const open = lines.filter((line) => line.open > 0);
  return (
    <section className="panel readiness" aria-labelledby="readinessTitle">
      <h2 id="readinessTitle">Ready for opening?</h2>
      <p className="quiet">
        {open.length === 0
          ? 'Everything the records track is done.'
          : `${lines.length - open.length} of ${lines.length} done. Still open:`}
      </p>
      {open.length > 0 && (
        <ul className="readiness__list">
          {open.map((line) => (
            <li key={line.title}>
              {line.title}
              {line.total > 1 && <span className="quiet"> · {line.done} of {line.total}</span>}
              <span className="quiet small"> · {line.where}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
