export type SourceCurationPacket = {
  schemaVersion?: number;
  source?: {
    generatedAt?: string;
    originalSite?: string;
    note?: string;
    [key: string]: unknown;
  };
  guardrails?: Record<string, string>;
  summary?: {
    sourceProfiles?: {
      resolved?: number;
      unresolved?: number;
      duplicateGroups?: number;
    };
    mediaReviewDrafts?: {
      total?: number;
      newSources?: number;
      highConfidenceNewSources?: number;
    };
    videoReviewDrafts?: {
      total?: number;
      newSources?: number;
    };
    relationshipReviewDrafts?: {
      total?: number;
      resolvedInductionLinks?: number;
      weakPairCandidates?: number;
    };
    placeReviewDrafts?: {
      total?: number;
      nonDirectional?: number;
    };
    organizationReviewDrafts?: {
      total?: number;
    };
    storySectionReviewDrafts?: {
      total?: number;
      primaryLeads?: number;
    };
    [key: string]: unknown;
  };
  curationIndex?: SourceCurationIndexRow[];
  sourceProfileReferences?: SourceProfileReference[];
  profileUrlAliasDrafts?: SourceProfileAliasDraft[];
  duplicateSourceGroups?: SourceDuplicateSourceGroup[];
  mediaReviewDrafts?: SourceMediaReviewDraft[];
  videoReviewDrafts?: SourceVideoReviewDraft[];
  relationshipReviewDrafts?: SourceRelationshipReviewDraft[];
  placeReviewDrafts?: SourcePlaceReviewDraft[];
  placePhraseReviewDrafts?: SourcePlacePhraseReviewDraft[];
  organizationReviewDrafts?: SourceOrganizationReviewDraft[];
  storySectionReviewDrafts?: SourceStorySectionReviewDraft[];
  classEvidenceReviewDrafts?: SourceClassEvidenceReviewDraft[];
  unresolvedSourceRecords?: SourceUnresolvedRecord[];
};

export type SourceCurationIndexRow = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  region?: string;
  primarySourceProfileUrl?: string;
  sourceProfileCount?: number;
  newImageReviewCount?: number;
  newProfileVideoReviewCount?: number;
  newContextVideoReviewCount?: number;
  relationshipReviewCount?: number;
  placeReviewCount?: number;
  organizationReviewCount?: number;
  primaryStoryLeadCount?: number;
  reviewPriority?: string;
  manualFlags?: string[];
  nextBestAction?: string;
};

export type SourceProfileReference = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  sourceUrl?: string;
  canonicalUrl?: string;
  sourceTitle?: string;
  sourceModified?: string;
  matchType?: string;
  confidence?: number;
  sourceRegionCandidates?: string[];
  sourceClassYearCandidates?: number[];
  reviewAction?: string;
};

export type SourceProfileAliasDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  currentProfileUrl?: string;
  alternateSourceUrl?: string;
  sourceTitle?: string;
  matchType?: string;
  confidence?: number;
  reviewAction?: string;
  publishStatus?: string;
};

export type SourceDuplicateSourceGroup = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  sources?: SourceProfileReference[];
};

export type SourceMediaReviewDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  mediaType?: string;
  roleCandidate?: string;
  confidence?: number;
  sourceUrl?: string;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
  alreadyInMediaManifest?: boolean;
  rightsStatus?: string;
  reviewAction?: string;
};

export type SourceVideoReviewDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  youtubeVideoId?: string;
  sourceUrl?: string;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  assignment?: string;
  confidence?: number;
  alreadyInMediaManifest?: boolean;
  rightsStatus?: string;
  reviewAction?: string;
};

export type SourceRelationshipReviewDraft = {
  sourcePersonId?: string;
  sourcePersonName?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  targetDisplayName?: string;
  type?: string;
  displayLabel?: string;
  provenanceCandidate?: string;
  confidence?: number;
  evidenceCount?: number;
  evidenceTypes?: string[];
  sourcePageUrls?: string[];
  referenceNote?: string;
  reviewAction?: string;
  publicUse?: string;
};

export type SourcePlaceReviewDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  placeLabel?: string;
  placeScopeHint?: string;
  confidence?: number;
  evidenceCount?: number;
  evidenceTypes?: string[];
  sourcePageUrls?: string[];
  existingCountryTags?: string[];
  inferredCountryTags?: string[];
  safeguardStatus?: string;
  migrationDirection?: string;
  reviewAction?: string;
  publicUse?: string;
};

export type SourcePlacePhraseReviewDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  phraseLabel?: string;
  phraseQuality?: string;
  confidence?: number;
  evidenceCount?: number;
  sourcePageUrls?: string[];
  existingCountryTags?: string[];
  inferredCountryTags?: string[];
  safeguardStatus?: string;
  migrationDirection?: string;
  reviewAction?: string;
  publicUse?: string;
};

