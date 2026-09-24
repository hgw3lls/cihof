import { useMemo, useState } from 'react';
import type { Bio, Draft, Review } from './api.ts';
import { Portrait } from './Portrait.tsx';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * Correcting a biography: find the person, change the words, see exactly what
 * changed, and keep it. The institution's own text is never altered; a
 * correction is shown as a curator's text, with the decision beside it.
 */
export function Biographies({ review, draft, update, onDone }: Props) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = review.bios.find((bio) => bio.id === openId) ?? null;

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return review.bios.filter((bio) => words.every((word) => `${bio.name} ${bio.classYear}`.toLowerCase().includes(word)));
  }, [review.bios, query]);

  if (open) {
    return (
      <Editor
        key={open.id}
        bio={open}
        saved={draft.bios[open.id]}
        onKeep={(value) => {
          update((current) => {
            const bios = { ...current.bios };
            if (value) bios[open.id] = value; else delete bios[open.id];
            return { ...current, bios };
          });
          setOpenId(null);
        }}
        onCancel={() => setOpenId(null)}
      />
    );
  }

  return (
    <main className="page">
      <h1>Biographies</h1>
      <p className="lead">Find the person whose biography needs correcting.</p>
      <label className="field">
        <span>Search by name or class year</span>
        <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Grasselli, or 2017" />
      </label>
      <ul className="list">
        {matches.map((bio) => (
          <li key={bio.id}>
            <button type="button" className="list__item" onClick={() => setOpenId(bio.id)}>
              <Portrait src={bio.portrait} name={bio.name} small />
              <span>
                <strong>{bio.name}</strong> <span className="quiet">· Class of {bio.classYear}</span>
                {bio.provenance === 'curated' && <span className="tag">curator's text</span>}
                {draft.bios[bio.id] && <span className="badge">edited, not yet saved</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <nav className="pager"><button type="button" onClick={onDone}>Back to the start</button></nav>
    </main>
  );
}

function Editor({ bio, saved, onKeep, onCancel }: {
  bio: Bio;
  saved: Draft['bios'][string] | undefined;
  onKeep: (value: Draft['bios'][string] | undefined) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(saved?.correctedText ?? bio.text);
  const [note, setNote] = useState(saved?.note ?? '');
  const changed = text.trim() !== bio.text.trim();

  return (
    <main className="page">
      <div className="person person--large">
        <Portrait src={bio.portrait} name={bio.name} />
        <div>
          <h1>{bio.name}</h1>
          <p className="quiet">
            Class of {bio.classYear} ·{' '}
            {bio.provenance === 'curated' ? "this biography is a curator's text" : "this is the Hall of Fame's own text"}
          </p>
        </div>
      </div>

      <label className="field">
        <span>The biography. Change only what is wrong.</span>
        <textarea rows={Math.min(24, Math.max(8, Math.ceil(text.length / 90)))} value={text} onChange={(event) => setText(event.target.value)} />
      </label>

      {changed && (
        <section className="panel">
          <h2 className="question">What you changed</h2>
          <p className="diff"><Diff before={bio.text} after={text} /></p>
          <p className="quiet"><del>Struck through</del> is removed; <ins>underlined</ins> is added.</p>
          <label className="field">
            <span>Why (optional, kept with the decision)</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Birth year corrected from the family's letter" />
          </label>
        </section>
      )}

      <nav className="pager">
        <button type="button" onClick={onCancel}>Cancel</button>
        {saved && <button type="button" onClick={() => onKeep(undefined)}>Undo my correction</button>}
        {bio.provenance === 'curated' && !changed && (
          <button type="button" onClick={() => onKeep({ useSourceText: true, ...(note ? { note } : {}) })}>
            Use the Hall of Fame's own text instead
          </button>
        )}
        <button type="button" className="primary" disabled={!changed || !text.trim()}
          onClick={() => onKeep({ correctedText: text.trim(), ...(note ? { note } : {}) })}>
          Keep this correction
        </button>
      </nav>
      {saved?.useSourceText && <p className="done">✓ Set to go back to the Hall of Fame's own text when you save.</p>}
    </main>
  );
}

/**
 * A word-by-word comparison: what was removed, what was added. Long unchanged
 * stretches are shortened to a few words either side, so a one-word fix in a
 * long biography is easy to find.
 */
function Diff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <>
      {parts.map((part, index) => part.kind === 'same'
        ? <span key={index}>{shorten(part.text, index === 0, index === parts.length - 1)}</span>
        : part.kind === 'removed' ? <del key={index}>{part.text}</del> : <ins key={index}>{part.text}</ins>)}
    </>
  );
}

function shorten(text: string, first: boolean, last: boolean): string {
  const words = text.split(/(\s+)/);
  const keep = 16; // tokens: about eight words
  if (words.length <= keep * 2 + 4) return text;
  const head = first ? '' : words.slice(0, keep).join('');
  const tail = last ? '' : words.slice(-keep).join('');
  return `${head}${first ? '' : ' '}…${last ? '' : ' '}${tail}`;
}

export function diffWords(before: string, after: string): { kind: 'same' | 'removed' | 'added'; text: string }[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  // Longest common subsequence over tokens. Biographies are a few hundred words.
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: { kind: 'same' | 'removed' | 'added'; text: string }[] = [];
  const push = (kind: 'same' | 'removed' | 'added', text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text; else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push('same', a[i]!); i += 1; j += 1; } else if (table[i + 1]![j]! >= table[i]![j + 1]!) { push('removed', a[i]!); i += 1; } else { push('added', b[j]!); j += 1; }
  }
  while (i < a.length) { push('removed', a[i]!); i += 1; }
  while (j < b.length) { push('added', b[j]!); j += 1; }
  return out;
}
