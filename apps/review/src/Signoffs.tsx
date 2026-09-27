import type { Draft, Review, Signoff, SignoffDecision } from './api.ts';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * The sign-offs that stand between the exhibit and opening: the logo, the
 * installation checks, the approval to open. The person responsible reads
 * what they confirm and accepts it under their own name; the app records who
 * and when. Nobody accepts for someone else.
 */
export function Signoffs({ review, draft, update, onDone }: Props) {
  const set = (id: string, value: SignoffDecision | undefined) => update((current) => {
    const signoffs = { ...(current.signoffs ?? {}) };
    if (value) signoffs[id] = value; else delete signoffs[id];
    return { ...current, signoffs };
  });
  const signed = review.signoffs.filter((item) => item.signed).length;

  return (
    <main className="page">
      <h1>Sign-offs</h1>
      <p className="lead">
        What people sign off before the exhibit opens. Accept only what is yours to sign, and only once you have checked it
        yourself: the app signs it with your name, {draft.reviewer.trim()}, and today&rsquo;s date. {signed} of {review.signoffs.length} signed.
      </p>
      {review.signoffs.map((item) => (
        <SignoffPanel key={item.id} item={item} review={review} reviewer={draft.reviewer.trim()}
          value={draft.signoffs?.[item.id]} set={(value) => set(item.id, value)} />
      ))}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function SignoffPanel({ item, review, reviewer, value, set }: {
  item: Signoff; review: Review; reviewer: string;
  value: SignoffDecision | undefined; set: (value: SignoffDecision | undefined) => void;
}) {
  const accepting = value?.action === 'accept' ? value : null;
  const clearing = value?.action === 'clear' ? value : null;
  const waitingFor = unsigned(item, review);
  const problem = accepting ? signoffProblem(accepting, item) : clearing && !clearing.note.trim() ? 'Say why the sign-off is cleared.' : null;

  return (
    <article className="panel">
      <h2 className="place__name">{item.title}</h2>
      <p className="quiet">{item.who} · <span className="small">{item.where}</span></p>
      {item.signed
        ? (
          <p className="done">
            ✓ Signed by {item.signed.by} on {item.signed.date}.{item.signed.note ? ` ${item.signed.note}` : ''}
          </p>
        )
        : <p className="quiet">Not signed yet.</p>}

      {!item.signed && item.confirms.length > 0 && (
        <div className="confirms">
          <p className="small">Accepting confirms that:</p>
          <ul>{item.confirms.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}

      {!value && !item.signed && (waitingFor.length > 0
        ? <p className="quiet">Can be accepted once these are signed: {waitingFor.join('; ')}.</p>
        : (
          <div className="row">
            <button type="button" className="primary" disabled={!reviewer}
              onClick={() => set({ action: 'accept', by: reviewer, date: today() })}>
              Accept as {reviewer}
            </button>
          </div>
        ))}

      {!value && item.signed && (
        <div className="row">
          <button type="button" onClick={() => set({ action: 'clear', note: '' })}>Clear this sign-off</button>
        </div>
      )}

      {accepting && (
        <div className="form">
          <p className="done">Accepted by {accepting.by} on {accepting.date}. It is signed when you save.</p>
          <label className="field">
            <span>{item.asks ?? <>Note <span className="quiet small">(optional; for example, measurements, or an exception and who accepted it)</span></>}</span>
            <input value={accepting.note ?? ''} onChange={(event) => set({ ...accepting, note: event.target.value })} />
          </label>
        </div>
      )}

      {clearing && (
        <label className="field">
          <span>Why is the sign-off cleared?</span>
          <input value={clearing.note} onChange={(event) => set({ action: 'clear', note: event.target.value })}
            placeholder="For example: the display was moved, so the installation must be signed again" />
        </label>
      )}

      {problem && <p className="notice" role="alert">{problem}</p>}
      {value && <button type="button" className="link" onClick={() => set(undefined)}>Cancel</button>}
    </article>
  );
}

/** The sign-offs this one waits for that are not yet signed. */
function unsigned(item: Signoff, review: Review): string[] {
  return (item.requires ?? []).flatMap((id) => {
    const required = review.signoffs.find((entry) => entry.id === id);
    return required?.signed ? [] : [required?.title ?? id];
  });
}

/** The same checks signoffs:apply makes, said before the reviewer saves. */
export function signoffProblem(value: Extract<SignoffDecision, { action: 'accept' }>, item: Signoff | undefined): string | null {
  if (!value.by.trim()) return 'Enter your name at the start before accepting.';
  if (value.date > today()) return 'That date is in the future.';
  if (item?.asks && !value.note?.trim()) return 'Answer the question above to save this sign-off.';
  return null;
}

function today(): string {
  const now = new Date();
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
