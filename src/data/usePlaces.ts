import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { loadRuntimeDataBundle, subscribeRuntimeDataBundleChanges } from './runtimeDataBundle';
import type { PlaceRecord, PlaceType, RelationshipProvenance } from './types';

type PlacesState = {
  places: PlaceRecord[];
  loading: boolean;
  error: string;
};

const placesUrl = `${import.meta.env.BASE_URL}data/places.json`;
const cacheKey = 'places';
const placeTypes = new Set<PlaceType>([
  'neighborhood',
  'cultural_center',
  'church',
  'school',
  'civic_building',
  'cultural_garden',
  'business',
  'festival_location',
  'community_organization',
  'historic_address',
]);
const provenanceValues = new Set<RelationshipProvenance>(['documented', 'curated', 'inferred']);

export function usePlaces(): PlacesState {
  const [state, setState] = useState<PlacesState>({ places: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    function loadData() {
      setState((current) => ({ ...current, loading: true }));

      loadRuntimeDataBundle()
        .then((bundle) => {
          const payload = bundle.places ?? { places: [] };
          writeCachedJson(cacheKey, payload);
          const places = parsePlaces(payload);
          if (!cancelled) setState({ places, loading: false, error: '' });
        })
        .catch((error: Error) => {
          runtimeLogger.warn('Runtime data bundle did not provide places; falling back to places.json.', { error: error.message });
          void loadLegacyPlaces(() => cancelled, setState);
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

function loadLegacyPlaces(isCancelled: () => boolean, setState: (state: PlacesState) => void) {
  return fetch(placesUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Places request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        writeCachedJson(cacheKey, payload);
        const places = parsePlaces(payload);
        if (!isCancelled()) setState({ places, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (isCancelled()) return;
        const cached = readCachedJson(cacheKey);
        if (cached) {
          runtimeLogger.warn('Using cached places after load failure.', { error: error.message });
          if (!isCancelled()) setState({ places: parsePlaces(cached), loading: false, error: '' });
          return;
        }
        if (!isCancelled()) setState({ places: [], loading: false, error: error.message });
      });
}

export function usePlaceTypes(places: PlaceRecord[]) {
  return useMemo(() => Array.from(new Set(places.map((place) => place.type))).sort(), [places]);
}

function parsePlaces(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const records = (payload as { places?: unknown }).places;
  if (!Array.isArray(records)) return [];
  return records.filter(isPlaceRecord);
}

function isPlaceRecord(record: unknown): record is PlaceRecord {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const candidate = record as Partial<PlaceRecord>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.shortHistory === 'string' &&
    typeof candidate.type === 'string' &&
    placeTypes.has(candidate.type as PlaceType) &&
    isMarker(candidate.marker) &&
    isRelated(candidate.related) &&
    Boolean(candidate.provenance) &&
    typeof candidate.provenance?.source === 'string' &&
    typeof candidate.provenance?.confidence === 'string' &&
    provenanceValues.has(candidate.provenance.confidence)
  );
}

function isMarker(marker: unknown) {
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return false;
  const candidate = marker as { x?: unknown; y?: unknown };
  return typeof candidate.x === 'number' && typeof candidate.y === 'number' && candidate.x >= 0 && candidate.x <= 100 && candidate.y >= 0 && candidate.y <= 100;
}

function isRelated(related: unknown) {
  if (!related || typeof related !== 'object' || Array.isArray(related)) return false;
  const candidate = related as { people?: unknown; communities?: unknown; organizations?: unknown };
  return (
    isOptionalStringArray(candidate.people) &&
    isOptionalStringArray(candidate.communities) &&
    isOptionalStringArray(candidate.organizations)
  );
}

function isOptionalStringArray(value: unknown) {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}
