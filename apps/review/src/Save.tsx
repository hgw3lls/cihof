import { useState } from 'react';
import { checkDecisions, saveDecisions, type Audience, type Draft, type Review, type StepResult } from './api.ts';
import { isComplete } from './Connections.tsx';
import { wordingProblem } from './AttractWords.tsx';
import { historyProblem } from './Places.tsx';
import { clock, startProblem } from './FilmStarts.tsx';

type Props = {
  review: Review;
  draft: Draft;
  onBack: () => void;
  onSaved: () => Promise<void>;
};

/**
 * Check, then save. Checking runs every tool without writing anything, so a
 * problem is found while it can still be fixed; saving runs them for real and
 * records each kind of review as a saved change on this computer, for the
 * developer to publish.
 */
export function SaveScreen({ review, draft, onBack, onSaved }: Props) {
  const [audience, setAudience] = useState<Audience>('kiosk');
  const [checked, setChecked] = useState<StepResult[] | null>(null);
  const [saved, setSaved] = useState<StepResult[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tieName = (id: string) => {
    const tie = review.ties.find((item) => item.tieId === id);
    return tie ? `${tie.a.name} & ${tie.b.name}` : id;
  };
  const unfinished = [
    ...Object.entries(draft.ties).filter(([, value]) => !isComplete(value, review.kinds, review.limits.label)).map(([id]) => tieName(id)),
    ...Object.entries(draft.profiles).filter(([, value]) => value.decision === 'changes' && !value.note?.trim())
      .map(([id]) => `${review.profiles.find((profile) => profile.id === id)?.name ?? id}'s profile`),
    // An approval covers the words the reviewer saw. A biography correction
    // for the same person would change them straight after, so the two cannot
    // be saved together: save the correction first, then approve.
    ...Object.entries(draft.profiles).filter(([id, value]) => value.decision === 'approve' && draft.bios[id])
      .map(([id]) => `${review.profiles.find((profile) => profile.id === id)?.name ?? id}'s profile (approved, but the biography correction for them must be saved first; clear the approval for now)`),
    ...Object.values(draft.attract ?? {}).filter((value) => wordingProblem(value, review.limits)).map(() => 'the attract screen words'),
    // A start past the end of its film cannot be saved.
    ...Object.entries(draft.filmStarts ?? {}).flatMap(([key, value]) => {
      const entry = review.filmStarts.find((item) => item.key === key);
      if (!entry) return [`a ceremony film start that is no longer offered (${key})`];
      return value.decision === 'start' && startProblem(String(value.seconds), entry.durationSeconds) ? [`where ${entry.name}'s film starts`] : [];
    }),
    // A place's approval names the words it covers: new words must be
    // showable, and a choice made before the words changed is no answer.
    ...Object.entries(draft.places).flatMap(([id, value]) => {
      if (!value.approve) return [];
      const place = review.places.find((item) => item.placeId === id);
      const name = place?.name ?? id;
      if (!place || value.seenVersion !== place.contentVersion) return [`${name} (its words changed since you chose; look again)`];
      return typeof value.history === 'string' && historyProblem(value.history, review.limits.placeHistory) ? [`the words for ${name}`] : [];
    }),
  ];
  const shown = Object.values(draft.ties).some((value) => value.decision !== 'reject');
  const lines = summary(review, draft, tieName);

  const run = async (what: 'check' | 'save') => {
    setBusy(what === 'check' ? 'Checking…' : 'Saving… this can take a minute.');
    setError(null);
    try {
      if (what === 'check') {
        setChecked((await checkDecisions(audience)).results);
      } else {
        const outcome = await saveDecisions(audience);
        setSaved(outcome.results);
        await onSaved();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  if (saved) {
    const failed = saved.find((result) => !result.ok);
    return (
      <main className="page page--narrow">
        <h1>{failed ? 'Some of it was saved' : 'Saved'}</h1>
        <ul className="results">
          {saved.map((result) => (
            <li key={result.task} className={result.ok ? 'done' : 'problem'}>
              <strong>{result.title}</strong>:{' '}
              {result.ok
                ? result.commit ? `saved (${result.count} decision${result.count === 1 ? '' : 's'}, change ${result.commit})` : 'already recorded; nothing new to save'
                : 'not saved'}
              {!result.ok && <Details output={result.output} />}
            </li>
          ))}
        </ul>
        {failed
          ? <p>Nothing of the part that failed was kept, and your decisions for it are still here. Show the details above to the developer.</p>
          : <p className="lead">Your decisions are saved on this computer. They reach the exhibit when the developer publishes them; let them know.</p>}
        <button type="button" className="primary" onClick={onBack}>Back to the start</button>
      </main>
    );
  }

  const checkFailed = checked?.some((result) => !result.ok);

  return (
    <main className="page page--narrow">
      <h1>Check and save</h1>

      <section className="panel">
        <h2 className="question">Your decisions</h2>
        {lines.length === 0 ? <p className="quiet">Nothing to save yet.</p> : (
          <ul className="summary">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
        )}
      </section>

      {unfinished.length > 0 && (
        <p className="notice">
          Not finished: {unfinished.join(', ')}. Finish or clear {unfinished.length === 1 ? 'it' : 'them'} first.
        </p>
      )}

      {shown && (
        <section className="panel">
          <h2 className="question">Who may see the connections you kept?</h2>
          <div className="choices choices--small">
            <button type="button" className="choice" aria-pressed={audience === 'kiosk'} onClick={() => { setAudience('kiosk'); setChecked(null); }}>
              <strong>The exhibit only</strong><span>The touchscreen in the gallery. The usual choice.</span>
            </button>
            <button type="button" className="choice" aria-pressed={audience === 'kiosk-and-web'} onClick={() => { setAudience('kiosk-and-web'); setChecked(null); }}>
              <strong>The exhibit and the public website</strong><span>Only if it has been agreed that these may go online.</span>
            </button>
          </div>
        </section>
      )}

      {checked && (
        <section className="panel">
          <h2 className="question">{checkFailed ? 'Something needs fixing' : 'Everything checks out'}</h2>
          <ul className="results">
            {checked.map((result) => (
              <li key={result.task} className={result.ok ? 'done' : 'problem'}>
                <strong>{result.title}</strong>: {result.ok ? `${result.count} ready` : 'a problem was found'}
                <Details output={result.output} open={!result.ok} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="problem" role="alert">{error}</p>}
      {busy && <p className="quiet" role="status">{busy}</p>}

      <nav className="pager">
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" disabled={Boolean(busy) || lines.length === 0 || unfinished.length > 0} onClick={() => run('check')}>
          {checked ? 'Check again' : 'Check my decisions'}
        </button>
        <button type="button" className="primary" disabled={Boolean(busy) || !checked || Boolean(checkFailed) || unfinished.length > 0}
          onClick={() => run('save')}>
          Save
        </button>
      </nav>
      {!checked && lines.length > 0 && <p className="quiet">Check first. Saving becomes available once everything checks out.</p>}
    </main>
  );
}

function Details({ output, open = false }: { output: string; open?: boolean }) {
  if (!output.trim()) return null;
  return (
    <details open={open}>
      <summary>Details</summary>
      <pre className="output">{output}</pre>
    </details>
  );
}

function summary(review: Review, draft: Draft, tieName: (id: string) => string): string[] {
  const lines: string[] = [];
  for (const [id, value] of Object.entries(draft.profiles)) {
    const name = review.profiles.find((profile) => profile.id === id)?.name ?? id;
    lines.push(`Profiles: ${name}: ${value.decision === 'approve' ? 'approved' : `changes needed (${value.note ?? ''})`}`);
  }
  for (const [id, value] of Object.entries(draft.ties)) {
    const what = value.decision === 'relationship'
      ? `a connection (${review.kinds.find((kind) => kind.kind === value.kind)?.label.toLowerCase() ?? 'kind not chosen'})`
      : value.decision === 'context' ? 'appear together' : 'wrong, not shown';
    lines.push(`Connections: ${tieName(id)}: ${what}`);
  }
  const placeName = (id: string) => review.places.find((place) => place.placeId === id)?.name ?? id;
  for (const [id, value] of Object.entries(draft.places)) {
    if (value.approve) lines.push(`Places: show ${placeName(id)}${value.history ? `, in new words: “${value.history.trim()}”` : ''}`);
  }
  for (const [key, value] of Object.entries(draft.placeTies)) {
    const at = key.lastIndexOf('|');
    const place = review.places.find((item) => item.placeId === key.slice(0, at));
    const person = place?.ties.find((tie) => tie.person.id === key.slice(at + 1))?.person.name ?? key.slice(at + 1);
    lines.push(`Places: ${person} ${value.role} at ${place?.name ?? key.slice(0, at)}`);
  }
  for (const value of Object.values(draft.attract ?? {})) {
    lines.push(value.decision === 'approve'
      ? `Attract screen: approve “${review.attract.headline}”`
      : `Attract screen: new words, “${value.headline}”`);
  }
  for (const [key, value] of Object.entries(draft.filmStarts ?? {})) {
    const name = review.filmStarts.find((entry) => entry.key === key)?.name ?? key;
    lines.push(`Ceremony films: ${name}: ${value.decision === 'start' ? `opens at ${clock(value.seconds)}` : 'from the beginning'}`);
  }
  for (const [id, value] of Object.entries(draft.bios)) {
    const name = review.bios.find((bio) => bio.id === id)?.name ?? id;
    lines.push(`Biographies: ${name}: ${value.useSourceText ? "back to the Hall of Fame's own text" : 'corrected'}`);
  }
  return lines;
}
