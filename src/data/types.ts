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
  communityTagsSource: string;
  sortName: string;
  pronunciation: string;
  imageAltText: string;
  imageFocalPoint: string;
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

export type ContentReviewStatus = 'draft' | 'needs-review' | 'approved' | 'withheld';
export type ContentReview = {
  status: ContentReviewStatus;
  decisionReference?: string;
  reviewedAt?: string;
  contentVersion?: string;
  note?: string;
};

export type PublicationTargets = {
  publicWeb: boolean;
  kiosk: boolean;
  staffOnly?: boolean;
};

export type EvidenceKind = 'primary-source' | 'secondary-source' | 'catalogue' | 'oral-history' | 'collection-record' | 'other';
export type EvidenceReference = {
  id: string;
  title: string;
  kind: EvidenceKind;
  url?: string;
  localCitation?: string;
  locator?: string;
  excerpt?: string;
};

export type VocabularyKind =
  | 'heritage-cultural-community'
  | 'nationality'
  | 'language-community'
  | 'religious-community'
  | 'organizational-affiliation'
  | 'unresolved-legacy';

export type CommunityAttributes = {
  vocabularyKind: VocabularyKind;
  legacyAliases?: string[];
  sourceWording?: string;
};

export type PlaceGeometry =
  | { kind: 'none' }
  | { kind: 'schematic'; coordinateSystem: string; x: number; y: number; provenance?: EntityProvenance }
  | { kind: 'geographic-point'; longitude: number; latitude: number; provenance: EntityProvenance }
  | { kind: 'geographic-area'; assetId: string; provenance: EntityProvenance };

export type PlaceAssociationRole = 'lived' | 'worked' | 'studied' | 'organized' | 'served' | 'associated';
export type PlaceAttributes = {
  placeKind: string;
  currentName?: string;
  historicalNames?: Array<{ name: string; dateRange?: EntityDateRange }>;
  neighborhoodId?: string;
  address?: string;
  geometry: PlaceGeometry;
  validDateRange?: EntityDateRange;
};

export type EventKind = 'induction' | 'historical-activity' | 'institutional-milestone' | 'contribution';
export type EventAttributes = {
  eventKind: EventKind;
  dateRange: EntityDateRange;
};

export type AffiliationAssertion = {
  id: string;
  personId: string;
  entityId: string;
  vocabularyKind: VocabularyKind;
  sourceWording: string;
  evidence: EvidenceReference[];
  dateRange?: EntityDateRange;
  qualifier?: string;
  provenance: RelationshipProvenance;
  review: ContentReview;
  publication: PublicationTargets;
};

export type RelationshipRecord = {
  id: string;
  sourcePersonId: string;
  targetEntityId: string;
  targetEntityType?: RelationshipEntityType;
  targetDisplayName?: string;
  type: RelationshipType;
  displayLabel: string;
  reverseDisplayLabel?: string;
  referenceNote?: string;
  provenance: RelationshipProvenance;
  presentationKind?: RelationshipPresentationKind;
  evidence?: EvidenceReference[];
  review?: ContentReview;
  publication?: PublicationTargets;
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
  precision?: 'exact-date' | 'year' | 'bounded-interval' | 'approximate-interval' | 'unknown';
  uncertain?: boolean;
  sourceScope?: string;
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
  evidence?: EvidenceReference[];
  review?: ContentReview;
  publication?: PublicationTargets;
  attributes?: Record<string, unknown>;
};

export type RelationshipPresentationKind = 'direct' | 'shared-context' | 'curatorial-comparison' | 'induction-context';

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
  presentationKind?: RelationshipPresentationKind;
  evidence?: EvidenceReference[];
  review?: ContentReview;
  publication?: PublicationTargets;
  dateRange?: EntityDateRange;
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
  contextScope?: 'cleveland';
  reviewStatus?: ContentReviewStatus;
  review?: ContentReview;
  publication?: PublicationTargets;
  evidence?: EvidenceReference[];
  sourceReference?: string;
  sourceUrl?: string;
  type?: StoryBeatType;
  headline: string;
  body: string;
  imageUrl?: string;
  imageAltText?: string;
  quote?: string;
  place?: string;
  organization?: string;
  relatedPersonId?: string;
  relatedEntityIds?: string[];
  eventId?: string;
  dateRange?: EntityDateRange;
  timelineMarker?: string;
  provenance?: RelationshipProvenance;
};

export type StorySectionRecord = {
  inducteeId: string;
  provenance: RelationshipProvenance;
  updatedAt?: string;
  curatorNotes?: string[];
  review?: ContentReview;
  publication?: PublicationTargets;
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
  approvedForPublicWeb?: boolean;
  approvedForKiosk?: boolean;
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
  evidence?: EvidenceReference[];
  review?: ContentReview;
  publication?: PublicationTargets;
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
  approvedForPublicWeb?: boolean;
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
