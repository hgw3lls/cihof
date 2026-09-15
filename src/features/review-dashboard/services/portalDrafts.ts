import type { Inductee, RelationshipProvenance, RelationshipType } from '../../../data/types';

export type RelationshipReviewStatus = 'approved' | 'hidden' | 'needs-research';

export type ReviewDraft = {
  id: string;
  updatedAt: string;
  approvalStatus?: string;
  reviewPriority?: string;
  displayName?: string;
  sortName?: string;
  pronunciation?: string;
  approvedSummary?: string;
  documentedContextLine?: string;
  honoredForSummary?: string;
  lifeWorkSummary?: string;
  approvedThemeTags?: string[];
  approvedCountryTags?: string[];
  countryNotes?: string;
  approvedCommunityTags?: string[];
  featured?: boolean;
  featuredCandidate?: boolean;
  attractPriority?: number;
  approveProfile?: boolean;
  summaryApproved?: boolean;
  themeTagsApproved?: boolean;
  countryTagsApproved?: boolean;
  communityTagsApproved?: boolean;
  primaryImageAltText?: string;
  imageRightsStatus?: string;
  imageRightsApproved?: boolean;
  videoRightsStatus?: string;
  videoRightsApproved?: boolean;
  captionStatus?: string;
  captionsApproved?: boolean;
  transcriptStatus?: string;
  transcriptApproved?: boolean;
  accessibilityApproved?: boolean;
  plainLanguageReview?: string;
  sensitiveContentReview?: string;
  imageDescriptionReview?: string;
  curatorNotes?: string[];
  mediaNotes?: string[];
  imageSourceUrl?: string;
  videoSourceUrls?: string[];
  youtubeVideoIds?: string[];
};

export type DraftMap = Record<string, ReviewDraft>;
export type DraftPatch = Partial<Omit<ReviewDraft, 'id' | 'updatedAt'>>;

export type RelationshipDraft = {
  id: string;
  updatedAt: string;
  reviewStatus?: RelationshipReviewStatus;
  displayLabel?: string;
  referenceNote?: string;
  curatorNote?: string;
  provenanceOverride?: RelationshipProvenance;
  typeOverride?: RelationshipType;
};

export type RelationshipDraftMap = Record<string, RelationshipDraft>;
export type RelationshipDraftPatch = Partial<Omit<RelationshipDraft, 'id' | 'updatedAt'>>;

export type DraftStorageResult = {
  ok: boolean;
  message: string;
  savedAt?: string;
};

export const draftStorageKey = 'cihof.portal.reviewDrafts.v1';
export const relationshipDraftStorageKey = 'cihof.portal.relationshipDrafts.v1';

