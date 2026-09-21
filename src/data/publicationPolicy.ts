import type {
  ArchiveLead,
  ContentReview,
  EvidenceReference,
  Inductee,
  PublicationTargets,
  StoryBeat,
} from './types.ts';

export type VisitorContentTarget = 'public' | 'kiosk';

type JsonRecord = Record<string, unknown>;

const legacySafeEntityTypes = new Set(['Person', 'Community', 'Theme']);
const legacySafeRelationshipTypes = new Set(['has_theme', 'member_of_community', 'inducted_in_class', 'has_media']);
const provisionalRelationshipTypes = new Set(['inducted_by_candidate', 'legacy_related_candidate', 'related_to']);

export function canonicalPersonEntityId(inducteeId: string) {
  return `person:${inducteeId}`;
}

export function inducteeIdFromPersonEntityId(entityId: string) {
  return entityId.startsWith('person:') && entityId.length > 'person:'.length
    ? entityId.slice('person:'.length)
    : null;
}

export function isBaseProfileEligible(value: unknown): value is Pick<Inductee, 'id' | 'name'> {
  const record = asRecord(value);
  return nonEmptyString(record.id) && nonEmptyString(record.name);
}

export function isExplicitlyPublished(value: unknown, target: VisitorContentTarget) {
  const record = asRecord(value);
  return isApprovedReview(record.review) && publicationAllowsTarget(record.publication, target);
}

export function isApprovedReview(value: unknown): value is ContentReview {
  const review = asRecord(value);
  return review.status === 'approved'
    && nonEmptyString(review.decisionReference)
    && nonEmptyString(review.contentVersion);
}

export function publicationAllowsTarget(value: unknown, target: VisitorContentTarget): value is PublicationTargets {
  const publication = asRecord(value);
  if (publication.staffOnly === true) return false;
  return target === 'public' ? publication.publicWeb === true : publication.kiosk === true;
}

export function isPublishedStoryBeat(value: unknown, target: VisitorContentTarget): value is StoryBeat {
  const beat = asRecord(value);
  if (!nonEmptyString(beat.id) || !nonEmptyString(beat.headline) || !nonEmptyString(beat.body)) return false;
  if (beat.provenance === 'inferred') return false;

  if (beat.review !== undefined || beat.publication !== undefined) {
    return isExplicitlyPublished(beat, target) && validEvidenceList(beat.evidence);
  }

  return beat.reviewStatus === 'approved' && nonEmptyString(beat.sourceReference);
}

export function filterStorySectionsForTarget(value: unknown, target: VisitorContentTarget) {
  const document = asRecord(value);
  const records = asRecord(document.records);
  const publishedRecords = Object.fromEntries(Object.entries(records).flatMap(([id, rawRecord]) => {
    const record = asRecord(rawRecord);
    const beats = Array.isArray(record.beats)
      ? record.beats.filter((beat) => isPublishedStoryBeat(beat, target)).map(publicStoryBeat)
      : [];
    if (beats.length === 0) return [];
    const inducteeId = nonEmptyString(record.inducteeId) ? record.inducteeId : id;
    return [[id, {
      inducteeId,
      provenance: record.provenance,
      updatedAt: record.updatedAt,
      beats,
    }]];
  }));

  return {
    schemaVersion: typeof document.schemaVersion === 'number' ? document.schemaVersion : 1,
    source: publicSourceSummary(document.source),
    records: publishedRecords,
  };
}

export function isPublishedArchiveLead(value: unknown, target: VisitorContentTarget): value is ArchiveLead {
  const record = asRecord(value);
  if (record.status !== 'visitor-ready' || record.visibility !== 'visitor-ready') return false;
  if (!nonEmptyString(record.inducteeId) || !nonEmptyString(record.title) || !nonEmptyString(record.displayText)) return false;

  if (record.review !== undefined || record.publication !== undefined) {
    return isExplicitlyPublished(record, target);
  }

  return target === 'public' ? record.approvedForPublicWeb === true : record.approvedForKiosk === true;
}

export function filterArchiveLeadsForTarget(value: unknown, target: VisitorContentTarget) {
  const document = asRecord(value);
  const records = Array.isArray(document.records)
    ? document.records.filter((record) => isPublishedArchiveLead(record, target)).map(publicArchiveLead)
    : [];

  return {
    schemaVersion: typeof document.schemaVersion === 'number' ? document.schemaVersion : 1,
    generatedAt: document.generatedAt,
    source: publicSourceSummary(document.source),
    summary: {
      total: records.length,
      visitorReady: records.length,
      staffReview: 0,
    },
    records,
  };
}

