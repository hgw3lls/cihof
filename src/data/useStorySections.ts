import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import type { RelationshipProvenance, StorySectionRecord } from './types';

type StorySectionsState = {
  records: StorySectionRecord[];
  loading: boolean;
  error: string;
};

const storySectionsUrl = `${import.meta.env.BASE_URL}data/story-sections.json`;
const cacheKey = 'story-sections';
const provenanceValues = new Set<RelationshipProvenance>(['documented', 'curated', 'inferred']);

export function useStorySections(): StorySectionsState {
  const [state, setState] = useState<StorySectionsState>({ records: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(storySectionsUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Story sections request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        writeCachedJson(cacheKey, payload);
        if (!cancelled) setState({ records: parseStorySections(payload), loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || cancelled) return;
        const cached = readCachedJson(cacheKey);
        if (cached) {
          runtimeLogger.warn('Using cached story sections after load failure.', { error: error.message });
          setState({ records: parseStorySections(cached), loading: false, error: '' });
          return;
        }
        setState({ records: [], loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
}

export function useStorySectionMap(records: StorySectionRecord[]) {
  return useMemo(() => new Map(records.map((record) => [record.inducteeId, record])), [records]);
}

function parseStorySections(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const records = (payload as { records?: unknown }).records;
  if (!records || typeof records !== 'object' || Array.isArray(records)) return [];

  return Object.entries(records)
    .map(([id, record]) => normalizeRecord(id, record))
    .filter((record): record is StorySectionRecord => Boolean(record));
}

function normalizeRecord(id: string, value: unknown): StorySectionRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<StorySectionRecord>;
  const provenance = provenanceValues.has(record.provenance as RelationshipProvenance) ? record.provenance as RelationshipProvenance : 'curated';
  const beats = Array.isArray(record.beats)
    ? record.beats.filter((beat) => beat && typeof beat === 'object' && !Array.isArray(beat)).flatMap((beat, index) => {
      const candidate = beat as StorySectionRecord['beats'][number];
      if (typeof candidate.headline !== 'string' || typeof candidate.body !== 'string') return [];
      return [{
        ...candidate,
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `beat-${index + 1}`,
        headline: candidate.headline.trim(),
        body: candidate.body.trim(),
        provenance: candidate.provenance ?? provenance,
      }];
    })
    : [];

  if (beats.length === 0) return null;

  return {
    ...record,
    inducteeId: typeof record.inducteeId === 'string' && record.inducteeId ? record.inducteeId : id,
    provenance,
    curatorNotes: Array.isArray(record.curatorNotes) ? record.curatorNotes.filter((item): item is string => typeof item === 'string') : undefined,
    beats,
  };
}