export const relationshipTypeOptions: RelationshipType[] = [
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

export const relationshipTypeValues = new Set<RelationshipType>(relationshipTypeOptions);
export const relationshipReviewStatusValues = new Set<RelationshipReviewStatus>(['approved', 'hidden', 'needs-research']);

const relationshipProvenanceValues = new Set<RelationshipProvenance>(['documented', 'curated', 'inferred']);

export function loadStoredDrafts(): DraftMap {
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return {};
    return normalizeDraftPayload(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function persistDrafts(drafts: DraftMap): DraftStorageResult {
  const count = Object.keys(drafts).length;

  try {
    if (count === 0) {
      window.localStorage.removeItem(draftStorageKey);
      return { ok: true, message: 'No local drafts' };
    }

    window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
    const savedAt = new Date().toISOString();
    return { ok: true, message: `Saved ${count} local draft${count === 1 ? '' : 's'} at ${formatDraftClock(savedAt)}`, savedAt };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not save local portal drafts.',
    };
  }
}

export function loadStoredRelationshipDrafts(): RelationshipDraftMap {
  try {
    const raw = window.localStorage.getItem(relationshipDraftStorageKey);
    if (!raw) return {};
    return normalizeRelationshipDraftPayload(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function persistRelationshipDrafts(drafts: RelationshipDraftMap): DraftStorageResult {
  const count = Object.keys(drafts).length;

  try {
    if (count === 0) {
      window.localStorage.removeItem(relationshipDraftStorageKey);
      return { ok: true, message: 'No relationship drafts' };
    }

    window.localStorage.setItem(relationshipDraftStorageKey, JSON.stringify(drafts));
    const savedAt = new Date().toISOString();
    return { ok: true, message: `Saved ${count} relationship draft${count === 1 ? '' : 's'} at ${formatDraftClock(savedAt)}`, savedAt };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not save relationship review drafts.',
    };
  }
}

export function normalizeRelationshipDraftPayload(payload: unknown): RelationshipDraftMap {
  const source = getRelationshipDraftRecordSource(payload);
  if (!source) return {};

  return Object.fromEntries(
    Object.entries(source)
      .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
      .map(([id, value]) => {
        const draft = value as Partial<RelationshipDraft>;
        const normalized: RelationshipDraft = {
          id,
          updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : new Date().toISOString(),
        };
        const reviewStatus = relationshipStatusValue(cleanPortalString(draft.reviewStatus));
        if (reviewStatus) normalized.reviewStatus = reviewStatus;
        if (relationshipProvenanceValues.has(draft.provenanceOverride as RelationshipProvenance)) {
          normalized.provenanceOverride = draft.provenanceOverride as RelationshipProvenance;
        }
        if (relationshipTypeValues.has(draft.typeOverride as RelationshipType)) {
          normalized.typeOverride = draft.typeOverride as RelationshipType;
        }
        if (cleanPortalString(draft.displayLabel)) normalized.displayLabel = cleanPortalString(draft.displayLabel);
        if (cleanPortalString(draft.referenceNote)) normalized.referenceNote = cleanPortalString(draft.referenceNote);
        if (cleanPortalString(draft.curatorNote)) normalized.curatorNote = cleanPortalString(draft.curatorNote);
        return [id, normalized];
      })
      .filter(([, draft]) => isMeaningfulRelationshipDraft(draft as RelationshipDraft)),
  );
}

export function normalizeDraftPayload(payload: unknown, inductees: Inductee[] = []): DraftMap {
  const source = getDraftRecordSource(payload);
  if (!source) throw new Error('Draft JSON must contain a drafts or records object.');

  const validIds = inductees.length > 0 ? new Set(inductees.map((item) => item.id)) : null;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([id, value]) => (!validIds || validIds.has(id)) && value && typeof value === 'object' && !Array.isArray(value))
      .map(([id, value]) => {
        const draft = value as Partial<ReviewDraft>;
        return [id, { ...draft, id, updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : new Date().toISOString() }];
      })
      .filter(([, draft]) => isMeaningfulDraft(draft as ReviewDraft)),
  );
}

export function getDraftRecordSource(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const objectPayload = payload as { drafts?: unknown; profileDrafts?: unknown; records?: unknown; relationshipDrafts?: unknown; source?: unknown };
  if (objectPayload.relationshipDrafts && !objectPayload.profileDrafts) return {};
  if (typeof objectPayload.source === 'string' && objectPayload.source.toLowerCase().includes('relationship review')) return {};
  const source = objectPayload.profileDrafts ?? objectPayload.drafts ?? objectPayload.records ?? payload;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  return source as Record<string, unknown>;
}

export function getRelationshipDraftRecordSource(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const objectPayload = payload as { drafts?: unknown; relationshipDrafts?: unknown; records?: unknown };
  const source = objectPayload.relationshipDrafts ?? objectPayload.drafts ?? objectPayload.records ?? payload;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  return source as Record<string, unknown>;
}

export function isMeaningfulDraft(draft: ReviewDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (key === 'id' || key === 'updatedAt' || value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

export function isMeaningfulRelationshipDraft(draft: RelationshipDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (key === 'id' || key === 'updatedAt' || value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
}

function relationshipStatusValue(value: string) {
  return relationshipReviewStatusValues.has(value as RelationshipReviewStatus) ? value as RelationshipReviewStatus : undefined;
}

function cleanPortalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDraftClock(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
