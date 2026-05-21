import { useEffect, useMemo, useState } from 'react';
import type { Inductee } from './types';

type DataState = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
};

export function useInductees(): DataState {
  const [state, setState] = useState<DataState>({ inductees: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    fetch('/data/inductees.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
        return response.json() as Promise<Inductee[]>;
      })
      .then((inductees) => {
        if (!cancelled) setState({ inductees, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ inductees: [], loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useDataFacets(inductees: Inductee[]) {
  return useMemo(() => {
    const regions = Array.from(new Set(inductees.map((item) => item.region))).sort((a, b) => a.localeCompare(b));
    const years = Array.from(
      new Set(inductees.map((item) => item.classYear).filter((year): year is number => typeof year === 'number')),
    ).sort((a, b) => a - b);

    return { regions, years };
  }, [inductees]);
}
