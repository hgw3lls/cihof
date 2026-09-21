import { useCallback, useEffect, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { isVisitorPublishedRelationship } from './relationshipPublication';
import { loadRuntimeDataBundle, subscribeRuntimeDataBundleChanges } from './runtimeDataBundle';
import type { RelationshipRecord } from './types';

type RelationshipState = {
  relationships: RelationshipRecord[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
type RelationshipLoadState = Omit<RelationshipState, 'refresh'>;

const relationshipsUrl = `${import.meta.env.BASE_URL}data/relationships.json`;
const cacheKey = 'relationships';

export function useRelationships(): RelationshipState {
  const [state, setState] = useState<RelationshipLoadState>({ relationships: [], loading: true, error: '' });

  const refreshInternal = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const bundle = await loadRuntimeDataBundle();
      const payload = bundle.relationships ?? [];
      if (!Array.isArray(payload)) throw new Error('Relationships data must be an array.');
      writeCachedJson(cacheKey, payload);
      setState({ relationships: payload.filter(isVisitorPublishedRelationship), loading: false, error: '' });
    } catch (error) {
      runtimeLogger.warn('Runtime data bundle did not provide relationships; falling back to relationships.json.', { error });
      await loadLegacyRelationships(setState);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void refreshInternal().then(() => {
        if (cancelled) return;
      });
    };
    load();
    const unsubscribe = subscribeRuntimeDataBundleChanges(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshInternal]);

  return { ...state, refresh: () => refreshInternal() };
}

async function loadLegacyRelationships(setState: (state: RelationshipLoadState) => void) {
  try {
    const payload = await fetch(relationshipsUrl, { cache: 'no-store' })
      .then((response) => {
        if (response.status === 404) return [] as unknown;
        if (!response.ok) throw new Error(`Relationships request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      });
    if (!Array.isArray(payload)) throw new Error('Relationships data must be an array.');
    writeCachedJson(cacheKey, payload);
    setState({ relationships: payload.filter(isVisitorPublishedRelationship), loading: false, error: '' });
  } catch (error) {
    const cached = readCachedJson(cacheKey);
    if (Array.isArray(cached)) {
      runtimeLogger.warn('Using cached relationship data after load failure.', { error });
      setState({ relationships: cached.filter(isVisitorPublishedRelationship), loading: false, error: '' });
      return;
    }
    setState({ relationships: [], loading: false, error: error instanceof Error ? offlineAwareError(error.message, 'Could not load relationships.') : 'Could not load relationships.' });
  }
}

function offlineAwareError(message: string, fallback: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return `${fallback} The browser is offline.`;
  return message || fallback;
}
