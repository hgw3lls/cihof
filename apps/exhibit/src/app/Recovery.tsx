import { useEffect } from 'react';
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
 * unreviewed material on the wall.
 */
export function Recovery({ status, onRefresh, onRestore, onClose }: {
  status: ReleaseStatus | null;
  onRefresh: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  useEffect(() => { onRefresh(); }, [onRefresh]);

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
                <button type="button" onClick={onClose}>Close</button>
              </div>
            </>
          )}
      </div>
    </Modal>
  );
}
