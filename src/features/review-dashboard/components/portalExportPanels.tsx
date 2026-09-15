import type {
  ChangeEvent,
  MutableRefObject,
} from 'react';
import type { Inductee } from '../../../data/types';
import type { DraftMap } from '../services/portalDrafts';
import type {
  RunnerJob,
  RunnerScript,
  RunnerState,
} from '../services/portalRunner';
import type { ReportState } from '../services/portalReports';
import type { DraftIssue } from '../models/portalReviewModel';
import {
  MetricCard,
  formatAheadBehind,
  formatGitCommit,
  formatRepoPath,
  formatRunnerJobSummary,
  statusLabel,
} from './portalUi';

export function ExportPanel({
  draftCount,
  relationshipDraftCount,
  sourceLeadCount,
  editedRows,
  reports,
  runner,
  drafts,
  draftIssues,
  applyPreviewJob,
  applyPreviewFresh,
  importInputRef,
  onClearDrafts,
  onExportCurationPackage,
  onExportDraftJson,
  onExportDecisionCsv,
  onExportVisibleCsv,
  onImportDraftJson,
  onRunScript,
  onApplyDrafts,
}: {
  draftCount: number;
  relationshipDraftCount: number;
  sourceLeadCount: number;
  editedRows: Inductee[];
  reports: ReportState;
  runner: RunnerState;
  drafts: DraftMap;
  draftIssues: DraftIssue[];
  applyPreviewJob: RunnerJob | null;
  applyPreviewFresh: boolean;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
  onClearDrafts: () => void;
  onExportCurationPackage: () => void;
  onExportDraftJson: () => void;
  onExportDecisionCsv: () => void;
  onExportVisibleCsv: () => void;
  onImportDraftJson: (event: ChangeEvent<HTMLInputElement>) => void;
  onRunScript: (script: RunnerScript) => void;
  onApplyDrafts: (dryRun: boolean) => void;
}) {
  return (
    <section className="portal-exports" aria-label="Decision exports">
      <div className="portal-readiness__intro">
        <p className="eyebrow">Exports</p>
        <h3>Move portal decisions into the repo</h3>
        <p>Export the edited decision CSV, apply it with the existing scripts, regenerate data, and rebuild the kiosk.</p>
      </div>

      <div className="portal-export-actions">
        <button disabled={!runner.available || draftCount === 0 || runner.activeJob?.status === 'running'} type="button" onClick={() => onApplyDrafts(true)}>1. Dry Run Portal Edits</button>
        <button disabled={!runner.available || draftCount === 0 || !applyPreviewFresh || draftIssues.some((issue) => issue.severity === 'error') || runner.activeJob?.status === 'running'} type="button" onClick={() => onApplyDrafts(false)}>2. Apply Validated Edits</button>
        <button disabled={draftCount === 0 && relationshipDraftCount === 0} type="button" onClick={onExportCurationPackage}>Export Curation Package</button>
        <button disabled={draftCount === 0} type="button" onClick={onExportDecisionCsv}>Export Edited Decisions CSV</button>
        <button disabled={draftCount === 0} type="button" onClick={onExportDraftJson}>Export Draft JSON</button>
        <button type="button" onClick={onExportVisibleCsv}>Export Current Queue CSV</button>
        <button type="button" onClick={() => importInputRef.current?.click()}>Import Draft / Package JSON</button>
        <button disabled={draftCount === 0} type="button" onClick={onClearDrafts}>Clear Local Drafts</button>
      </div>
      <input ref={importInputRef} className="portal-file-input" accept="application/json,.json" type="file" onChange={onImportDraftJson} />

      <div className="portal-export-summary">
        <MetricCard label="Edited Records" value={editedRows.length} detail={`${draftCount} browser draft entries`} />
        <MetricCard label="Relationship Drafts" value={relationshipDraftCount} detail="local relationship review decisions" />
        <MetricCard label="Source Leads" value={sourceLeadCount} detail="original-site review aids" />
        <MetricCard label="Draft Warnings" value={draftIssues.length} detail={`${draftIssues.filter((issue) => issue.severity === 'error').length} blocking issues`} />
        <MetricCard label="Curation Errors" value={reports.curation?.validation?.errors?.length ?? 0} detail={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} />
        <MetricCard label="Media Errors" value={reports.media?.validation?.errors?.length ?? 0} detail={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} />
      </div>

      <ApplyPreviewPanel
        draftCount={draftCount}
        blockingIssueCount={draftIssues.filter((issue) => issue.severity === 'error').length}
        previewFresh={applyPreviewFresh}
        previewJob={applyPreviewJob}
      />

      <PortalRunnerPanel runner={runner} onRunScript={onRunScript} />

      {draftIssues.length > 0 && (
        <div className="portal-validation portal-validation--exports" aria-label="Draft export warnings">
          <strong>Review before applying</strong>
          {draftIssues.slice(0, 12).map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={`${issue.id}-${issue.message}`}>
              {issue.name}: {issue.message}
            </span>
          ))}
          {draftIssues.length > 12 && <span className="portal-validation__more">+{draftIssues.length - 12} more issues</span>}
        </div>
      )}

      <div className="portal-command-box">
        <strong>Runner apply sequence</strong>
        <code>1. Dry Run Portal Edits</code>
        <code>2. Review Apply Gate summary and runner job output</code>
        <code>3. Apply Validated Edits: apply, prepare data, validate reports/entities, build public app</code>
        <code>Export Curation Package when handing off a browser review session</code>
      </div>

      <div className="portal-draft-list">
        {editedRows.map((inductee) => (
          <div key={inductee.id}>
            <strong>{inductee.name}</strong>
            <span>{Object.keys(drafts[inductee.id] ?? {}).filter((key) => key !== 'id' && key !== 'updatedAt').length} edited fields</span>
          </div>
        ))}
        {editedRows.length === 0 && <div className="portal-empty-state">No local edits yet.</div>}
      </div>
    </section>
  );
}