export function filterPlacesForTarget(value: unknown, target: VisitorContentTarget) {
  const document = asRecord(value);
  const places = Array.isArray(document.places)
    ? document.places.filter((place) => isExplicitlyPublished(place, target)).map(publicPlace)
    : [];
  return {
    schemaVersion: document.schemaVersion ?? 1,
    source: publicSourceSummary(document.source),
    placeTypes: Array.isArray(document.placeTypes) ? document.placeTypes : [],
    places,
  };
}

export function isEntityPublishedForTarget(value: unknown, target: VisitorContentTarget) {
  const entity = asRecord(value);
  const attributes = asRecord(entity.attributes);
  if (!nonEmptyString(entity.id) || !nonEmptyString(entity.displayName) || attributes.candidateEntity === true) return false;
  if (entity.review !== undefined || entity.publication !== undefined) return isExplicitlyPublished(entity, target);
  if (legacySafeEntityTypes.has(String(entity.type))) return true;
  if (entity.type === 'Event' && attributes.generatedFromLegacyClassYear === true) return true;
  if (entity.type === 'Media') return true;
  return false;
}

export function isEntityRelationshipPublishedForTarget(value: unknown, target: VisitorContentTarget) {
  const relationship = asRecord(value);
  if (!nonEmptyString(relationship.id) || provisionalRelationshipTypes.has(String(relationship.type))) return false;
  if (relationship.review !== undefined || relationship.publication !== undefined) {
    return isExplicitlyPublished(relationship, target) && validEvidenceList(relationship.evidence);
  }
  return asRecord(relationship.provenance).source === 'legacy-inductee-adapter'
    && legacySafeRelationshipTypes.has(String(relationship.type));
}

export function filterRuntimeEnrichmentForTarget(value: unknown, target: VisitorContentTarget) {
  const bundle = asRecord(value);
  return {
    ...bundle,
    storySections: filterStorySectionsForTarget(bundle.storySections, target),
    archiveLeads: filterArchiveLeadsForTarget(bundle.archiveLeads, target),
    places: filterPlacesForTarget(bundle.places, target),
    contentContract: {
      ...asRecord(bundle.contentContract),
      publicationTarget: target,
      baseProfileCompatibility: 'legacy-id-and-name-v1',
      enrichmentPolicy: 'explicit-review-and-target-v1',
    },
  };
}

export type RuntimeBundleExpectations = {
  /** Schema version this artifact was built for. A mismatch is refused, not coerced. */
  schemaVersion: number;
};

export type RuntimeBundleValidation =
  | { ok: true; bundle: JsonRecord; contentRevision: string }
  | { ok: false; reasons: string[] };

/**
 * Gate for any runtime bundle that did not come from this artifact's own build.
 *
 * The build filters content at `vite.config.ts`. Anything reaching the loader
 * afterwards — a staff import, a restored cache — has not been through that
 * gate, so it goes through the same selectors here. The bundle is *filtered*
 * rather than merely inspected, so an import carrying unreviewed enrichment is
 * reduced to what the build would have published instead of being trusted or
 * rejected wholesale.
 *
 * Refusals name their reason. A bundle with no recognised revision cannot be
 * identified later and is refused for that alone.
 */
export function validateRuntimeBundleForTarget(
  value: unknown,
  target: VisitorContentTarget,
  expectations: RuntimeBundleExpectations,
): RuntimeBundleValidation {
  const reasons: string[] = [];
  const record = asRecord(value);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reasons: ['The file is not a runtime data bundle object.'] };
  }

  const inductees = Array.isArray(record.inductees) ? record.inductees : null;
  if (!inductees) {
    reasons.push('The bundle has no inductees array.');
  } else if (!inductees.some(isBaseProfileEligible)) {
    reasons.push('The bundle contains no person with both a canonical id and a name.');
  }

  const schemaVersion = typeof record.schemaVersion === 'number' ? record.schemaVersion : null;
  if (schemaVersion !== expectations.schemaVersion) {
    reasons.push(`The bundle declares schema version ${schemaVersion ?? 'none'}; this build reads version ${expectations.schemaVersion}.`);
  }

  const contentRevision = asRecord(record.contentContract).contentRevision;
  if (!nonEmptyString(contentRevision)) {
    reasons.push('The bundle carries no content revision, so what it contains could not be identified later.');
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const bundle = asRecord(filterRuntimeEnrichmentForTarget(record, target));
  const issues = validatePublishedRuntimeReferences(bundle);
  if (issues.length > 0) {
    return { ok: false, reasons: [`The bundle has ${issues.length} unresolved reference${issues.length === 1 ? '' : 's'} after filtering.`, ...issues.slice(0, 5)] };
  }

  return { ok: true, bundle, contentRevision: String(contentRevision) };
}

