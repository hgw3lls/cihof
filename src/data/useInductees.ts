import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { normalizeInducteePayload } from './normalizeInductees';
import { loadRuntimeDataBundle, subscribeRuntimeDataBundleChanges } from './runtimeDataBundle';
import type { Inductee } from './types';

type DataState = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
};

const dataUrl = `${import.meta.env.BASE_URL}data/inductees.json`;
const cacheKey = 'inductees';

export function useInductees(): DataState {
  const [state, setState] = useState<DataState>({ inductees: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    function loadData() {
      setState((current) => ({ ...current, loading: true }));

      loadRuntimeDataBundle()
        .then((bundle) => {
          const inductees = normalizeInducteePayload(bundle.inductees);
          if (inductees.length > 0) writeCachedJson(cacheKey, bundle.inductees);
          if (!cancelled) setState({ inductees, loading: false, error: '' });
        })
        .catch((error: Error) => {
          runtimeLogger.warn('Runtime data bundle did not provide inductees; falling back to inductees.json.', { error: error.message });
          void loadLegacyInductees(() => cancelled, setState);
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

function loadLegacyInductees(isCancelled: () => boolean, setState: (state: DataState) => void) {
  return fetch(dataUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const inductees = normalizeInducteePayload(payload);
        if (inductees.length > 0) writeCachedJson(cacheKey, payload);
        if (!isCancelled()) setState({ inductees, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (isCancelled()) return;
        const cached = readCachedJson(cacheKey);
        const cachedInductees = normalizeInducteePayload(cached);
        if (cachedInductees.length > 0) {
          runtimeLogger.warn('Using cached inductee data after load failure.', { error: error.message });
          if (!isCancelled()) setState({ inductees: cachedInductees, loading: false, error: '' });
          return;
        }
        if (!isCancelled()) setState({ inductees: [], loading: false, error: offlineAwareError(error.message, 'Inductee data could not be loaded.') });
      });
}

function offlineAwareError(message: string, fallback: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return `${fallback} The browser is offline.`;
  return message || fallback;
}

export function useDataFacets(inductees: Inductee[]) {
  return useMemo(() => {
    const regions = Array.from(new Set(inductees.map((item) => item.region))).sort((a, b) => a.localeCompare(b));
    const countries = Array.from(new Set(inductees.flatMap((item) => item.countryTags))).sort((a, b) => a.localeCompare(b));
    const years = Array.from(
      new Set(inductees.map((item) => item.classYear).filter((year): year is number => typeof year === 'number')),
    ).sort((a, b) => a - b);
    const themes = Array.from(new Set(inductees.flatMap((item) => item.themeTags))).sort((a, b) => a.localeCompare(b));

    return { regions, countries, years, themes };
  }, [inductees]);
}
