export type PhysicalWallCoordinates = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  unit?: 'grid' | 'percent' | 'pixels' | 'inches';
};

export type Inductee = {
  id: string;
  name: string;
  classYear: number | null;
  decade: string;
  region: string;
  profileUrl: string;
  inductedBy: string;
  primaryImageUrl: string;
  imageUrls: string[];
  videoUrls: string[];
  youtubeVideoIds: string[];
  localVideoPaths: string[];
  localImagePaths: string[];
  hasVideo: boolean;
  hasGallery: boolean;
  bioText: string;
  storySummary: string;
  storySummarySource: string;
  documentedContextLine: string;
  honoredForSummary: string;
  lifeWorkSummary: string;
  storyHighlights: string[];
  themeTags: string[];
  themeTagsSource: string;
  countryTags: string[];
  countryTagsSource: string;
  countryTagsNote: string;
  communityTags: string[];
  sortName: string;
  pronunciation: string;
  imageAltText: string;
  approvalStatus: string;
  reviewPriority: string;
  featured: boolean;
  featuredCandidate: boolean;
  attractPriority: number;
  mediaReviewStatus: string;
  imageRightsStatus: string;
  videoRightsStatus: string;
  relatedIds: string[];
  physicalRow: number | null;
  physicalColumn: number | null;
  physicalPanel: string;
  wallLabel: string;
  wallCoordinates: PhysicalWallCoordinates | null;
  physicalPortraitPresent: boolean;
  searchText: string;
};

export type HallLens = 'portraits' | 'traces' | 'journeys' | 'legacies';
export type HallFocus = { personId: string } | null;
export type HallLinkedPathKind = 'class' | 'heritage' | 'community' | 'theme' | 'person';
export type HallLinkedPath = {
  kind: HallLinkedPathKind;
  label: string;
  detail: string;
  personIds: string[];
  lens: HallLens;
  focusPersonId?: string;
  timelineYear?: string;
  traceFocusKey?: string;
};
export type ViewMode = 'living-hall' | 'person' | 'connections' | 'world' | 'time' | 'review';
export type RelationshipType =
  | 'inducted_by'
  | 'same_class'
  | 'shared_theme'
  | 'shared_organization'
  | 'shared_community'
  | 'civic_collaboration'
  | 'mentor'
  | 'colleague'
  | 'family'
  | 'related_place'
  | 'related_event';
export type RelationshipProvenance = 'documented' | 'curated' | 'inferred';
export type RelationshipEntityType = 'person' | 'organization' | 'place' | 'community' | 'event' | 'theme' | 'media';

export type RelationshipRecord = {
  sourcePersonId: string;
  targetEntityId: string;
  targetEntityType?: RelationshipEntityType;
  targetDisplayName?: string;
  type: RelationshipType;
  displayLabel: string;
  referenceNote?: string;
  provenance: RelationshipProvenance;
};

export type EntityType = 'Person' | 'Community' | 'Place' | 'Organization' | 'Event' | 'Theme' | 'Media';
export type EntityProvenance = {
  source: string;
  confidence: RelationshipProvenance;
  sourceRecordId?: string;
  sourceField?: string;
  note?: string;
};

export type EntityMediaReference = {
  entityId?: string;
  kind: 'image' | 'video' | 'audio' | 'document';
  role?: string;
  url?: string;
  altText?: string;
};

export type EntityDateRange = {
  start?: string;
  end?: string;
  label?: string;
};

export type EntityLocation = {
  displayName: string;
  region?: string;
};

export type EntityRecord = {
  id: string;
  displayName: string;
  type: EntityType;
  shortDescription: string;
  media?: EntityMediaReference[];
  dateRange?: EntityDateRange;
  location?: EntityLocation;
  provenance: EntityProvenance;
  attributes?: Record<string, unknown>;
};

export type EntityRelationshipType =
  | 'has_theme'
  | 'member_of_community'
  | 'associated_with_place'
  | 'associated_with_organization'
  | 'participated_in_event'
  | 'inducted_by_candidate'
  | 'inducted_in_class'
  | 'has_media'
  | 'legacy_related_candidate'
  | 'related_to';

export type EntityRelationshipRecord = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: EntityRelationshipType;
  displayLabel: string;
  shortDescription?: string;
  provenance: EntityProvenance;
  attributes?: Record<string, unknown>;
};

export type StoryBeatType =
  | 'early_life'
  | 'arrival'
  | 'building_community'
  | 'work'
  | 'struggle'
  | 'leadership'
  | 'legacy'
  | 'memory'
  | 'recognition';

export type StoryBeat = {
  id: string;
  type?: StoryBeatType;
  headline: string;
  body: string;
  imageUrl?: string;
  imageAltText?: string;
  quote?: string;
  place?: string;
  organization?: string;
  relatedPersonId?: string;
  timelineMarker?: string;
  provenance?: RelationshipProvenance;
};

