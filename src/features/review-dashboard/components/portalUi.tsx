import type {
  RunnerGitStatus,
  RunnerJobSummary,
} from '../services/portalRunner';

export function ReadinessCard({ title, ready, total, action, ids, onClick }: { title: string; ready: number; total: number; action: string; ids?: string[]; onClick: () => void }) {
  const clampedTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((ready / clampedTotal) * 100));
  return (
    <div className="portal-readiness-card">
      <span>{title}</span>
      <strong>{ready}/{total}</strong>
      <div className="portal-progress" aria-label={`${title} ${percent}% ready`}>
        <i style={{ width: `${percent}%` }} />
      </div>
      {ids && ids.length > 0 && <small>{ids.slice(0, 4).join(', ')}{ids.length > 4 ? `, +${ids.length - 4}` : ''}</small>}
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="review-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function Chip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'accent' }) {
  return <span className={`review-chip review-chip--${tone}`}>{label}</span>;
}

export function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <span className={`review-status review-status--${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

export function statusLabel(errors: number, warnings: number) {
  if (errors > 0) return `${errors} errors`;
  if (warnings > 0) return `${warnings} warnings`;
  return 'Clean';
}

export function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatRepoPath(value?: string) {
  if (!value) return 'Unavailable';
  const parts = value.split('/').filter(Boolean);
  if (parts.length <= 3) return value;
  return `.../${parts.slice(-3).join('/')}`;
}

export function formatGitCommit(git?: RunnerGitStatus) {
  if (!git?.available) return git?.error || 'Unavailable';
  if (!git.commit) return 'No commit';
  return git.commitSubject ? `${git.commit} ${git.commitSubject}` : git.commit;
}

export function formatAheadBehind(git?: RunnerGitStatus) {
  if (!git?.available) return 'Unavailable';
  if (!git.upstream) return 'No upstream';
  const ahead = typeof git.ahead === 'number' ? git.ahead : 0;
  const behind = typeof git.behind === 'number' ? git.behind : 0;
  if (ahead === 0 && behind === 0) return `Synced with ${git.upstream}`;
  return `${ahead} ahead, ${behind} behind ${git.upstream}`;
}

export function formatRunnerJobSummary(job?: RunnerJobSummary | null) {
  if (!job) return 'No success yet';
  const date = formatDate(job.finishedAt || job.startedAt);
  return `${job.label} - ${date}`;
}

export function formatClock(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
