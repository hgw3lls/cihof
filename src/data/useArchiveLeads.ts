import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { loadRuntimeDataBundle, subscribeRuntimeDataBundleChanges } from './runtimeDataBundle';
import type {
  ArchiveConnectionStrength,
  ArchiveLead,
  ArchiveLeadDocument,
  ArchiveLeadStatus,
  ArchiveLeadVisibility,
} from './types';

type ArchiveLeadsState = {
  records: ArchiveLead[];
  loading: boolean;
  error: string;
};

const archiveLeadsUrl = `${import.meta.env.BASE_URL}data/archive-leads.json`;
const cacheKey = 'archive-leads';
const statusValues = new Set<ArchiveLeadStatus>(['catalog-lead', 'requested', 'viewed', 'rights-pending', 'visitor-ready']);
const visibilityValues = new Set<ArchiveLeadVisibility>(['staff-review', 'visitor-ready']);
const connectionStrengthValues = new Set<ArchiveConnectionStrength>(['direct', 'institutional', 'contextual']);

export function useArchiveLeads(): ArchiveLeadsState {
  const [state, setState] = useState<ArchiveLeadsState>({ records: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    function loadData() {
      setState((current) => ({ ...current, loading: true }));

      loadRuntimeDataBundle()
        .then((bundle) => {
          const payload = bundle.archiveLeads ?? { records: [] };
          writeCachedJson(cacheKey, payload);
          if (!cancelled) setState({ records: parseArchiveLeads(payload), loading: false, error: '' });
        })
        .catch((error: Error) => {
          runtimeLogger.warn('Runtime data bundle did not provide archive leads; falling back to archive-leads.json.', { error: error.message });
          void loadLegacyArchiveLeads(() => cancelled, setState);
        });
    }

    loadData();
    const unsubscribe = subscribeRuntimeDataBundleChanges(loadData);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}

export function useArchiveLeadsByInductee(records: ArchiveLead[]) {
  return useMemo(() => {
    const map = new Map<string, ArchiveLead[]>();
    records.forEach((record) => {
      const existing = map.get(record.inducteeId) ?? [];
      existing.push(record);
      map.set(record.inducteeId, existing);
    });
    map.forEach((items) => items.sort(compareArchiveLeads));
    return map;
  }, [records]);
}

export function isVisitorReadyArchiveLead(record: ArchiveLead) {
  return record.status === 'visitor-ready' && record.visibility === 'visitor-ready';
}

function loadLegacyArchiveLeads(isCancelled: () => boolean, setState: (state: ArchiveLeadsState) => void) {
  return fetch(archiveLeadsUrl)
    .then((response) => {
      if (response.status === 404) return { records: [] } as unknown;
      if (!response.ok) throw new Error(`Archive leads request failed: ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((payload) => {
      writeCachedJson(cacheKey, payload);
      if (!isCancelled()) setState({ records: parseArchiveLeads(payload), loading: false, error: '' });
    })
    .catch((error: Error) => {
      if (isCancelled()) return;
      const cached = readCachedJson(cacheKey);
      if (cached) {
        runtimeLogger.warn('Using cached archive leads after load failure.', { error: error.message });
        if (!isCancelled()) setState({ records: parseArchiveLeads(cached), loading: false, error: '' });
        return;
      }
      if (!isCancelled()) setState({ records: [], loading: false, error: error.message });
    });
}

function parseArchiveLeads(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const document = payload as Partial<ArchiveLeadDocument>;
  const records = Array.isArray(document.records) ? document.records : [];
  return records
    .map((record, index) => normalizeArchiveLead(record, index))
    .filter((record): record is ArchiveLead => Boolean(record));
}

function normalizeArchiveLead(value: unknown, index: number): ArchiveLead | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<ArchiveLead>;
  const inducteeId = stringOrUndefined(record.inducteeId);
  const title = stringOrUndefined(record.title);
  const displayText = stringOrUndefined(record.displayText);
  if (!inducteeId || !title || !displayText) return null;

  const status = statusValues.has(record.status as ArchiveLeadStatus) ? record.status as ArchiveLeadStatus : 'catalog-lead';
  const visibility = visibilityValues.has(record.visibility as ArchiveLeadVisibility) ? record.visibility as ArchiveLeadVisibility : 'staff-review';
  const connectionStrength = connectionStrengthValues.has(record.connectionStrength as ArchiveConnectionStrength)
    ? record.connectionStrength as ArchiveConnectionStrength
    : 'contextual';

  return {
    ...record,
    id: stringOrUndefined(record.id) ?? `${inducteeId}-archive-${index + 1}`,
    inducteeId,
    inducteeName: stringOrUndefined(record.inducteeName),
    classYear: typeof record.classYear === 'number' ? record.classYear : null,
    title,
    repository: stringOrUndefined(record.repository) ?? 'Archive',
    collectionTitle: stringOrUndefined(record.collectionTitle),
    callNumber: stringOrUndefined(record.callNumber),
    sourceUrl: stringOrUndefined(record.sourceUrl),
    sourcePageTitle: stringOrUndefined(record.sourcePageTitle),
    sourceType: stringOrUndefined(record.sourceType),
    displayText,
    candidateUse: stringOrUndefined(record.candidateUse),
    rightsNote: stringOrUndefined(record.rightsNote),
    creditLine: stringOrUndefined(record.creditLine),
    reviewAction: stringOrUndefined(record.reviewAction),
    status,
    visibility,
    connectionStrength,
    priority: stringOrUndefined(record.priority),
    iiifManifestUrl: stringOrUndefined(record.iiifManifestUrl),
    imageUrl: stringOrUndefined(record.imageUrl),
    imageAltText: stringOrUndefined(record.imageAltText),
    labels: Array.isArray(record.labels) ? record.labels.filter((item): item is string => typeof item === 'string' && item.length > 0) : [],
  };
}

function compareArchiveLeads(a: ArchiveLead, b: ArchiveLead) {
  return archiveStatusRank(a.status) - archiveStatusRank(b.status)
    || archiveConnectionRank(a.connectionStrength) - archiveConnectionRank(b.connectionStrength)
    || a.title.localeCompare(b.title);
}

function archiveStatusRank(status: ArchiveLeadStatus) {
  if (status === 'visitor-ready') return 0;
  if (status === 'rights-pending') return 1;
  if (status === 'viewed') return 2;
  if (status === 'requested') return 3;
  return 4;
}

function archiveConnectionRank(connection: ArchiveConnectionStrength) {
  if (connection === 'direct') return 0;
  if (connection === 'institutional') return 1;
  return 2;
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
