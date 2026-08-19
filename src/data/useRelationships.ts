import { useCallback, useEffect, useState } from 'react';
import type { RelationshipEntityType, RelationshipProvenance, RelationshipRecord, RelationshipType } from './types';

type RelationshipState = {
  relationships: RelationshipRecord[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
type RelationshipLoadState = Omit<RelationshipState, 'refresh'>;

const relationshipsUrl = `${import.meta.env.BASE_URL}data/relationships.json`;

const relationshipTypes = new Set<RelationshipType>([
  'inducted_by',
  'same_class',
  'shared_theme',
  'shared_organization',
  'shared_community',
  'civic_collaboration',
  'mentor',
  'colleague',
  'family',
  'related_place',
  'related_event',
]);

const provenanceValues = new Set<RelationshipProvenance>(['documented', 'curated', 'inferred']);
const entityTypes = new Set<RelationshipEntityType>(['person', 'organization', 'place', 'community', 'event', 'theme', 'media']);

export function useRelationships(): RelationshipState {
  const [state, setState] = useState<RelationshipLoadState>({ relationships: [], loading: true, error: '' });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const payload = await fetch(relationshipsUrl, { cache: 'no-store' })
      .then((response) => {
        if (response.status === 404) return [] as unknown;
        if (!response.ok) throw new Error(`Relationships request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      if (!Array.isArray(payload)) throw new Error('Relationships data must be an array.');
      setState({ relationships: payload.filter(isRelationshipRecord), loading: false, error: '' });
    } catch (error) {
      setState({ relationships: [], loading: false, error: error instanceof Error ? error.message : 'Could not load relationships.' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

function isRelationshipRecord(value: unknown): value is RelationshipRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.sourcePersonId === 'string' &&
    typeof record.targetEntityId === 'string' &&
    typeof record.displayLabel === 'string' &&
    relationshipTypes.has(record.type as RelationshipType) &&
    provenanceValues.has(record.provenance as RelationshipProvenance) &&
    (record.targetEntityType === undefined || entityTypes.has(record.targetEntityType as RelationshipEntityType)) &&
    (record.targetDisplayName === undefined || typeof record.targetDisplayName === 'string') &&
    (record.referenceNote === undefined || typeof record.referenceNote === 'string')
  );
}
