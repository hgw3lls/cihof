import { useState } from 'react';
import { uploadScan, type Draft, type Review, type Signoff, type SignoffDecision } from './api.ts';

type Props = {
  review: Review;
  draft: Draft;
  update: (change: (current: Draft) => Draft) => void;
  onDone: () => void;
};

/**
 * The sign-offs people give outside this app: the logo, the installation
 * checks, the approval to open. Here a reviewer records a signature that was
 * given, with who signed, when, and where the signed record is kept, or a
 * scan of it. Recording is not signing: the app notes who recorded it.
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
        What people sign before the exhibit opens. Record a signature only once it has been given, on paper or in writing,
        with who signed and where the signed record is kept. {signed} of {review.signoffs.length} recorded.
      </p>
      {review.signoffs.map((item) => (
        <SignoffPanel key={item.id} item={item} value={draft.signoffs?.[item.id]} set={(value) => set(item.id, value)} />
      ))}
      <nav className="pager">
        <span />
        <button type="button" className="primary" onClick={onDone}>Back to the start</button>
      </nav>
    </main>
  );
}

function SignoffPanel({ item, value, set }: { item: Signoff; value: SignoffDecision | undefined; set: (value: SignoffDecision | undefined) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState('');
  const signing = value?.action === 'sign' ? value : null;
  const clearing = value?.action === 'clear' ? value : null;
  const problem = signing ? signoffProblem(signing) : clearing && !clearing.note.trim() ? 'Say why the signature is cleared.' : null;

  const attach = async (file: File | undefined) => {
    if (!file || !signing) return;
    setUploading(true);
    setUploadProblem('');
    try {
      const kept = await uploadScan(file);
      set({ ...signing, scan: kept.file, scanName: kept.name });
    } catch (error) {
      setUploadProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <article className="panel">
      <h2 className="place__name">{item.title}</h2>
      <p className="quiet">{item.who} · <span className="small">{item.where}</span></p>
      {item.signed
        ? (
          <p className="done">
            ✓ Signed by {item.signed.by} on {item.signed.date}. Record: {item.signed.reference}
          </p>
        )
        : <p className="quiet">Not signed yet.</p>}

      {!value && (
        <div className="row">
          {!item.signed && (
            <button type="button" onClick={() => set({ action: 'sign', by: '', date: today(), reference: '' })}>Record a signature</button>
          )}
          {item.signed && (
            <button type="button" onClick={() => set({ action: 'clear', note: '' })}>Clear this signature</button>
          )}
        </div>
      )}

      {signing && (
        <div className="form">
          <label className="field">
            <span>Signed by</span>
            <input value={signing.by} onChange={(event) => set({ ...signing, by: event.target.value })} placeholder="Their full name" />
          </label>
          <label className="field">
            <span>On</span>
            <input type="date" value={signing.date} max={today()} onChange={(event) => set({ ...signing, date: event.target.value })} />
          </label>
          <label className="field">
            <span>Where the signed record is kept <span className="quiet small">(or attach a scan below)</span></span>
            <input value={signing.reference} onChange={(event) => set({ ...signing, reference: event.target.value })}
              placeholder="For example: the signed sheet in the registrar's installation file" />
          </label>
          <label className="field">
            <span>A scan of the signed sheet <span className="quiet small">(PDF, JPEG or PNG; optional)</span></span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={uploading}
              onChange={(event) => void attach(event.target.files?.[0])} />
          </label>
          {uploading && <p className="quiet">Keeping the scan…</p>}
          {signing.scanName && <p className="done">Scan attached: {signing.scanName}</p>}
          {uploadProblem && <p className="notice" role="alert">{uploadProblem}</p>}
          <label className="field">
            <span>Note <span className="quiet small">(optional; for example, exceptions accepted on the sheet)</span></span>
            <input value={signing.note ?? ''} onChange={(event) => set({ ...signing, note: event.target.value })} />
          </label>
        </div>
      )}

      {clearing && (
        <label className="field">
          <span>Why is the signature cleared?</span>
          <input value={clearing.note} onChange={(event) => set({ action: 'clear', note: event.target.value })}
            placeholder="For example: the display was moved, so the installation must be signed again" />
        </label>
      )}

      {problem && <p className="notice" role="alert">{problem}</p>}
      {value && <button type="button" className="link" onClick={() => set(undefined)}>Cancel</button>}
    </article>
  );
}

/** The same checks signoffs:apply makes, said before the reviewer saves. */
export function signoffProblem(value: Extract<SignoffDecision, { action: 'sign' }>): string | null {
  if (!value.by.trim()) return 'Who signed?';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return 'When did they sign?';
  if (value.date > today()) return 'That date is in the future.';
  if (!value.reference.trim() && !value.scan) return 'Say where the signed record is kept, or attach a scan of it.';
  return null;
}

function today(): string {
  const now = new Date();
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
