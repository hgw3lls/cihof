export const relationshipTypes = [
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
];

export const relationshipEntityTypes = ['person', 'organization', 'place', 'community', 'event', 'theme', 'media'];
export const relationshipProvenanceValues = ['documented', 'curated', 'inferred'];

export function normalizeRelationshipRecords(input) {
  const records = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && !Array.isArray(input) && Array.isArray(input.relationships)
      ? input.relationships
      : input && typeof input === 'object' && !Array.isArray(input) && Array.isArray(input.records)
        ? input.records
        : [];

  return records
    .map(normalizeRelationshipRecord)
    .filter(Boolean)
    .sort(compareRelationshipRecords);
}

export function validateRelationshipRecords(records, inducteeIds = new Set()) {
  const errors = [];
  const warnings = [];
  const keys = new Set();

  if (!Array.isArray(records)) {
    return { errors: ['Relationship metadata must be an array.'], warnings };
  }

  records.forEach((record, index) => {
    const label = record?.sourcePersonId && record?.targetEntityId
      ? `${record.sourcePersonId} -> ${record.targetEntityId}`
      : `relationships[${index}]`;

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${label}: relationship must be an object.`);
      return;
    }

    requireString(record.id, `${label}.id`, errors);
    requireString(record.sourcePersonId, `${label}.sourcePersonId`, errors);
    requireString(record.targetEntityId, `${label}.targetEntityId`, errors);
    requireString(record.type, `${label}.type`, errors);
    requireString(record.displayLabel, `${label}.displayLabel`, errors);
    requireString(record.provenance, `${label}.provenance`, errors);

    if (record.sourcePersonId && inducteeIds.size > 0 && !inducteeIds.has(record.sourcePersonId)) {
      errors.push(`${label}.sourcePersonId is not a current inductee id.`);
    }
    if (record.targetEntityType === 'person' || (!record.targetEntityType && inducteeIds.has(record.targetEntityId))) {
      if (inducteeIds.size > 0 && !inducteeIds.has(record.targetEntityId)) {
        errors.push(`${label}.targetEntityId is not a current inductee id.`);
      }
      if (record.sourcePersonId === record.targetEntityId) {
        errors.push(`${label}: source and target cannot be the same person.`);
      }
    }
    if (!record.targetEntityType && inducteeIds.size > 0 && record.targetEntityId && !inducteeIds.has(record.targetEntityId)) {
      errors.push(`${label}.targetEntityType is required for non-person targets.`);
    }
    if (record.targetEntityType && !relationshipEntityTypes.includes(record.targetEntityType)) {
      errors.push(`${label}.targetEntityType has invalid value "${record.targetEntityType}".`);
    }
    if (record.targetEntityType && record.targetEntityType !== 'person' && !record.targetDisplayName) {
      warnings.push(`${label}.targetDisplayName is recommended for non-person relationship targets.`);
    }
    if (!relationshipTypes.includes(record.type)) {
      errors.push(`${label}.type has invalid value "${record.type}".`);
    }
    if (!relationshipProvenanceValues.includes(record.provenance)) {
      errors.push(`${label}.provenance has invalid value "${record.provenance}".`);
    }
    if (record.provenance === 'inferred') {
      errors.push(`${label}: inferred relationships are review candidates and cannot be saved to the approved relationship feed.`);
    }
    if (!record.referenceNote) {
      errors.push(`${label}.referenceNote is required for the approved relationship feed.`);
    }
    if (record.type === 'same_class') {
      errors.push(`${label}: same_class is derived from induction records and must not be saved as a personal relationship.`);
    }

    const key = relationshipRecordKey(record);
    if (keys.has(key)) errors.push(`${label}: duplicate relationship record.`);
    keys.add(key);
  });

  return { errors, warnings };
}

export function dedupeRelationshipRecords(records) {
  const byKey = new Map();
  normalizeRelationshipRecords(records).forEach((record) => {
    byKey.set(relationshipRecordKey(record), record);
  });
  return Array.from(byKey.values()).sort(compareRelationshipRecords);
}

export function relationshipRecordKey(record) {
  if (record.id) return record.id;
  return [
    record.sourcePersonId,
    record.targetEntityType || '',
    record.targetEntityId,
    record.type,
    record.displayLabel,
    record.provenance,
  ].join('|');
}

function normalizeRelationshipRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = {
    id: cleanString(value.id),
    sourcePersonId: cleanString(value.sourcePersonId),
    targetEntityId: cleanString(value.targetEntityId),
    type: cleanString(value.type),
    displayLabel: cleanString(value.displayLabel),
    provenance: cleanString(value.provenance),
  };
  const targetEntityType = cleanString(value.targetEntityType);
  const targetDisplayName = cleanString(value.targetDisplayName);
  const referenceNote = cleanString(value.referenceNote);
  const reverseDisplayLabel = cleanString(value.reverseDisplayLabel);

  if (targetEntityType) record.targetEntityType = targetEntityType;
  if (targetDisplayName) record.targetDisplayName = targetDisplayName;
  if (referenceNote) record.referenceNote = referenceNote;
  if (reverseDisplayLabel) record.reverseDisplayLabel = reverseDisplayLabel;
  return record;
}

function compareRelationshipRecords(a, b) {
  return (
    a.sourcePersonId.localeCompare(b.sourcePersonId) ||
    (a.targetEntityType || '').localeCompare(b.targetEntityType || '') ||
    a.targetEntityId.localeCompare(b.targetEntityId) ||
    a.type.localeCompare(b.type) ||
    a.displayLabel.localeCompare(b.displayLabel)
  );
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) errors.push(`${label} is required.`);
}
