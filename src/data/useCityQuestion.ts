import { useCallback, useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { installationConfig } from '../config/installationConfig';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { loadRuntimeDataBundle, subscribeRuntimeDataBundleChanges } from './runtimeDataBundle';

export type CityQuestionOption = {
  id: string;
  label: string;
};

export type CityQuestionAttractConfig = {
  enabled: boolean;
  initialDelayMs: number;
  loopPauseMs: number;
  holdMs: number;
};

export type CityQuestionConfig = {
  schemaVersion: number;
  enabled: boolean;
  prompt: string;
  resultsTitle: string;
  instruction: string;
  privacyNote: string;
  storageKey: string;
  autoCloseMs: number;
  attract: CityQuestionAttractConfig;
  options: CityQuestionOption[];
};

export type CityQuestionCounts = Record<string, number>;

type CityQuestionLoadState = {
  config: CityQuestionConfig;
  loading: boolean;
  error: string;
};

type CityQuestionState = CityQuestionLoadState & {
  counts: CityQuestionCounts;
  enabled: boolean;
  recordChoice: (optionId: string) => void;
};

const configUrl = `${import.meta.env.BASE_URL}data/city-question.json`;
const defaultStorageKey = 'cihof.city-question.responses.v1';
const cacheKey = 'city-question-config';
const defaultConfig: CityQuestionConfig = {
  schemaVersion: 1,
  enabled: false,
  prompt: 'WHAT DO WE BUILD TOGETHER?',
  resultsTitle: 'CLEVELAND ANSWERS',
  instruction: 'Choose one word.',
  privacyNote: 'Anonymous aggregate only.',
  storageKey: defaultStorageKey,
  autoCloseMs: 12_000,
  attract: {
    enabled: false,
    initialDelayMs: 7_000,
    loopPauseMs: 52_000,
    holdMs: 9_000,
  },
  options: [],
};

export function useCityQuestion(): CityQuestionState {
  const [state, setState] = useState<CityQuestionLoadState>({
    config: defaultConfig,
    loading: true,
    error: '',
  });
  const [counts, setCounts] = useState<CityQuestionCounts>({});

  const optionIds = useMemo(() => new Set(state.config.options.map((option) => option.id)), [state.config.options]);
  const enabled = installationConfig.features.participatory && state.config.enabled && state.config.options.length > 0;

  useEffect(() => {
    let cancelled = false;

    function loadData() {
      setState((current) => ({ ...current, loading: true }));

      loadRuntimeDataBundle()
        .then((bundle) => {
          const payload = bundle.cityQuestion ?? null;
          if (payload) writeCachedJson(cacheKey, payload);
          if (!cancelled) setState({ config: parseCityQuestionConfig(payload), loading: false, error: '' });
        })
        .catch((error: Error) => {
          runtimeLogger.warn('Runtime data bundle did not provide city question config; falling back to city-question.json.', { error: error.message });
          void loadLegacyCityQuestion(() => cancelled, setState);
        });
    }

    loadData();
    const unsubscribe = subscribeRuntimeDataBundleChanges(loadData);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCounts({});
      return undefined;
    }

    setCounts(readStoredCounts(state.config.storageKey, optionIds));

    const syncCounts = (event: StorageEvent) => {
      if (event.key !== state.config.storageKey) return;
      setCounts(sanitizeCounts(readJson(event.newValue), optionIds));
    };

    window.addEventListener('storage', syncCounts);
    return () => window.removeEventListener('storage', syncCounts);
  }, [enabled, optionIds, state.config.storageKey]);

  const recordChoice = useCallback((optionId: string) => {
    if (!enabled || !optionIds.has(optionId)) return;

    setCounts((current) => {
      const normalized = sanitizeCounts(current, optionIds);
      const next = {
        ...normalized,
        [optionId]: (normalized[optionId] ?? 0) + 1,
      };
      writeStoredCounts(state.config.storageKey, next);
      return next;
    });
  }, [enabled, optionIds, state.config.storageKey]);

  return {
    ...state,
    counts,
    enabled,
    recordChoice,
  };
}