export type SourceOrganizationReviewDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  organizationName?: string;
  confidence?: number;
  evidenceCount?: number;
  sourcePageUrls?: string[];
  reviewAction?: string;
  publicUse?: string;
};

export type SourceStorySectionReviewDraft = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  suggestedTheme?: string;
  blockIndex?: number;
  wordCount?: number;
  excerpt?: string;
  candidateUse?: string;
  copyrightNote?: string;
  reviewAction?: string;
  priority?: string;
};

export type SourceClassEvidenceReviewDraft = {
  sourceKind?: string;
  title?: string;
  sourcePageUrl?: string;
  primaryClassYearCandidates?: number[];
  allClassYearCandidates?: number[];
  imageCount?: number;
  attachedMediaCount?: number;
  youtubeVideoIds?: string[];
  mentionedInducteeCount?: number;
  confidence?: number;
  reviewAction?: string;
};

export type SourceUnresolvedRecord = {
  wpId?: number;
  sourceKind?: string;
  sourceTitle?: string;
  sourceTitleName?: string;
  sourceUrl?: string;
  sourceRegionCandidates?: string[];
  sourceClassYearCandidates?: number[];
  confidence?: number;
  notes?: string[];
  reviewAction?: string;
};

export type SourceCurationState = {
  packet: SourceCurationPacket | null;
  loading: boolean;
  error: string;
};

export function emptySourceCurationPacket(): SourceCurationPacket {
  return {
    schemaVersion: 1,
    source: {
      note: 'No original-site pre-curation packet was loaded.',
    },
    guardrails: {
      mediaRights: 'Source leads are review aids only and do not approve media rights.',
      relationships: 'Relationship leads require curator approval before public use.',
      geography: 'Place leads are textual evidence only. Migration direction is never inferred.',
      storyText: 'Story excerpts are source pointers for curator rewriting, not publication-ready text.',
    },
    summary: {},
    curationIndex: [],
    sourceProfileReferences: [],
    profileUrlAliasDrafts: [],
    duplicateSourceGroups: [],
    mediaReviewDrafts: [],
    videoReviewDrafts: [],
    relationshipReviewDrafts: [],
    placeReviewDrafts: [],
    placePhraseReviewDrafts: [],
    organizationReviewDrafts: [],
    storySectionReviewDrafts: [],
    classEvidenceReviewDrafts: [],
    unresolvedSourceRecords: [],
  };
}

export function normalizeSourceCurationPacket(packet: SourceCurationPacket | null | undefined): SourceCurationPacket {
  const fallback = emptySourceCurationPacket();
  if (!packet || typeof packet !== 'object') return fallback;
  return {
    ...fallback,
    ...packet,
    source: typeof packet.source === 'object' && packet.source ? packet.source : fallback.source,
    guardrails: typeof packet.guardrails === 'object' && packet.guardrails ? packet.guardrails : fallback.guardrails,
    summary: typeof packet.summary === 'object' && packet.summary ? packet.summary : fallback.summary,
    curationIndex: Array.isArray(packet.curationIndex) ? packet.curationIndex : [],
    sourceProfileReferences: Array.isArray(packet.sourceProfileReferences) ? packet.sourceProfileReferences : [],
    profileUrlAliasDrafts: Array.isArray(packet.profileUrlAliasDrafts) ? packet.profileUrlAliasDrafts : [],
    duplicateSourceGroups: Array.isArray(packet.duplicateSourceGroups) ? packet.duplicateSourceGroups : [],
    mediaReviewDrafts: Array.isArray(packet.mediaReviewDrafts) ? packet.mediaReviewDrafts : [],
    videoReviewDrafts: Array.isArray(packet.videoReviewDrafts) ? packet.videoReviewDrafts : [],
    relationshipReviewDrafts: Array.isArray(packet.relationshipReviewDrafts) ? packet.relationshipReviewDrafts : [],
    placeReviewDrafts: Array.isArray(packet.placeReviewDrafts) ? packet.placeReviewDrafts : [],
    placePhraseReviewDrafts: Array.isArray(packet.placePhraseReviewDrafts) ? packet.placePhraseReviewDrafts : [],
    organizationReviewDrafts: Array.isArray(packet.organizationReviewDrafts) ? packet.organizationReviewDrafts : [],
    storySectionReviewDrafts: Array.isArray(packet.storySectionReviewDrafts) ? packet.storySectionReviewDrafts : [],
    classEvidenceReviewDrafts: Array.isArray(packet.classEvidenceReviewDrafts) ? packet.classEvidenceReviewDrafts : [],
    unresolvedSourceRecords: Array.isArray(packet.unresolvedSourceRecords) ? packet.unresolvedSourceRecords : [],
  };
}
