import { useEffect, useState } from 'react';
import { applyOnDisplay, connectDisplay, disconnectDisplay, displayLink, openFromDisplay, sendToDisplay, type DisplayLink, type DisplayUpdate, type PortalState, type SentUpdate } from './api.ts';

/**
 * The display over the museum's network, when its admin panel has a staff
 * connection open: connect with the address and code it shows, start from
 * what it shows now, and send it display updates made here. The display
 * checks an update exactly as one loaded from a stick, and says what it would
 * change, before anybody chooses to apply it.
 */
export function DisplayConnection({ portal, onOpened }: { portal: PortalState; onOpened: () => Promise<void> }) {
  const [link, setLink] = useState<DisplayLink | null>(null);
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void displayLink().then(setLink).catch(() => setLink({ connected: false })); }, []);

  const connect = async () => {
    setBusy('Connecting…'); setProblem(null); setMessage(null);
    try {
      const next = await connectDisplay(address, code);
      setLink(next);
      if (!next.connected) setProblem(next.problem ?? 'It did not connect.');
    } finally { setBusy(null); }
  };
  const startFromDisplay = async (replace = false) => {
    setBusy('Fetching what the display shows… this can take a few minutes.'); setProblem(null); setMessage(null);
    try {
      const outcome = await openFromDisplay(replace);
      if (outcome.ok) { setMessage('Opened what the display shows now. Make your changes from here.'); await onOpened(); return; }
      if (outcome.unsaved && window.confirm(`${outcome.problem}\n\nOpen what the display shows anyway? Your saved changes that are not in a display update will be replaced.`)) {
        await startFromDisplay(true);
        return;
      }
      setProblem(outcome.problem ?? 'It could not be opened.');
    } finally { setBusy(null); }
  };

  if (!link) return null;
  if (!link.connected) {
    return (
      <section className="panel">
        <h2 className="question">Connect to the display</h2>
        <p className="quiet">
          On the display, open the admin panel, then <strong>Staff connection</strong>, and <strong>Open a staff connection</strong>.
          Type the address and the code it shows. Or carry updates on a USB stick, as before.
        </p>
        {link.problem && <p className="notice">{link.problem}</p>}
        <div className="field-row">
          <label className="field field--inline"><span>Address</span><input value={address} placeholder="192.168.1.40:5190" onChange={(event) => setAddress(event.target.value)} /></label>
          <label className="field field--inline"><span>Code</span><input value={code} placeholder="K7RM-4QXP" autoComplete="off" onChange={(event) => setCode(event.target.value)} /></label>
        </div>
        {problem && <p className="problem" role="alert">{problem}</p>}
        {busy && <p className="quiet" role="status">{busy}</p>}
        <button type="button" disabled={Boolean(busy) || !address.trim() || !code.trim()} onClick={() => void connect()}>Connect</button>
      </section>
    );
  }

  const showing = link.state.content.active;
  const ours = portal.lastUpdate?.contentVersion ?? portal.opened?.contentVersion;
  return (
    <section className="panel">
      <h2 className="question">Connected to {link.name}</h2>
      <p className="quiet">
        At {link.address}.{' '}
        {showing === ours
          ? (portal.lastUpdate ? 'It shows your last display update.' : 'It shows what you opened here.')
          : 'It shows something other than what you are working from: start from what it shows now, so nobody\'s changes are lost.'}
      </p>
      {message && <p className="done" role="status">{message}</p>}
      {problem && <p className="problem" role="alert">{problem}</p>}
      {busy && <p className="quiet" role="status">{busy}</p>}
      <p className="actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" disabled={Boolean(busy)} onClick={() => void startFromDisplay()}>Start from what it shows now</button>
        <button type="button" className="link" disabled={Boolean(busy)} onClick={() => void disconnectDisplay().then(setLink)}>Disconnect</button>
      </p>
    </section>
  );
}

/** Sends one display update over the connection, shows what the display says about it, and applies it when asked. */
export function SendToDisplay({ update }: { update: DisplayUpdate }) {
  const [connected, setConnected] = useState(false);
  const [sent, setSent] = useState<SentUpdate | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [anyway, setAnyway] = useState(false);
  useEffect(() => { void displayLink().then((link) => setConnected(link.connected)).catch(() => setConnected(false)); }, []);
  if (!connected || done) return done ? <p className="done" role="status">{done}</p> : null;

  const send = async () => {
    setBusy('Sending it to the display…'); setProblem(null);
    try {
      const outcome = await sendToDisplay(update.file);
      setSent(outcome);
      if (!outcome.ok) setProblem(outcome.problem);
    } finally { setBusy(null); }
  };
  const apply = async (now: boolean) => {
    if (!sent?.ok) return;
    setBusy('Applying it on the display…'); setProblem(null);
    try {
      const outcome = await applyOnDisplay(sent.id, now, anyway);
      if (outcome.ok) setDone(now ? '✓ Applied. The display is showing it now.' : '✓ Applied. The display takes it over at its next reset between visitors.');
      else setProblem(outcome.problem ?? 'It was not applied.');
    } finally { setBusy(null); }
  };

  return (
    <div className="send">
      {!sent?.ok && <button type="button" className="primary" disabled={Boolean(busy)} onClick={() => void send()}>Send it to the display</button>}
      {sent?.ok && (
        sent.problems.length > 0
          ? <p className="problem">The display will not take it: {sent.problems.join(' ')}</p>
          : (
            <>
              <p>The display checked it{sent.changes?.newFilms ? `; it brings ${sent.changes.newFilms} film${sent.changes.newFilms === 1 ? '' : 's'}` : ''}.</p>
              {sent.stale && (
                <>
                  <p className="notice">{sent.stale}</p>
                  <label className="check">
                    <input type="checkbox" checked={anyway} onChange={(event) => setAnyway(event.target.checked)} />
                    <span>Apply it anyway, replacing what changed on the display since.</span>
                  </label>
                </>
              )}
              <p className="actions" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="primary" disabled={Boolean(busy) || (Boolean(sent.stale) && !anyway)} onClick={() => void apply(false)}>Apply at the next reset</button>
                <button type="button" disabled={Boolean(busy) || (Boolean(sent.stale) && !anyway)}
                  onClick={() => { if (window.confirm('Show it now? Only if nobody is using the display: whoever is will be taken back to the start.')) void apply(true); }}>
                  Apply and show now
                </button>
              </p>
            </>
          )
      )}
      {busy && <p className="quiet" role="status">{busy}</p>}
      {problem && <p className="problem" role="alert">{problem}</p>}
    </div>
  );
}