export function validatePublishedRuntimeReferences(value: unknown) {
  const bundle = asRecord(value);
  const issues: string[] = [];
  const personIds = new Set((Array.isArray(bundle.inductees) ? bundle.inductees : [])
    .filter(isBaseProfileEligible).map((person) => String(asRecord(person).id)));
  const entityDocument = asRecord(bundle.entities);
  const entityIds = new Set((Array.isArray(entityDocument.entities) ? entityDocument.entities : [])
    .map((entity) => String(asRecord(entity).id)).filter(Boolean));

  const storyRecords = asRecord(asRecord(bundle.storySections).records);
  Object.entries(storyRecords).forEach(([recordId, rawRecord]) => {
    const record = asRecord(rawRecord);
    const inducteeId = String(record.inducteeId || recordId);
    if (!personIds.has(inducteeId)) issues.push(`Story record ${recordId} references missing person ${inducteeId}.`);
    for (const rawBeat of Array.isArray(record.beats) ? record.beats : []) {
      const beat = asRecord(rawBeat);
      if (nonEmptyString(beat.relatedPersonId) && !personIds.has(beat.relatedPersonId)) {
        issues.push(`Story beat ${recordId}/${String(beat.id)} references missing person ${beat.relatedPersonId}.`);
      }
      for (const entityId of Array.isArray(beat.relatedEntityIds) ? beat.relatedEntityIds : []) {
        if (typeof entityId === 'string' && !entityIds.has(entityId)) {
          issues.push(`Story beat ${recordId}/${String(beat.id)} references missing entity ${entityId}.`);
        }
      }
    }
  });

  const archiveRecords = Array.isArray(asRecord(bundle.archiveLeads).records) ? asRecord(bundle.archiveLeads).records as unknown[] : [];
  archiveRecords.forEach((rawRecord) => {
    const record = asRecord(rawRecord);
    if (nonEmptyString(record.inducteeId) && !personIds.has(record.inducteeId)) {
      issues.push(`Archive record ${String(record.id)} references missing person ${record.inducteeId}.`);
    }
  });

  const relationshipDocument = asRecord(bundle.entityRelationships);
  for (const rawRelationship of Array.isArray(relationshipDocument.relationships) ? relationshipDocument.relationships : []) {
    const relationship = asRecord(rawRelationship);
    if (!entityIds.has(String(relationship.sourceEntityId)) || !entityIds.has(String(relationship.targetEntityId))) {
      issues.push(`Entity relationship ${String(relationship.id)} has a missing endpoint.`);
    }
  }

  return issues;
}

function publicStoryBeat(value: unknown) {
  const beat = asRecord(value);
  const { review: _review, publication: _publication, reviewStatus: _reviewStatus, ...published } = beat;
  return published;
}

function publicArchiveLead(value: unknown) {
  const record = asRecord(value);
  const {
    review: _review,
    publication: _publication,
    candidateUse: _candidateUse,
    reviewAction: _reviewAction,
    priority: _priority,
    labels: _labels,
    ...published
  } = record;
  return published;
}

function publicPlace(value: unknown) {
  const place = asRecord(value);
  const { review: _review, publication: _publication, staffNotes: _staffNotes, ...published } = place;
  return published;
}

function publicSourceSummary(value: unknown) {
  const source = asRecord(value);
  const summary: JsonRecord = {};
  for (const key of ['name', 'updatedAt', 'note']) {
    if (typeof source[key] === 'string') summary[key] = source[key];
  }
  return summary;
}

function validEvidenceList(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(isEvidenceReference);
}

function isEvidenceReference(value: unknown): value is EvidenceReference {
  const evidence = asRecord(value);
  return nonEmptyString(evidence.id)
    && nonEmptyString(evidence.title)
    && nonEmptyString(evidence.kind)
    && (nonEmptyString(evidence.url) || nonEmptyString(evidence.localCitation));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
