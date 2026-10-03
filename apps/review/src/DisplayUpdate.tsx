import { useState } from 'react';
import { canShowFiles, makeDisplayUpdate, showUpdateFile, type DisplayUpdate, type PortalState } from './api.ts';

type Props = {
  portal: PortalState;
  waiting: number;
  onBack: () => void;
  onSave: () => void;
  onMade: () => Promise<void>;
};

/**
 * The staff portal's last step: the changes saved here, made into one file
 * the display loads. It holds the display's whole new content, made from this
 * copy exactly as the exhibit is built, and carries only what the display
 * does not already have.
 */
export function DisplayUpdateScreen({ portal, waiting, onBack, onSave, onMade }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; output?: string | undefined } | null>(null);
  const [made, setMade] = useState<DisplayUpdate | null>(null);

  const make = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const outcome = await makeDisplayUpdate(note);
      if (outcome.ok) {
        setMade(outcome);
        setNote('');
        await onMade();
      } else {
        setProblem({ text: outcome.problem, output: outcome.output });
      }
    } catch (reason) {
      setProblem({ text: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setBusy(false);
    }
  };

  if (made) {
    return (
      <main className="page page--narrow">
        <h1>Display update made</h1>
        <p className="panel"><code className="export-file">{made.file}</code></p>
        {canShowFiles() && <p><button type="button" onClick={() => showUpdateFile(made.file)}>Show the file</button></p>}
        <h2 className="question">To show it on the display</h2>
        <ol className="how-to">
          <li>Copy the file to a USB stick, or anywhere the display can reach.</li>
          <li>On the display, open the admin panel, then Content, then <strong>Load a content update…</strong>, and choose the file.</li>
          <li>Read what it says it changes, then choose <strong>Apply and show now</strong>, or <strong>Apply at the next reset</strong>.</li>
        </ol>
        <p className="quiet">The display keeps its earlier content, so it can always go back. Keep making changes here: the next update follows this one.</p>
        <button type="button" className="primary" onClick={onBack}>Back to the start</button>
      </main>
    );
  }

  const opened = portal.opened;
  return (
    <main className="page page--narrow">
      <h1>Display update</h1>
      {opened && (
        <p className="lead">
          Working on the content exported from the display{opened.exportedAt ? ` on ${day(opened.exportedAt)}` : ''} ({opened.file}).
          {portal.lastUpdate ? ` The last display update was made on ${day(portal.lastUpdate.at)} by ${portal.lastUpdate.by}.` : ''}
        </p>
      )}

      <section className="panel">
        <h2 className="question">Saved since the last display update</h2>
        {portal.pending.length === 0
          ? <p className="quiet">Nothing yet. Make changes, check and save them, and they are listed here.</p>
          : <ul className="summary">{portal.pending.map((change) => <li key={change.at + change.task}>{changeLine(change)}</li>)}</ul>}
      </section>

      {waiting > 0 && (
        <p className="notice">
          {waiting} decision{waiting === 1 ? ' is' : 's are'} not saved yet, so {waiting === 1 ? 'it is' : 'they are'} not part of an update.{' '}
          <button type="button" className="link" onClick={onSave}>Check and save {waiting === 1 ? 'it' : 'them'} first</button>.
        </p>
      )}

      <section className="panel">
        <label className="field">
          <span className="question">What changed, in a line or two (optional)</span>
          <textarea rows={3} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)}
            placeholder="For whoever loads it on the display, e.g. Corrected two biographies and added the new tour." />
        </label>
        <p className="quiet">The display lists this, and each kind of change saved, with who made it.</p>
      </section>

      {problem && (
        <div className="problem" role="alert">
          <p>{problem.text}</p>
          {problem.output && <details><summary>Details</summary><pre className="output">{problem.output}</pre></details>}
        </div>
      )}
      {busy && <p className="quiet" role="status">Making the update… this can take a minute.</p>}

      <nav className="pager">
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" className="primary" disabled={busy || portal.pending.length === 0} onClick={() => void make()}>
          Make a display update
        </button>
      </nav>

      {portal.updates.length > 0 && (
        <section className="panel">
          <h2 className="question">Display updates made here</h2>
          <ul className="summary">
            {[...portal.updates].reverse().map((update) => (
              <li key={update.contentVersion + update.at}>
                {day(update.at)}, by {update.by}: {update.summary.join(' ')}
                {canShowFiles() && <> <button type="button" className="link" onClick={() => showUpdateFile(update.file)}>Show the file</button></>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function changeLine(change: { at: string; by: string; title: string; count: number }) {
  return `${change.title}: ${change.count} decision${change.count === 1 ? '' : 's'}, saved by ${change.by} on ${day(change.at)}`;
}

function day(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
