import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { normalizeInducteePayload } from './normalizeInductees';
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
    const controller = new AbortController();

    fetch(dataUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const inductees = normalizeInducteePayload(payload);
        if (inductees.length > 0) writeCachedJson(cacheKey, payload);
        if (!cancelled) setState({ inductees, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || cancelled) return;
        const cached = readCachedJson(cacheKey);
        const cachedInductees = normalizeInducteePayload(cached);
        if (cachedInductees.length > 0) {
          runtimeLogger.warn('Using cached inductee data after load failure.', { error: error.message });
          setState({ inductees: cachedInductees, loading: false, error: '' });
          return;
        }
        setState({ inductees: [], loading: false, error: offlineAwareError(error.message, 'Inductee data could not be loaded.') });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
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
