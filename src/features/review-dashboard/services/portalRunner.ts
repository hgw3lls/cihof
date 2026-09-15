import { useEffect, useState } from 'react';
import type { RelationshipRecord, StoryLensDocument } from '../../../data/types';

export type RunnerScript = {
  id: string;
  label: string;
  description: string;
  mutates?: boolean;
  destructive?: boolean;
  strict?: boolean;
};

export type RunnerJob = {
  id: string;
  label: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  output?: string;
  currentStep?: string;
  steps?: Array<{
    label: string;
    status: 'queued' | 'running' | 'success' | 'failed';
    startedAt?: string;
    finishedAt?: string;
    exitCode?: number | null;
    output?: string;
  }>;
  logPath?: string;
  persistedAt?: string;
  meta?: RunnerJobMeta;
};

export type RunnerApplySummary = {
  rowsRead?: number;
  targetRows?: number;
  targets?: string[];
  curationFieldInputs?: number;
  mediaFieldInputs?: number;
  curationFieldCounts?: Record<string, number>;
  mediaFieldCounts?: Record<string, number>;
  warnings?: string[];
  affectedRecords?: Array<{
    id: string;
    name?: string;
    classYear?: string;
    curationFields?: string[];
    mediaFields?: string[];
    fieldInputs?: number;
  }>;
  dryRunResults?: Array<{
    label: string;
    status: RunnerJob['status'];
    rowsRead?: number | null;
    recordsChanged?: number | null;
    warnings?: number;
    errors?: number;
    changedRecords?: Array<{
      id: string;
      fields: string[];
    }>;
  }>;
  pipeline?: string[];
};

export type RunnerJobMeta = {
  kind?: string;
  scriptId?: string;
  decisionPath?: string;
  dryRun?: boolean;
  targets?: string[];
  csvHash?: string;
  previewJobId?: string;
  applySummary?: RunnerApplySummary;
};

export type RunnerJobSummary = {
  id: string;
  label: string;
  status: 'success';
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  scriptId?: string;
  logPath?: string;
  persistedAt?: string;
};

export type RunnerGitStatus = {
  available: boolean;
  root?: string;
  branch?: string;
  upstream?: string;
  commit?: string;
  fullCommit?: string;
  commitSubject?: string;
  commitDate?: string;
  dirty?: boolean;
  changedFiles?: number;
  ahead?: number | null;
  behind?: number | null;
  changes?: Array<{
    status: string;
    path: string;
  }>;
  error?: string;
};

export type RunnerHealth = {
  ok: boolean;
  name?: string;
  repoRoot?: string;
  scripts?: number;
  activeJobs?: number;
  externalOrigins?: string[];
  tokenRequired?: boolean;
  tokenSource?: string;
  jobLogDir?: string;
  maxPersistedJobs?: number;
  runnerStartedAt?: string;
  git?: RunnerGitStatus;
  lastSuccessfulValidation?: RunnerJobSummary | null;
  lastSuccessfulBuild?: RunnerJobSummary | null;
};

export type RunnerState = {
  available: boolean;
  checking: boolean;
  error: string;
  token: string;
  health: RunnerHealth | null;
  scripts: RunnerScript[];
  jobs: RunnerJob[];
  activeJob: RunnerJob | null;
  setToken: (token: string) => void;
  refresh: () => Promise<void>;
  runScript: (scriptId: string) => Promise<RunnerJob | null>;
  applyDecisions: (csv: string, options: { dryRun: boolean; previewJobId?: string; previewHash?: string }) => Promise<RunnerJob | null>;
  saveStoryLenses: (document: StoryLensDocument) => Promise<StoryLensDocument | null>;
  saveRelationships: (records: RelationshipRecord[]) => Promise<RelationshipRecord[] | null>;
};

const portalRunnerBaseUrl = 'http://127.0.0.1:5174';
const runnerTokenStorageKey = 'cihof.portal.runnerToken.v1';

export function usePortalRunner(): RunnerState {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [token, setTokenValue] = useState(() => readSessionValue(runnerTokenStorageKey));
  const [health, setHealth] = useState<RunnerHealth | null>(null);
  const [scripts, setScripts] = useState<RunnerScript[]>([]);
  const [jobs, setJobs] = useState<RunnerJob[]>([]);

  const activeJob = jobs.find((job) => job.status === 'running' || job.status === 'queued') ?? null;

  function setToken(nextToken: string) {
    const cleanedToken = nextToken.trim();
    setTokenValue(cleanedToken);
    writeSessionValue(runnerTokenStorageKey, cleanedToken);
  }

  async function refresh() {
    setChecking(true);
    try {
      const [health, scriptPayload, jobPayload] = await Promise.all([
        fetchRunner<RunnerHealth>('/api/health', token),
        fetchRunner<{ scripts: RunnerScript[] }>('/api/scripts', token),
        fetchRunner<{ jobs: RunnerJob[] }>('/api/jobs', token),
      ]);
      setAvailable(Boolean(health.ok));
      setHealth(health);
      setScripts(scriptPayload.scripts ?? []);
      setJobs(jobPayload.jobs ?? []);
      setError('');
    } catch (errorValue) {
      setAvailable(false);
      setHealth(null);
      setScripts([]);
      setJobs([]);
      setError(errorValue instanceof Error ? errorValue.message : 'Local portal runner is not available.');
    } finally {
      setChecking(false);
    }
  }

  async function runScript(scriptId: string) {
    try {
      const payload = await postRunner<{ job: RunnerJob }>('/api/run', { scriptId }, token);
      await refresh();
      return payload.job;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not start script.');
      return null;
    }
  }

  async function applyDecisions(csv: string, options: { dryRun: boolean; previewJobId?: string; previewHash?: string }) {
    try {
      const payload = await postRunner<{ job: RunnerJob }>('/api/apply-decisions', { csv, ...options, targets: ['curation', 'media'] }, token);
      await refresh();
      return payload.job;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not start portal decision apply.');
      return null;
    }
  }

  async function saveStoryLenses(document: StoryLensDocument) {
    try {
      const payload = await postRunner<{ document: StoryLensDocument }>('/api/story-lenses', { document }, token);
      await refresh();
      return payload.document;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not save Story Lens JSON.');
      return null;
    }
  }

  async function saveRelationships(records: RelationshipRecord[]) {
    try {
      const payload = await postRunner<{ records: RelationshipRecord[] }>('/api/relationships', { records }, token);
      await refresh();
      return payload.records ?? [];
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not save relationship JSON.');
      return null;
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, activeJob ? 1500 : 6000);
    return () => window.clearInterval(interval);
  }, [activeJob?.id, activeJob?.status, token]);

  return { available, checking, error, token, health, scripts, jobs, activeJob, setToken, refresh, runScript, applyDecisions, saveStoryLenses, saveRelationships };
}

async function fetchRunner<T>(path: string, token = ''): Promise<T> {
  const response = await fetch(`${portalRunnerBaseUrl}${path}`, {
    cache: 'no-store',
    headers: runnerHeaders(token),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `Portal runner ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function postRunner<T>(path: string, body: unknown, token = ''): Promise<T> {
  const response = await fetch(`${portalRunnerBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...runnerHeaders(token) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `Portal runner ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function runnerHeaders(token: string): HeadersInit {
  const cleanedToken = token.trim();
  return cleanedToken ? { 'x-cihof-portal-token': cleanedToken } : {};
}

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Session storage can be unavailable in some locked-down kiosk browser modes.
  }
}
