import type { AttractDecision, Draft, Review } from './api.ts';
import { Choice } from './Connections.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * The words on the display's attract screen: the headline and tagline shown
 * while nobody is using it.
 *
 * Until they are approved the display shows the Hall of Fame's name alone, so
 * leaving them is always safe. Approving covers exactly the words shown here;
 * writing new ones approves those as written. They appear on the display only:
 * the website has no attract screen.
 */
export function AttractWords({ review, draft, update, onDone }: Props) {
  const words = review.attract;
  const value = draft.attract?.['attract'];
  const limits = review.limits;
  const set = (next: AttractDecision | undefined) => update((current) => {
    const attract = { ...(current.attract ?? {}) };
    if (next) attract['attract'] = next; else delete attract['attract'];
    return { ...current, attract };
  });
  const problem = value ? wordingProblem(value, limits) : null;

  return (
    <main className="page page--narrow">
      <h1>Words on the attract screen</h1>
      <p className="lead">
        While nobody is using the display, it shows portraits or names with a headline and a short line beneath.
        {words.approved
          ? ' These words are approved and on the display.'
          : ' These words are not approved yet, so the display shows the Hall of Fame’s name instead.'}
      </p>

      <section className="panel attract-preview" aria-label="The words as the display would show them">
        <p className="quiet small">As the display would show them</p>
        {words.headline
          ? (
            <>
              <p className="attract-preview__headline">{words.headline}</p>
              {words.tagline && <p className="attract-preview__tagline">{words.tagline}</p>}
            </>
          )
          : <p className="quiet">No words have been written yet.</p>}
      </section>

      <section className="panel">
        <h2 className="question">Are these the right words?</h2>
        <p className="quiet">They speak for the Hall of Fame to every visitor, so check the facts and the tone as well as the spelling.</p>
        <div className="choices choices--small">
          {words.headline && (
            <Choice selected={value?.decision === 'approve'} onClick={() => set({ decision: 'approve', seenVersion: words.contentVersion })}
              title="Yes, approve them" body="Exactly as shown above." />
          )}
          <Choice selected={value?.decision === 'reword'}
            onClick={() => set({ decision: 'reword', headline: words.headline, tagline: words.tagline, note: value?.note ?? '' })}
            title="Use different words" body="Write your own; they are approved as you write them." />
        </div>

        {value?.decision === 'reword' && (
          <>
            <label className="field">
              <span>Headline <span className="quiet small">({value.headline.length} of {limits.headline} characters)</span></span>
              <input autoFocus value={value.headline} maxLength={limits.headline * 2}
                onChange={(event) => set({ ...value, headline: event.target.value })} />
            </label>
            <label className="field">
              <span>The line beneath <span className="quiet small">({value.tagline.length} of {limits.tagline} characters; may be empty)</span></span>
              <textarea rows={3} value={value.tagline} maxLength={limits.tagline * 2}
                onChange={(event) => set({ ...value, tagline: event.target.value })} />
            </label>
          </>
        )}
        {value && (
          <label className="field">
            <span>A note, if you want one <span className="quiet small">(kept with the decision)</span></span>
            <input value={value.note ?? ''} onChange={(event) => set({ ...value, note: event.target.value })} />
          </label>
        )}
        {value && <p><button type="button" className="link" onClick={() => set(undefined)}>Clear my answer</button></p>}
        {value && (
          <p className={problem ? 'todo' : 'done'} role="status">
            {problem ? `Not finished yet: ${problem}` : '✓ Decided. Kept on this computer until you save.'}
          </p>
        )}
      </section>

      <nav className="pager">
        <button type="button" onClick={onDone}>Back</button>
      </nav>
    </main>
  );
}

/** What stops a decision on the attract words from being saved, or null. */
export function wordingProblem(value: AttractDecision, limits: Review['limits']): string | null {
  if (value.decision === 'approve') return null;
  if (!value.headline.trim()) return 'write a headline.';
  if (value.headline.trim().length > limits.headline) return `the headline is too long for the screen (${limits.headline} characters at most).`;
  if (value.tagline.trim().length > limits.tagline) return `the line beneath is too long for the screen (${limits.tagline} characters at most).`;
  return null;
}
