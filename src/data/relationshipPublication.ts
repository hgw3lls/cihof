import type { RelationshipEntityType, RelationshipProvenance, RelationshipRecord, RelationshipType } from './types.ts';
import { isExplicitlyPublished, type VisitorContentTarget } from './publicationPolicy.ts';

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

export function isRelationshipRecord(value: unknown): value is RelationshipRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    typeof record.sourcePersonId === 'string' &&
    typeof record.targetEntityId === 'string' &&
    typeof record.displayLabel === 'string' &&
    relationshipTypes.has(record.type as RelationshipType) &&
    provenanceValues.has(record.provenance as RelationshipProvenance) &&
    (record.targetEntityType === undefined || entityTypes.has(record.targetEntityType as RelationshipEntityType)) &&
    (record.targetDisplayName === undefined || typeof record.targetDisplayName === 'string') &&
    (record.reverseDisplayLabel === undefined || typeof record.reverseDisplayLabel === 'string') &&
    (record.referenceNote === undefined || typeof record.referenceNote === 'string')
  );
}

export function isVisitorPublishedRelationship(value: unknown): value is RelationshipRecord {
  return isVisitorPublishedRelationshipForTarget(value, 'kiosk');
}

export function isVisitorPublishedRelationshipForTarget(value: unknown, target: VisitorContentTarget): value is RelationshipRecord {
  if (!isRelationshipRecord(value)) return false;
  if (value.review !== undefined || value.publication !== undefined) {
    return isExplicitlyPublished(value, target) && Boolean(value.evidence?.length);
  }
  return value.id.trim().length > 0
    && value.type !== 'same_class'
    && value.provenance !== 'inferred'
    && Boolean(value.referenceNote?.trim());
}
