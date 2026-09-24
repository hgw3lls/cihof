import { useMemo, useState } from 'react';
import type { Draft, Kind, Review, Tie, TieDecision } from './api.ts';
import { Portrait } from './Portrait.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * The proposed ties, one at a time.
 *
 * The question is always the same: what does this record show? The answer
 * opens only the next question it needs, so a reviewer never faces a form.
 */
export function Connections({ review, draft, update, onDone }: Props) {
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(
    () => review.ties.filter((tie) => showAll || tie.status === 'unreviewed'),
    [review.ties, showAll],
  );
  const firstOpen = list.findIndex((tie) => !draft.ties[tie.tieId]);
  const [index, setIndex] = useState(Math.max(firstOpen, 0));
  const tie = list[Math.min(index, list.length - 1)];
  const decided = list.filter((item) => draft.ties[item.tieId]).length;

  const set = (value: TieDecision | undefined) => update((current) => {
    const ties = { ...current.ties };
    if (value) ties[tie!.tieId] = value; else delete ties[tie!.tieId];
    return { ...current, ties };
  });

  if (!tie) {
    return (
      <main className="page page--narrow">
        <h1>Connections</h1>
        <p className="lead">Every proposed connection has been reviewed.</p>
        <button type="button" onClick={() => setShowAll(true)}>Look at the ones already decided</button>{' '}
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="steps">
        <h1>Connections</h1>
        <p className="quiet">
          {index + 1} of {list.length} · {decided} decided so far ·{' '}
          <label className="inline">
            <input type="checkbox" checked={showAll} onChange={(event) => { setShowAll(event.target.checked); setIndex(0); }} />
            include ones already decided
          </label>
        </p>
      </div>

      <TieCard key={tie.tieId} tie={tie} kinds={review.kinds} value={draft.ties[tie.tieId]} onChange={set} />

      <nav className="pager">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Previous</button>
        <button type="button" onClick={onDone}>Stop for now</button>
        {index < list.length - 1
          ? <button type="button" className="primary" onClick={() => setIndex(index + 1)}>{draft.ties[tie.tieId] ? 'Next →' : 'Skip for now →'}</button>
          : <button type="button" className="primary" onClick={onDone}>Finish</button>}
      </nav>
    </main>
  );
}

function TieCard({ tie, kinds, value, onChange }: {
  tie: Tie;
  kinds: Kind[];
  value: TieDecision | undefined;
  onChange: (value: TieDecision | undefined) => void;
}) {
  const choice = value?.decision;
  const kind = kinds.find((item) => item.kind === value?.kind);
  const reversed = value?.direction === 'b-to-a';
  const [first, second] = reversed ? [tie.b, tie.a] : [tie.a, tie.b];
  const fill = (text: string | undefined) => (text ?? '').replaceAll('{A}', first.name).replaceAll('{B}', second.name);

  const choose = (decision: TieDecision['decision']) => onChange(
    decision === 'relationship'
      ? { decision, kind: value?.kind ?? tie.suggestedKind ?? '', direction: value?.direction ?? 'a-to-b', label: '', inverseLabel: '' }
      : { decision, label: '', ...(value?.note ? { note: value.note } : {}) },
  );
  const patch = (change: Partial<TieDecision>) => onChange({ ...(value as TieDecision), ...change });

  const complete = isComplete(value, kinds);

  return (
    <article className="panel">
      {tie.status !== 'unreviewed' && <p className="notice">Already decided: <strong>{tie.status}</strong>. A new decision here replaces it.</p>}

      <div className="pair">
        <PersonCard person={tie.a} />
        <span className="pair__and" aria-hidden="true">&amp;</span>
        <PersonCard person={tie.b} />
      </div>

      <section>
        <h2 className="question">What the research found</h2>
        {tie.evidence.map((text, index) => (
          <blockquote key={index} className="evidence">
            {text}
            {tie.sourceUrls[index] && (
              <a href={tie.sourceUrls[index]} target="_blank" rel="noreferrer" className="evidence__source">Open the source</a>
            )}
          </blockquote>
        ))}
        <p className="quiet">From the HOF World research ({tie.verificationLayer.replaceAll('-', ' ')}).</p>
      </section>

      <section>
        <h2 className="question">1. What does this record show?</h2>
        <div className="choices">
          <Choice selected={choice === 'relationship'} onClick={() => choose('relationship')}
            title="A real connection" body="The record says their lives or work touched: they worked together, were family, one mentored the other." />
          <Choice selected={choice === 'context'} onClick={() => choose('context')}
            title="They appear together, nothing more" body="Named in the same caption, on the same stage, in the same session. Shown as a quieter link that claims nothing." />
          <Choice selected={choice === 'reject'} onClick={() => choose('reject')}
            title="This is wrong" body="The record does not support it, or it is about someone else. It will not be shown or proposed again." />
        </div>
        {value && <button type="button" className="link" onClick={() => onChange(undefined)}>Clear my answer</button>}
      </section>

      {choice === 'relationship' && (
        <>
          <section>
            <h2 className="question">2. What kind of connection?</h2>
            <div className="choices choices--small">
              {kinds.map((item) => (
                <Choice key={item.kind} selected={value?.kind === item.kind} onClick={() => patch({ kind: item.kind })}
                  title={item.label}
                  body={item.kind === tie.suggestedKind ? 'The research suggests this one.' : ''} />
              ))}
            </div>
          </section>

          {kind?.directional && (
            <section>
              <h2 className="question">3. Which way round?</h2>
              <div className="choices choices--small">
                <Choice selected={!reversed} onClick={() => patch({ direction: 'a-to-b' })}
                  title={sentence(kind, tie.a.name, tie.b.name)} body="" />
                <Choice selected={reversed} onClick={() => patch({ direction: 'b-to-a' })}
                  title={sentence(kind, tie.b.name, tie.a.name)} body="" />
              </div>
            </section>
          )}

          {kind && (
            <section>
              <h2 className="question">{kind.directional ? '4.' : '3.'} How should it read?</h2>
              <p className="quiet">Say only what the record says. This is what visitors will read.</p>
              <label className="field">
                <span>On {first.name}'s profile: <em>{first.name} …</em></span>
                <input value={value?.label ?? ''} placeholder={fill(kind.example)} onChange={(event) => patch({ label: event.target.value })} />
              </label>
              {kind.directional && (
                <label className="field">
                  <span>On {second.name}'s profile: <em>{second.name} …</em></span>
                  <input value={value?.inverseLabel ?? ''} placeholder={fill(kind.inverse)}
                    onChange={(event) => patch({ inverseLabel: event.target.value })} />
                </label>
              )}
            </section>
          )}
        </>
      )}

      {choice === 'context' && (
        <section>
          <h2 className="question">2. What does the record show them doing together?</h2>
          <label className="field">
            <span>Shown between the two of them</span>
            <input value={value?.label ?? ''} placeholder="Both photographed at the 2017 induction ceremony"
              onChange={(event) => patch({ label: event.target.value })} />
          </label>
        </section>
      )}

      {choice && (
        <label className="field">
          <span>A note for the record (optional)</span>
          <input value={value?.note ?? ''} placeholder={choice === 'reject' ? 'Why it is wrong' : 'Anything worth keeping'}
            onChange={(event) => patch({ note: event.target.value })} />
        </label>
      )}

      {value && (
        <p className={complete ? 'done' : 'todo'} role="status">
          {complete ? '✓ Decided. Kept on this computer until you save.' : 'Not finished yet: fill in the questions above.'}
        </p>
      )}
    </article>
  );
}

function sentence(kind: Kind, from: string, to: string): string {
  return (kind.sentence ?? `{A} ${kind.label.toLowerCase()} {B}`).replaceAll('{A}', from).replaceAll('{B}', to);
}

/** Mirrors what ties:apply will refuse, so the reviewer hears it here first. */
export function isComplete(value: TieDecision | undefined, kinds: Kind[]): boolean {
  if (!value) return false;
  if (value.decision === 'reject') return true;
  if (!value.label?.trim()) return false;
  if (value.decision === 'context') return true;
  const kind = kinds.find((item) => item.kind === value.kind);
  if (!kind) return false;
  return !kind.directional || Boolean(value.inverseLabel?.trim());
}

function PersonCard({ person }: { person: Tie['a'] }) {
  return (
    <div className="person">
      <Portrait src={person.portrait} name={person.name} />
      <div>
        <strong>{person.name}</strong>
        {person.classYear && <span className="quiet"> · Class of {person.classYear}</span>}
        <details>
          <summary>Their biography</summary>
          <p>{person.biography}{person.biography.length >= 600 ? '…' : ''}</p>
        </details>
      </div>
    </div>
  );
}

export function Choice({ selected, onClick, title, body }: { selected: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button type="button" className="choice" aria-pressed={selected} onClick={onClick}>
      <strong>{title}</strong>
      {body && <span>{body}</span>}
    </button>
  );
}
