import { useMemo, useState, type ReactNode } from 'react';
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
    // Undecided ties, and decided ones whose wording cannot go on the map.
    () => review.ties.filter((tie) => showAll || tie.status === 'unreviewed' || tie.wordingProblem),
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

      <TieCard key={tie.tieId} tie={tie} kinds={review.kinds} limit={review.limits.label} value={draft.ties[tie.tieId]} onChange={set} />

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

function TieCard({ tie, kinds, limit, value, onChange }: {
  tie: Tie;
  kinds: Kind[];
  limit: number;
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

  const complete = isComplete(value, kinds, limit);
  const kindName = (name: string) => kinds.find((item) => item.kind === name)?.label ?? name;
  const decisionName = (decision: string, name: string) => decision === 'relationship'
    ? `a connection: ${kindName(name).toLowerCase()}` : decision === 'context' ? 'they appear together' : 'wrong, not shown';
  const useSuggestion = () => {
    const suggested = tie.suggestion!;
    onChange({
      decision: suggested.decision,
      ...(suggested.decision === 'relationship' ? { kind: suggested.kind ?? '', direction: suggested.direction ?? 'a-to-b', inverseLabel: suggested.inverseLabel ?? '' } : {}),
      label: suggested.label ?? '',
    });
  };

  return (
    <article className="panel">
      {tie.current && (
        <div className="notice">
          <p><strong>Decided now:</strong> {decisionName(tie.current.decision, tie.current.kind)}. A new decision here replaces it.</p>
          {tie.current.label && <p className="quiet small">Wording on file: “{tie.current.label}”</p>}
          {tie.wordingProblem && <p className="problem small">This wording cannot go on the map: {tie.wordingProblem}.</p>}
        </div>
      )}
      {tie.suggestion && (
        <div className="suggestion">
          <p>
            <strong>Suggested:</strong> {decisionName(tie.suggestion.decision, tie.suggestion.kind ?? '')}
            {tie.suggestion.label && <> · “{tie.suggestion.label}”</>}
          </p>
          {tie.suggestion.because && <p className="small">Why: {tie.suggestion.because}</p>}
          <p className="quiet small">Drafted by the developer's AI assistant from the evidence below. Check it against the evidence; you decide.</p>
          <button type="button" onClick={useSuggestion}>Use this suggestion</button>
        </div>
      )}

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
              <p className="quiet">
                A short phrase, shown under a portrait on the Connections map. Say only what the record says.
                {!kind.directional && ' The same words show next to both of them, so name neither.'}
              </p>
              <Wording
                caption={kind.directional ? <>Next to {first.name}: <em>{first.name} …</em></> : <>Next to both of them</>}
                value={value?.label ?? ''} placeholder={fill(kind.example)} limit={limit}
                onChange={(text) => patch({ label: text })} />
              {kind.directional && (
                <Wording
                  caption={<>Next to {second.name}: <em>{second.name} …</em></>}
                  value={value?.inverseLabel ?? ''} placeholder={fill(kind.inverse)} limit={limit}
                  onChange={(text) => patch({ inverseLabel: text })} />
              )}
            </section>
          )}
        </>
      )}

      {choice === 'context' && (
        <section>
          <h2 className="question">2. What does the record show them doing together?</h2>
          <Wording caption={<>Shown between the two of them</>} value={value?.label ?? ''} limit={limit}
            placeholder="pictured together at their induction" onChange={(text) => patch({ label: text })} />
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

function Wording({ caption, value, placeholder, limit, onChange }: {
  caption: ReactNode;
  value: string;
  placeholder: string;
  limit: number;
  onChange: (text: string) => void;
}) {
  const length = value.trim().length;
  return (
    <label className="field">
      <span>{caption}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <span className={length > limit ? 'problem small' : 'quiet small'}>
        {length} of {limit} characters{length > limit ? ': too long for the map, shorten it' : ''}
      </span>
    </label>
  );
}

/** Mirrors what ties:apply will refuse, so the reviewer hears it here first. */
export function isComplete(value: TieDecision | undefined, kinds: Kind[], limit = Infinity): boolean {
  if (!value) return false;
  if (value.decision === 'reject') return true;
  if (!value.label?.trim()) return false;
  if (value.label.trim().length > limit || (value.inverseLabel ?? '').trim().length > limit) return false;
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