function ApplyPreviewPanel({
  draftCount,
  blockingIssueCount,
  previewFresh,
  previewJob,
}: {
  draftCount: number;
  blockingIssueCount: number;
  previewFresh: boolean;
  previewJob: RunnerJob | null;
}) {
  const summary = previewJob?.meta?.applySummary;
  const dryRunResults = summary?.dryRunResults ?? [];
  const recordsChanged = dryRunResults.reduce((sum, result) => sum + (result.recordsChanged ?? 0), 0);

  return (
    <section className={previewFresh ? 'portal-apply-preview portal-apply-preview--ready' : 'portal-apply-preview'} aria-label="Portal apply preview">
      <div className="portal-apply-preview__header">
        <div>
          <p className="eyebrow">Apply Gate</p>
          <h4>{previewFresh ? 'Dry run complete for current edits' : 'Dry run required before apply'}</h4>
          <span>
            {draftCount === 0
              ? 'Create or import draft edits before applying.'
              : previewJob
                ? `Preview job ${previewJob.status}${previewJob.logPath ? ` / ${previewJob.logPath}` : ''}`
                : 'Run the dry run to generate a reviewable impact summary.'}
          </span>
        </div>
        <strong>{previewFresh ? 'READY' : 'LOCKED'}</strong>
      </div>

      <div className="portal-apply-preview__grid">
        <div>
          <span>Rows</span>
          <strong>{summary?.targetRows ?? draftCount}</strong>
        </div>
        <div>
          <span>Curation Inputs</span>
          <strong>{summary?.curationFieldInputs ?? 0}</strong>
        </div>
        <div>
          <span>Media Inputs</span>
          <strong>{summary?.mediaFieldInputs ?? 0}</strong>
        </div>
        <div>
          <span>Would Change</span>
          <strong>{recordsChanged || 'Run dry run'}</strong>
        </div>
        <div>
          <span>Blocking Issues</span>
          <strong>{blockingIssueCount}</strong>
        </div>
        <div>
          <span>Targets</span>
          <strong>{summary?.targets?.join(' + ') || 'curation + media'}</strong>
        </div>
      </div>

      {dryRunResults.length > 0 && (
        <div className="portal-apply-preview__results">
          {dryRunResults.map((result) => (
            <div key={result.label}>
              <strong>{result.label}</strong>
              <span>{result.recordsChanged ?? 0} records / {result.rowsRead ?? 0} rows / {result.status}</span>
              {(result.errors ?? 0) > 0 && <em>{result.errors} errors</em>}
              {(result.warnings ?? 0) > 0 && <em>{result.warnings} warnings</em>}
            </div>
          ))}
        </div>
      )}

      {summary?.affectedRecords && summary.affectedRecords.length > 0 && (
        <div className="portal-apply-preview__records" aria-label="Affected records preview">
          {summary.affectedRecords.slice(0, 10).map((record) => (
            <span key={record.id}>
              <strong>{record.name || record.id}</strong>
              {(record.curationFields?.length ?? 0) > 0 && ` curation: ${record.curationFields?.slice(0, 4).join(', ')}`}
              {(record.mediaFields?.length ?? 0) > 0 && ` media: ${record.mediaFields?.slice(0, 4).join(', ')}`}
            </span>
          ))}
          {summary.affectedRecords.length > 10 && <span>+{summary.affectedRecords.length - 10} more records in this preview</span>}
        </div>
      )}

      <div className="portal-apply-preview__pipeline">
        <strong>Apply pipeline</strong>
        {(summary?.pipeline ?? ['Apply decisions', 'Prepare data', 'Curation report', 'Media validate', 'Validate entities', 'Build public site']).map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
    </section>
  );
}

function PortalRunnerPanel({ runner, onRunScript }: { runner: RunnerState; onRunScript: (script: RunnerScript) => void }) {
  const latestJob = runner.activeJob ?? runner.jobs[0] ?? null;
  const jobLogDir = runner.health?.jobLogDir ?? '.portal/jobs';
  const git = runner.health?.git;
  const tokenLabel = runner.health?.tokenRequired === false
    ? 'Token not required'
    : runner.health?.tokenSource === 'environment'
      ? 'Token from environment'
      : 'Token required';
  const dirtyLabel = git?.available
    ? git.dirty
      ? `Dirty: ${git.changedFiles ?? 0} files`
      : 'Clean'
    : 'Git unavailable';

  return (
    <section className={runner.available ? 'portal-runner portal-runner--online' : 'portal-runner'} aria-label="Local script runner">
      <div className="portal-runner__header">
        <div>
          <p className="eyebrow">Local Runner</p>
          <h4>{runner.available ? 'Connected to localhost runner' : 'Runner not connected'}</h4>
          <span>{runner.available ? `Portal can run whitelisted scripts. Logs persist to ${jobLogDir}.` : 'Start it with npm run portal:server, paste the printed token, then reconnect.'}</span>
        </div>
        <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Refresh'}</button>
      </div>

      {runner.error && <div className="portal-runner__error">{runner.error}</div>}

      <div className="portal-runner-meta" aria-label="Runner status details">
        <span>{tokenLabel}</span>
        <span>Logs: {jobLogDir}</span>
        <span>Active jobs: {runner.health?.activeJobs ?? 0}</span>
        <span>Retains: {runner.health?.maxPersistedJobs ?? 80}</span>
        <span className={git?.dirty ? 'portal-runner-meta__warning' : ''}>{dirtyLabel}</span>
      </div>

      <div className="portal-runner-repo" aria-label="Repository status">
        <div>
          <span>Repo Root</span>
          <strong>{formatRepoPath(runner.health?.repoRoot ?? git?.root)}</strong>
        </div>
        <div>
          <span>Branch</span>
          <strong>{git?.available ? git.branch || 'Detached' : git?.error || 'Unavailable'}</strong>
        </div>
        <div>
          <span>Latest Commit</span>
          <strong>{formatGitCommit(git)}</strong>
        </div>
        <div>
          <span>Remote State</span>
          <strong>{formatAheadBehind(git)}</strong>
        </div>
        <div>
          <span>Last Validation</span>
          <strong>{formatRunnerJobSummary(runner.health?.lastSuccessfulValidation)}</strong>
        </div>
        <div>
          <span>Last Build</span>
          <strong>{formatRunnerJobSummary(runner.health?.lastSuccessfulBuild)}</strong>
        </div>
      </div>

      {git?.dirty && git.changes && git.changes.length > 0 && (
        <div className="portal-runner-changes" aria-label="Uncommitted changes">
          {git.changes.map((change) => (
            <span key={`${change.status}-${change.path}`}>{change.status} {change.path}</span>
          ))}
        </div>
      )}

      <div className="portal-runner-access portal-runner-access--embedded">
        <label className="field">
          <span>Runner token</span>
          <input
            autoComplete="off"
            type="password"
            value={runner.token}
            onChange={(event) => runner.setToken(event.target.value)}
            placeholder="Paste token printed by npm run portal:server"
          />
        </label>
        <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Reconnect'}</button>
      </div>

      <div className="portal-runner__scripts" aria-label="Available scripts">
        {runner.scripts.map((script) => (
          <button
            className={script.destructive ? 'portal-runner-script portal-runner-script--danger' : 'portal-runner-script'}
            disabled={!runner.available || runner.activeJob?.status === 'running'}
            key={script.id}
            type="button"
            onClick={() => onRunScript(script)}
          >
            <strong>{script.label}</strong>
            <span>{script.description}</span>
            {script.strict && <em>Strict</em>}
            {script.destructive && <em>Careful</em>}
          </button>
        ))}
        {runner.scripts.length === 0 && <div className="portal-empty-state">No runner scripts loaded.</div>}
      </div>

      {latestJob && (
        <div className="portal-runner-job" aria-label="Latest runner job">
          <div className="portal-runner-job__summary">
            <strong>{latestJob.label}</strong>
            <span className={`portal-runner-job__status portal-runner-job__status--${latestJob.status}`}>{latestJob.status}</span>
            {latestJob.currentStep && <span>{latestJob.currentStep}</span>}
            {latestJob.logPath && <span>Log: {latestJob.logPath}</span>}
          </div>
          {latestJob.steps && latestJob.steps.length > 0 && (
            <div className="portal-runner-steps">
              {latestJob.steps.map((step) => (
                <span className={`portal-runner-step portal-runner-step--${step.status}`} key={`${latestJob.id}-${step.label}`}>
                  {step.label}: {step.status}
                </span>
              ))}
            </div>
          )}
          <pre>{latestJob.output || 'No output yet.'}</pre>
        </div>
      )}
    </section>
  );
}