function loadLegacyCityQuestion(isCancelled: () => boolean, setState: (state: CityQuestionLoadState) => void) {
  return fetch(configUrl, { cache: 'no-store' })
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`City question config request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (isCancelled()) return;
        if (payload) writeCachedJson(cacheKey, payload);
        setState({ config: parseCityQuestionConfig(payload), loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (isCancelled()) return;
        const cached = readCachedJson(cacheKey);
        if (cached) {
          runtimeLogger.warn('Using cached city question config after load failure.', { error: error.message });
          setState({ config: parseCityQuestionConfig(cached), loading: false, error: '' });
          return;
        }
        setState({
          config: defaultConfig,
          loading: false,
          error: offlineAwareError(error.message, 'City question config could not be loaded.'),
        });
      });
}

function parseCityQuestionConfig(payload: unknown): CityQuestionConfig {
  if (!isRecord(payload)) return defaultConfig;

  const attractPayload = isRecord(payload.attract) ? payload.attract : {};
  const options = Array.isArray(payload.options)
    ? payload.options.map(parseOption).filter((option): option is CityQuestionOption => Boolean(option))
    : [];
  const uniqueOptions = uniqueById(options).slice(0, 12);

  return {
    schemaVersion: readNumber(payload.schemaVersion, 1, 1, 99),
    enabled: readBoolean(payload.enabled, false),
    prompt: readString(payload.prompt, defaultConfig.prompt),
    resultsTitle: readString(payload.resultsTitle, defaultConfig.resultsTitle),
    instruction: readString(payload.instruction, defaultConfig.instruction),
    privacyNote: readString(payload.privacyNote, defaultConfig.privacyNote),
    storageKey: readString(payload.storageKey, defaultStorageKey),
    autoCloseMs: readNumber(payload.autoCloseMs, defaultConfig.autoCloseMs, 4_000, 60_000),
    attract: {
      enabled: readBoolean(attractPayload.enabled, true),
      initialDelayMs: readNumber(attractPayload.initialDelayMs, defaultConfig.attract.initialDelayMs, 2_000, 120_000),
      loopPauseMs: readNumber(attractPayload.loopPauseMs, defaultConfig.attract.loopPauseMs, 10_000, 300_000),
      holdMs: readNumber(attractPayload.holdMs, defaultConfig.attract.holdMs, 4_000, 45_000),
    },
    options: uniqueOptions,
  };
}

function parseOption(value: unknown): CityQuestionOption | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id, '').trim();
  const label = readString(value.label, '').trim();
  if (!id || !label) return null;
  return { id, label };
}

function uniqueById(options: CityQuestionOption[]) {
  const seen = new Set<string>();
  const unique: CityQuestionOption[] = [];
  for (const option of options) {
    if (seen.has(option.id)) continue;
    seen.add(option.id);
    unique.push(option);
  }
  return unique;
}

function readStoredCounts(storageKey: string, optionIds: Set<string>) {
  if (typeof window === 'undefined') return {};
  try {
    return sanitizeCounts(readJson(window.localStorage.getItem(storageKey)), optionIds);
  } catch {
    return {};
  }
}

function writeStoredCounts(storageKey: string, counts: CityQuestionCounts) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(counts));
  } catch {
    // The in-memory React state still reflects the current anonymous aggregate.
  }
}

function sanitizeCounts(value: unknown, optionIds: Set<string>): CityQuestionCounts {
  if (!isRecord(value)) return {};
  const counts: CityQuestionCounts = {};

  for (const id of optionIds) {
    const count = value[id];
    if (typeof count !== 'number' || !Number.isFinite(count)) continue;
    counts[id] = Math.max(0, Math.floor(count));
  }

  return counts;
}

function readJson(value: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function offlineAwareError(message: string, fallback: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return `${fallback} The browser is offline.`;
  return message || fallback;
}
