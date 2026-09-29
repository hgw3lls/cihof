import { useEffect, useState } from 'react';
import type { ReleaseStatus } from './useRelease.ts';
import { Modal } from './Modal.tsx';

/**
 * What an operator needs when a display is wrong and nobody can debug it.
 *
 * Four questions, answered plainly: which release is this, is it completely
 * provisioned, what is missing, and can I go back. The fifth thing — recording
 * what happened — is why the panel states the outcome of a rollback rather
 * than silently succeeding.
 *
 * Not a general admin surface. It reads state and can return to the previous
 * release; it cannot change content, and there is nothing here that could put
 * unreviewed material on the wall. The one other thing it does is clear the
 * threads visitors saved on this display, which any visitor can add to and
 * edit: staff can start the display's list afresh, after asking twice.
 */
export function Recovery({ status, threads, onRefresh, onRestore, onClearThreads, onClose }: {
  status: ReleaseStatus | null;
  /** How many threads visitors have saved on this display. */
  threads: number;
  onRefresh: () => void;
  onRestore: () => void;
  onClearThreads: () => void;
  onClose: () => void;
}) {
  useEffect(() => { onRefresh(); }, [onRefresh]);
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState<number | null>(null);

  const missing = status?.provisioning?.missing ?? [];
  const complete = status !== null && missing.length === 0;

  return (
    <Modal className="recovery" labelledBy="recoveryTitle" onClose={onClose}>
      <div className="recovery__panel">
        <h2 id="recoveryTitle" data-autofocus tabIndex={-1}>Release and recovery</h2>

        {!status
          ? <p>No offline worker is running on this display, so there is nothing to report or restore.</p>
          : (
            <>
              <dl className="recovery__facts">
                <dt>Serving</dt><dd><code>{status.serving}</code></dd>
                <dt>Worker</dt><dd><code>{status.worker}</code></dd>
                <dt>Previous</dt><dd>{status.previous ? <code>{status.previous}</code> : 'none held'}</dd>
                <dt>Releases held</dt><dd>{status.releasesHeld.length}</dd>
                <dt>Provisioning</dt>
                <dd>{complete
                  ? `complete, ${status.provisioning?.expected ?? 0} assets`
                  : `${missing.length} of ${status.provisioning?.expected ?? '?'} assets unusable`}</dd>
              </dl>

              {status.rolledBackFrom && (
                <p className="recovery__outcome" role="status">
                  Restored to <code>{status.serving}</code> from <code>{status.rolledBackFrom}</code>.
                  Record this before leaving the display.
                </p>
              )}

              {missing.length > 0 && (
                <div className="recovery__missing">
                  <h3>Unusable assets</h3>
                  <ul>
                    {missing.slice(0, 12).map((asset) => (
                      <li key={asset.path}><code>{asset.path}</code> — {asset.reason}</li>
                    ))}
                  </ul>
                  {missing.length > 12 && <p>and {missing.length - 12} more.</p>}
                </div>
              )}

              <div className="recovery__actions">
                <button type="button" onClick={onRefresh}>Re-check</button>
                <button type="button" disabled={!status.previous} onClick={onRestore}>
                  {status.previous ? 'Restore previous release' : 'No previous release to restore'}
                </button>
              </div>
            </>
          )}

        <section className="recovery__threads" aria-labelledby="threadsHeading">
          <h3 id="threadsHeading">Saved threads</h3>
          <p>
            {threads === 0
              ? 'No threads are saved on this display.'
              : `${threads} ${threads === 1 ? 'thread is' : 'threads are'} saved on this display, offered to visitors under Tour.`}
          </p>
          {cleared !== null && (
            <p className="recovery__outcome" role="status">
              Cleared {cleared} saved {cleared === 1 ? 'thread' : 'threads'}.
            </p>
          )}
          <div className="recovery__actions">
            {confirming
              ? (
                <>
                  <button
                    type="button"
                    className="recovery__danger"
                    onClick={() => { setCleared(threads); setConfirming(false); onClearThreads(); }}
                  >
                    Yes, clear all {threads}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)}>Keep them</button>
                </>
              )
              : (
                <button type="button" disabled={threads === 0} onClick={() => { setCleared(null); setConfirming(true); }}>
                  Clear all saved threads
                </button>
              )}
          </div>
          {confirming && <p className="recovery__warning">They are gone for good once cleared. Curated tours are not affected.</p>}
        </section>

        <div className="recovery__actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