export type StorySectionRecord = {
  inducteeId: string;
  provenance: RelationshipProvenance;
  updatedAt?: string;
  curatorNotes?: string[];
  beats: StoryBeat[];
};

export type ArchiveLeadStatus =
  | 'catalog-lead'
  | 'requested'
  | 'viewed'
  | 'rights-pending'
  | 'visitor-ready';

export type ArchiveLeadVisibility = 'staff-review' | 'visitor-ready';
export type ArchiveConnectionStrength = 'direct' | 'institutional' | 'contextual';

export type ArchiveLead = {
  id: string;
  inducteeId: string;
  inducteeName?: string;
  classYear?: number | null;
  title: string;
  repository: string;
  collectionTitle?: string;
  callNumber?: string;
  sourceUrl?: string;
  sourcePageTitle?: string;
  sourceType?: string;
  displayText: string;
  candidateUse?: string;
  rightsNote?: string;
  creditLine?: string;
  reviewAction?: string;
  status: ArchiveLeadStatus;
  visibility: ArchiveLeadVisibility;
  connectionStrength: ArchiveConnectionStrength;
  priority?: string;
  iiifManifestUrl?: string;
  imageUrl?: string;
  imageAltText?: string;
  labels?: string[];
};

export type ArchiveLeadDocument = {
  schemaVersion: number;
  generatedAt?: string;
  source?: {
    name?: string;
    note?: string;
  };
  guardrails?: Record<string, string>;
  summary?: {
    total?: number;
    visitorReady?: number;
    staffReview?: number;
    byStatus?: Record<string, number>;
    byConnectionStrength?: Record<string, number>;
  };
  records: ArchiveLead[];
};

export type StoryLensConfig = {
  id: string;
  label: string;
  prompt: string;
  description: string;
  terms: string[];
  themes: string[];
  pinnedPersonIds?: string[];
  excludedPersonIds?: string[];
  curatorNotes?: string[];
  reviewStatus?: 'draft' | 'reviewed' | 'approved';
  maxPortraits?: number;
  enabled?: boolean;
};

export type StoryLensDocument = {
  schemaVersion: number;
  updatedAt?: string;
  source?: {
    name?: string;
    note?: string;
  };
  lenses: StoryLensConfig[];
};

export type MediaAssetProvenance = {
  source?: string;
  confidence?: RelationshipProvenance;
  note?: string;
};

export type MediaTranscriptReference = {
  label?: string;
  runtimePath?: string;
  text?: string;
  status?: string;
};

export type RuntimeVideoAsset = {
  sourceUrl?: string;
  youtubeVideoId?: string;
  filePath?: string;
  runtimePath?: string;
  posterFilePath?: string;
  posterRuntimePath?: string;
  captionFilePath?: string;
  captionRuntimePath?: string;
  transcriptFilePath?: string;
  transcriptRuntimePath?: string;
  transcript?: MediaTranscriptReference;
  durationSeconds?: number | null;
  codec?: string;
  rightsStatus?: string;
  captionStatus?: string;
  transcriptStatus?: string;
  audioDescriptionStatus?: string;
  approvedForKiosk?: boolean;
  title?: string;
  description?: string;
  provenance?: MediaAssetProvenance;
};

export type RuntimeAudioAsset = {
  sourceUrl?: string;
  filePath?: string;
  runtimePath?: string;
  posterFilePath?: string;
  posterRuntimePath?: string;
  captionFilePath?: string;
  captionRuntimePath?: string;
  transcriptFilePath?: string;
  transcriptRuntimePath?: string;
  transcript?: MediaTranscriptReference;
  durationSeconds?: number | null;
  codec?: string;
  rightsStatus?: string;
  captionStatus?: string;
  transcriptStatus?: string;
  audioDescriptionStatus?: string;
  approvedForKiosk?: boolean;
  title?: string;
  description?: string;
  provenance?: MediaAssetProvenance;
};

export type RuntimeImageAsset = {
  sourceUrl?: string;
  filePath?: string;
  runtimePath?: string;
  checksumSha256?: string;
  width?: number;
  height?: number;
  altText?: string;
  caption?: string;
  primary?: boolean;
  rightsStatus?: string;
  approvedForKiosk?: boolean;
  title?: string;
  description?: string;
  provenance?: MediaAssetProvenance;
};

export type RuntimeMediaRecord = {
  id: string;
  name?: string;
  classYear?: number | null;
  countryTags?: string[];
  countryTagsSource?: string;
  countryTagsNote?: string;
  region?: string;
  approvalStatus?: string;
  reviewPriority?: string;
  images?: {
    primary?: RuntimeImageAsset | null;
    gallery?: RuntimeImageAsset[];
  };
  videos?: RuntimeVideoAsset[];
  audio?: RuntimeAudioAsset[];
  oralHistories?: RuntimeAudioAsset[];
  provenance?: MediaAssetProvenance;
};
