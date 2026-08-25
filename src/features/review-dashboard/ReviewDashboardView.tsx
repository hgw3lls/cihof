import { ChangeEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import {
  buildConnectionGraph,
  type ConnectionEdge,
  type ConnectionNode,
} from '../../data/connectionGraph';
import { countryOrRegionLabel } from '../../data/inducteeLabels';
import { rankStoryLensMatches, type StoryLensMatch } from '../../data/storyLenses';
import type {
  Inductee,
  RelationshipProvenance,
  RelationshipRecord,
  RelationshipType,
  StoryLensConfig,
  StoryLensDocument,
} from '../../data/types';
import { useRelationships } from '../../data/useRelationships';

type CountEntry = {
  [key: string]: string | number;
  count: number;
};

type CurationReport = {
  generatedAt?: string;
  validation?: {
    errors?: string[];
    warnings?: string[];
  };
  approvalStatus?: CountEntry[];
  reviewPriority?: CountEntry[];
  summaries?: {
    approved?: number;
    draftOnly?: string[];
    truncatedDrafts?: string[];
  };
  themes?: {
    approved?: number;
    candidateOnly?: string[];
  };
  countries?: {
    detected?: number;
    approved?: number;
    inferred?: number;
    generatedOnly?: string[];
    missing?: string[];
    sources?: CountEntry[];
  };
  communities?: {
    approved?: number;
    candidateOnly?: string[];
  };
  featured?: {
    approved?: string[];
    candidates?: string[];
    candidateNotFeatured?: string[];
  };
  media?: {
    captionTranscriptReviewNeeded?: string[];
    videoRightsReviewNeeded?: string[];
    imageRightsReviewNeeded?: string[];
    noVideoLinked?: string[];
  };
  accessibility?: {
    plainLanguageReviewNeeded?: string[];
    sensitiveContentReviewNeeded?: string[];
    imageDescriptionReviewNeeded?: string[];
  };
  priorities?: {
    high?: string[];
    medium?: string[];
    standard?: string[];
  };
};

type MediaReport = {
  generatedAt?: string;
  strictProfile?: string;
  validation?: {
    errors?: string[];
    warnings?: string[];
  };
  strictFailures?: string[];
  summary?: {
    primaryImages?: number;
    primaryImagesWallReady?: number;
    primaryImagesReady?: number;
    galleryImages?: number;
    galleryImagesReady?: number;
    videoItems?: number;
    videosReady?: number;
    missingPrimaryLocalFiles?: string[];
    missingVideoLocalFiles?: string[];
    missingVideoPosters?: string[];
    missingCaptions?: string[];
    missingTranscripts?: string[];
    imageRightsNeedsReview?: string[];
    videoRightsNeedsReview?: string[];
  };
};

type MediaAsset = {
  sourceUrl?: string;
  filePath?: string;
  runtimePath?: string;
  checksumSha256?: string;
  width?: number | null;
  height?: number | null;
  altText?: string;
  rightsStatus?: string;
  approvedForKiosk?: boolean;
};

type VideoAsset = {
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
  checksumSha256?: string;
  durationSeconds?: number | null;
  codec?: string;
  rightsStatus?: string;
  captionStatus?: string;
  transcriptStatus?: string;
  audioDescriptionStatus?: string;
  approvedForKiosk?: boolean;
};

type MediaManifest = {
  assets?: Record<string, {
    images?: {
      primary?: MediaAsset;
      gallery?: MediaAsset[];
    };
    videos?: VideoAsset[];
    notes?: string[];
  }>;
};
type MediaManifestRecord = NonNullable<MediaManifest['assets']>[string];

type SourceCurationPacket = {
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

type SourceCurationIndexRow = {
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

type SourceProfileReference = {
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

type SourceProfileAliasDraft = {
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

type SourceDuplicateSourceGroup = {
  inducteeId?: string;
  inducteeName?: string;
  classYear?: number;
  sources?: SourceProfileReference[];
};

type SourceMediaReviewDraft = {
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

type SourceVideoReviewDraft = {
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

type SourceRelationshipReviewDraft = {
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

type SourcePlaceReviewDraft = {
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

type SourcePlacePhraseReviewDraft = {
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

type SourceOrganizationReviewDraft = {
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

type SourceStorySectionReviewDraft = {
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

type SourceClassEvidenceReviewDraft = {
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

type SourceUnresolvedRecord = {
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

type ReportState = {
  curation: CurationReport | null;
  media: MediaReport | null;
  manifest: MediaManifest | null;
  loading: boolean;
  error: string;
};
type SourceCurationState = {
  packet: SourceCurationPacket | null;
  loading: boolean;
  error: string;
};

type QueueMode =
  | 'all'
  | 'edited'
  | 'high'
  | 'country'
  | 'summary'
  | 'themes'
  | 'image-rights'
  | 'video-captions'
  | 'accessibility'
  | 'featured';
type PortalTab = 'workbench' | 'source' | 'lenses' | 'relationships' | 'readiness' | 'exports';
type SourceQueueMode = 'profiles' | 'media' | 'video' | 'relationships' | 'places' | 'organizations' | 'stories' | 'aliases' | 'classes' | 'unresolved';
type SourceCandidateRow = {
  id: string;
  mode: SourceQueueMode;
  label: string;
  subtitle: string;
  detail: string;
  personId?: string;
  personName?: string;
  sourceUrl?: string;
  sourcePageUrl?: string;
  confidence?: number;
  action?: string;
  fields: Array<{ label: string; value: string }>;
  stageKind: 'profile-note' | 'media-image' | 'video-source' | 'relationship-note' | 'place-note' | 'organization-note' | 'story-note' | 'alias-note' | 'class-note' | 'unresolved-note';
  note: string;
  countryCandidates?: string[];
  imageAltText?: string;
  youtubeVideoId?: string;
};
type RelationshipQueueMode = 'needs-review' | 'inferred' | 'curated' | 'documented' | 'people' | 'entities' | 'approved' | 'hidden' | 'all';
type RelationshipReviewStatus = 'approved' | 'hidden' | 'needs-research';

type ReviewDraft = {
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

type DraftMap = Record<string, ReviewDraft>;
type DraftPatch = Partial<Omit<ReviewDraft, 'id' | 'updatedAt'>>;
type RelationshipDraft = {
  id: string;
  updatedAt: string;
  reviewStatus?: RelationshipReviewStatus;
  displayLabel?: string;
  referenceNote?: string;
  curatorNote?: string;
  provenanceOverride?: RelationshipProvenance;
  typeOverride?: RelationshipType;
};
type RelationshipDraftMap = Record<string, RelationshipDraft>;
type RelationshipDraftPatch = Partial<Omit<RelationshipDraft, 'id' | 'updatedAt'>>;
type RelationshipReviewRow = {
  id: string;
  edge: ConnectionEdge;
  sourceNode: ConnectionNode;
  targetNode: ConnectionNode;
  draft?: RelationshipDraft;
  effectiveLabel: string;
  effectiveNote: string;
  effectiveProvenance: RelationshipProvenance;
  effectiveType: RelationshipType;
  reviewStatus: 'approved' | 'hidden' | 'needs-research' | 'unreviewed';
  searchText: string;
};
type CsvValue = string | number | boolean | null | undefined;
type DraftIssue = {
  id: string;
  name: string;
  message: string;
  severity: 'warning' | 'error';
};
type DraftStorageResult = {
  ok: boolean;
  message: string;
  savedAt?: string;
};
type RunnerScript = {
  id: string;
  label: string;
  description: string;
  mutates?: boolean;
  destructive?: boolean;
  strict?: boolean;
};
type RunnerJob = {
  id: string;
  label: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  output?: string;
  currentStep?: string;
  steps?: Array<{
    label: string;
    status: 'queued' | 'running' | 'success' | 'failed';
    startedAt?: string;
    finishedAt?: string;
    exitCode?: number | null;
    output?: string;
  }>;
  logPath?: string;
  persistedAt?: string;
  meta?: RunnerJobMeta;
};
type RunnerApplySummary = {
  rowsRead?: number;
  targetRows?: number;
  targets?: string[];
  curationFieldInputs?: number;
  mediaFieldInputs?: number;
  curationFieldCounts?: Record<string, number>;
  mediaFieldCounts?: Record<string, number>;
  warnings?: string[];
  affectedRecords?: Array<{
    id: string;
    name?: string;
    classYear?: string;
    curationFields?: string[];
    mediaFields?: string[];
    fieldInputs?: number;
  }>;
  dryRunResults?: Array<{
    label: string;
    status: RunnerJob['status'];
    rowsRead?: number | null;
    recordsChanged?: number | null;
    warnings?: number;
    errors?: number;
    changedRecords?: Array<{
      id: string;
      fields: string[];
    }>;
  }>;
  pipeline?: string[];
};
type RunnerJobMeta = {
  kind?: string;
  scriptId?: string;
  decisionPath?: string;
  dryRun?: boolean;
  targets?: string[];
  csvHash?: string;
  previewJobId?: string;
  applySummary?: RunnerApplySummary;
};
type RunnerJobSummary = {
  id: string;
  label: string;
  status: 'success';
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  scriptId?: string;
  logPath?: string;
  persistedAt?: string;
};
type RunnerGitStatus = {
  available: boolean;
  root?: string;
  branch?: string;
  upstream?: string;
  commit?: string;
  fullCommit?: string;
  commitSubject?: string;
  commitDate?: string;
  dirty?: boolean;
  changedFiles?: number;
  ahead?: number | null;
  behind?: number | null;
  changes?: Array<{
    status: string;
    path: string;
  }>;
  error?: string;
};
type RunnerHealth = {
  ok: boolean;
  name?: string;
  repoRoot?: string;
  scripts?: number;
  activeJobs?: number;
  externalOrigins?: string[];
  tokenRequired?: boolean;
  tokenSource?: string;
  jobLogDir?: string;
  maxPersistedJobs?: number;
  runnerStartedAt?: string;
  git?: RunnerGitStatus;
  lastSuccessfulValidation?: RunnerJobSummary | null;
  lastSuccessfulBuild?: RunnerJobSummary | null;
};
type RunnerState = {
  available: boolean;
  checking: boolean;
  error: string;
  token: string;
  health: RunnerHealth | null;
  scripts: RunnerScript[];
  jobs: RunnerJob[];
  activeJob: RunnerJob | null;
  setToken: (token: string) => void;
  refresh: () => Promise<void>;
  runScript: (scriptId: string) => Promise<RunnerJob | null>;
  applyDecisions: (csv: string, options: { dryRun: boolean; previewJobId?: string; previewHash?: string }) => Promise<RunnerJob | null>;
  saveStoryLenses: (document: StoryLensDocument) => Promise<StoryLensDocument | null>;
  saveRelationships: (records: RelationshipRecord[]) => Promise<RelationshipRecord[] | null>;
};

type StoryLensEditorState = {
  document: StoryLensDocument | null;
  draft: StoryLensDocument | null;
  loading: boolean;
  error: string;
  isDirty: boolean;
  setDraft: (document: StoryLensDocument) => void;
  refresh: () => Promise<void>;
  acceptSavedDocument: (document: StoryLensDocument) => void;
};

type ReviewDashboardViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

const draftStorageKey = 'cihof.portal.reviewDrafts.v1';
const relationshipDraftStorageKey = 'cihof.portal.relationshipDrafts.v1';
const runnerTokenStorageKey = 'cihof.portal.runnerToken.v1';
const relationshipTypeOptions: RelationshipType[] = [
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
const relationshipTypeValues = new Set<RelationshipType>(relationshipTypeOptions);
const relationshipProvenanceValues = new Set<RelationshipProvenance>(['documented', 'curated', 'inferred']);
const relationshipReviewStatusValues = new Set<RelationshipReviewStatus>(['approved', 'hidden', 'needs-research']);
const sourceQueueLabels: Record<SourceQueueMode, string> = {
  profiles: 'Profiles',
  media: 'Image Leads',
  video: 'Video Leads',
  relationships: 'Relationships',
  places: 'Places',
  organizations: 'Organizations',
  stories: 'Story Leads',
  aliases: 'Aliases',
  classes: 'Class Evidence',
  unresolved: 'Unresolved',
};

const reportUrls = {
  curation: `${import.meta.env.BASE_URL}data/curation-report.json`,
  media: `${import.meta.env.BASE_URL}data/media-report.json`,
  manifest: `${import.meta.env.BASE_URL}data/media-manifest.json`,
  storyLenses: `${import.meta.env.BASE_URL}data/story-lenses.json`,
  sourceCuration: `${import.meta.env.BASE_URL}data/source-curation-packet.json`,
};
const portalRunnerBaseUrl = 'http://127.0.0.1:5174';

export function ReviewDashboardView({ inductees, onSelect }: ReviewDashboardViewProps) {
  const reports = useReviewReports();
  const sourceCuration = useSourceCurationPacket();
  const relationshipState = useRelationships();
  const runner = usePortalRunner();
  const storyLensState = useStoryLensDocument();
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<QueueMode>('high');
  const [relationshipQuery, setRelationshipQuery] = useState('');
  const [relationshipQueue, setRelationshipQueue] = useState<RelationshipQueueMode>('needs-review');
  const [selectedRelationshipId, setSelectedRelationshipId] = useState('');
  const [tab, setTab] = useState<PortalTab>('workbench');
  const [selectedId, setSelectedId] = useState('');
  const [drafts, setDrafts] = useState<DraftMap>(() => loadStoredDrafts());
  const [relationshipDrafts, setRelationshipDrafts] = useState<RelationshipDraftMap>(() => loadStoredRelationshipDrafts());
  const [portalNotice, setPortalNotice] = useState('');
  const [applyPreviewJobId, setApplyPreviewJobId] = useState('');
  const [applyPreviewCsv, setApplyPreviewCsv] = useState('');
  const [storageState, setStorageState] = useState<DraftStorageResult>({ ok: true, message: 'No local drafts' });
  const [relationshipStorageState, setRelationshipStorageState] = useState<DraftStorageResult>({ ok: true, message: 'No relationship drafts' });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const draftCount = Object.keys(drafts).length;
  const relationshipDraftCount = Object.keys(relationshipDrafts).length;
  const summary = useMemo(() => buildDashboardSummary(inductees, reports.curation, reports.media, drafts), [drafts, inductees, reports.curation, reports.media]);
  const queueOptions = useMemo(() => buildQueueOptions(inductees, reports.curation, reports.media, drafts), [drafts, inductees, reports.curation, reports.media]);
  const actionItems = useMemo(() => buildActionItems(summary, draftCount), [draftCount, summary]);
  const relationshipRows = useMemo(
    () => buildRelationshipReviewRows(inductees, relationshipState.relationships, relationshipDrafts),
    [inductees, relationshipDrafts, relationshipState.relationships],
  );
  const relationshipQueueOptions = useMemo(() => buildRelationshipQueueOptions(relationshipRows), [relationshipRows]);
  const visibleRelationshipRows = useMemo(
    () => relationshipRows
      .filter((row) => matchesRelationshipQueue(row, relationshipQueue))
      .filter((row) => !relationshipQuery.trim() || row.searchText.includes(relationshipQuery.trim().toLowerCase()))
      .sort((a, b) => relationshipPriorityRank(a) - relationshipPriorityRank(b) || a.sourceNode.label.localeCompare(b.sourceNode.label) || a.targetNode.label.localeCompare(b.targetNode.label)),
    [relationshipQuery, relationshipQueue, relationshipRows],
  );
  const selectedRelationship = useMemo(
    () => relationshipRows.find((row) => row.id === selectedRelationshipId) ?? visibleRelationshipRows[0] ?? relationshipRows[0] ?? null,
    [relationshipRows, selectedRelationshipId, visibleRelationshipRows],
  );
  const approvedRelationshipRecords = useMemo(
    () => materializeApprovedRelationshipRecords(relationshipRows, relationshipState.relationships),
    [relationshipRows, relationshipState.relationships],
  );
  const approvedRelationshipDraftCount = useMemo(
    () => relationshipRows.filter((row) => row.draft?.reviewStatus === 'approved').length,
    [relationshipRows],
  );
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return inductees
      .filter((inductee) => matchesQueue(inductee, queue, reports.curation, reports.media, drafts))
      .filter((inductee) => !search || matchesSearch(inductee, drafts[inductee.id], search))
      .sort((a, b) => {
        const edited = Number(Boolean(drafts[b.id])) - Number(Boolean(drafts[a.id]));
        if (queue === 'edited' && edited !== 0) return edited;
        const priority = priorityRank(a.reviewPriority) - priorityRank(b.reviewPriority);
        if (priority !== 0) return priority;
        const featured = Number(b.featuredCandidate) - Number(a.featuredCandidate);
        if (featured !== 0) return featured;
        return (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name);
      });
  }, [drafts, inductees, query, queue, reports.curation, reports.media]);
  const selected = useMemo(() => {
    return inductees.find((item) => item.id === selectedId) ?? visibleRows[0] ?? inductees[0] ?? null;
  }, [inductees, selectedId, visibleRows]);
  const selectedDraft = selected ? drafts[selected.id] : undefined;
  const selectedNeeds = selected ? getReviewNeeds(selected, reports.curation, reports.media, selectedDraft) : [];
  const selectedDraftIssues = selected ? getDraftIssues(selected, selectedDraft, reports.manifest?.assets?.[selected.id]) : [];
  const editedRows = useMemo(() => inductees.filter((item) => Boolean(drafts[item.id])), [drafts, inductees]);
  const decisionCsv = useMemo(
    () => editedRows.length > 0 ? buildReviewCsv(editedRows, reports.curation, reports.media, reports.manifest, drafts) : '',
    [drafts, editedRows, reports.curation, reports.manifest, reports.media],
  );
  const draftIssues = useMemo(() => {
    return editedRows.flatMap((inductee) => getDraftIssues(inductee, drafts[inductee.id], reports.manifest?.assets?.[inductee.id]));
  }, [drafts, editedRows, reports.manifest]);
  const applyPreviewJob = useMemo(
    () => runner.jobs.find((job) => job.id === applyPreviewJobId) ?? (runner.activeJob?.id === applyPreviewJobId ? runner.activeJob : null),
    [applyPreviewJobId, runner.activeJob, runner.jobs],
  );
  const applyPreviewFresh = Boolean(
    applyPreviewJob
    && applyPreviewJob.status === 'success'
    && applyPreviewJob.meta?.dryRun
    && applyPreviewJob.meta?.csvHash
    && applyPreviewCsv
    && applyPreviewCsv === decisionCsv,
  );
  const storyLensCount = storyLensState.draft?.lenses.length ?? storyLensState.document?.lenses.length ?? 0;

  useEffect(() => {
    setStorageState(persistDrafts(drafts));
  }, [drafts]);

  useEffect(() => {
    setRelationshipStorageState(persistRelationshipDrafts(relationshipDrafts));
  }, [relationshipDrafts]);

  useEffect(() => {
    if (draftCount === 0) return undefined;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [draftCount]);

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (!selectedId || !visibleRows.some((item) => item.id === selectedId)) {
      setSelectedId(visibleRows[0].id);
    }
  }, [selectedId, visibleRows]);

  useEffect(() => {
    if (visibleRelationshipRows.length === 0) return;
    if (!selectedRelationshipId || !visibleRelationshipRows.some((row) => row.id === selectedRelationshipId)) {
      setSelectedRelationshipId(visibleRelationshipRows[0].id);
    }
  }, [selectedRelationshipId, visibleRelationshipRows]);

  function patchDraft(id: string, patch: DraftPatch) {
    setDrafts((current) => {
      const nextDraft: ReviewDraft = {
        ...(current[id] ?? { id }),
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      };
      const next = { ...current };
      if (isMeaningfulDraft(nextDraft)) next[id] = nextDraft;
      else delete next[id];
      return next;
    });
  }

  function stageSourceDraft(id: string, patch: DraftPatch, notice: string) {
    patchDraft(id, patch);
    setSelectedId(id);
    setPortalNotice(notice);
  }

  function clearDraft(id: string) {
    if (drafts[id] && !window.confirm('Clear the local draft for this profile?')) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setPortalNotice('Local draft cleared.');
  }

  function clearAllDrafts() {
    if (draftCount > 0 && !window.confirm(`Clear ${draftCount} local portal drafts? Export first if you need to keep them.`)) return;
    setDrafts({});
    setPortalNotice('All local drafts cleared.');
  }

  function patchRelationshipDraft(id: string, patch: RelationshipDraftPatch) {
    setRelationshipDrafts((current) => {
      const nextDraft: RelationshipDraft = {
        ...(current[id] ?? { id }),
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      };
      const next = { ...current };
      if (isMeaningfulRelationshipDraft(nextDraft)) next[id] = nextDraft;
      else delete next[id];
      return next;
    });
  }

  function clearRelationshipDraft(id: string) {
    setRelationshipDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setPortalNotice('Relationship review draft cleared.');
  }

  function clearAllRelationshipDrafts() {
    if (relationshipDraftCount > 0 && !window.confirm(`Clear ${relationshipDraftCount} relationship review drafts? Export first if you need to keep them.`)) return;
    setRelationshipDrafts({});
    setPortalNotice('All relationship review drafts cleared.');
  }

  function exportRelationshipDraftJson() {
    if (relationshipDraftCount === 0) {
      window.alert('There are no relationship review drafts to export.');
      return;
    }
    downloadJson({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'CIHOF staff portal relationship review drafts',
      drafts: relationshipDrafts,
    }, `cihof-relationship-review-${dateStamp()}.json`);
    setPortalNotice(`Exported ${relationshipDraftCount} relationship review drafts as JSON.`);
  }

  async function saveRelationshipReviews() {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    const approvedDraftIds = relationshipRows
      .filter((row) => row.draft?.reviewStatus === 'approved')
      .map((row) => row.id);
    if (approvedDraftIds.length === 0) {
      window.alert('Approve at least one relationship review draft before saving.');
      return;
    }
    if (!window.confirm(`Save ${approvedRelationshipRecords.length} approved relationship record${approvedRelationshipRecords.length === 1 ? '' : 's'} to the repo?`)) return;

    const savedRecords = await runner.saveRelationships(approvedRelationshipRecords);
    if (!savedRecords) return;

    const savedIds = new Set(approvedDraftIds);
    setRelationshipDrafts((current) => {
      const next = { ...current };
      savedIds.forEach((id) => delete next[id]);
      return next;
    });
    await relationshipState.refresh();
    setPortalNotice(`Saved ${savedRecords.length} explicit relationship record${savedRecords.length === 1 ? '' : 's'} to the repo.`);
  }

  function exportDraftJson() {
    if (draftCount === 0) {
      window.alert('There are no local drafts to export.');
      return;
    }
    downloadJson({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'CIHOF staff portal browser drafts',
      drafts,
    }, `cihof-portal-drafts-${dateStamp()}.json`);
    setPortalNotice(`Exported ${draftCount} draft records as JSON.`);
  }

  function importDraftJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result ?? ''));
        const source = getDraftRecordSource(payload);
        const sourceCount = source ? Object.keys(source).length : 0;
        const imported = normalizeDraftPayload(payload, inductees);
        const importedCount = Object.keys(imported).length;
        setDrafts((current) => ({ ...current, ...imported }));
        setPortalNotice(`Imported ${importedCount} draft records${sourceCount > importedCount ? `; skipped ${sourceCount - importedCount} invalid or unknown records` : ''}.`);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Could not import draft JSON.');
      }
    };
    reader.readAsText(file);
  }

  async function runPortalScript(script: RunnerScript) {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    if ((script.mutates || script.destructive || script.strict) && !window.confirm(`Run "${script.label}" from the local portal runner?`)) return;
    const job = await runner.runScript(script.id);
    if (job) {
      setPortalNotice(`Started ${script.label}.`);
      setTab('exports');
    }
  }

  async function applyPortalDrafts(dryRun: boolean) {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    if (editedRows.length === 0) {
      window.alert('There are no local draft edits to apply.');
      return;
    }

    const blockingIssues = draftIssues.filter((issue) => issue.severity === 'error');
    if (blockingIssues.length > 0 && !dryRun) {
      window.alert(`Fix ${blockingIssues.length} blocking draft issue${blockingIssues.length === 1 ? '' : 's'} before applying for real. Dry run is still available.`);
      return;
    }

    const csv = decisionCsv;
    if (!dryRun && !applyPreviewFresh) {
      window.alert('Run a successful dry run for the current portal edits before applying them to the repo.');
      return;
    }

    if (!dryRun && !window.confirm(`Apply ${editedRows.length} portal draft records, regenerate runtime data, validate reports/entities, and build the public app?`)) return;

    const job = await runner.applyDecisions(csv, {
      dryRun,
      previewJobId: dryRun ? undefined : applyPreviewJob?.id,
      previewHash: dryRun ? undefined : applyPreviewJob?.meta?.csvHash,
    });
    if (job) {
      if (dryRun) {
        setApplyPreviewJobId(job.id);
        setApplyPreviewCsv(csv);
      }
      setPortalNotice(`${dryRun ? 'Started dry run for' : 'Started applying'} ${editedRows.length} portal draft records.`);
      setTab('exports');
    }
  }

  return (
    <section className="review-dashboard portal-dashboard" aria-label="Staff portal dashboard">
      <div className="review-dashboard__header portal-dashboard__header">
        <div>
          <p className="eyebrow">Staff Portal</p>
          <h2>Review & Edit</h2>
        </div>
        <div className="review-dashboard__status">
          <StatusPill label="Curation" value={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} tone={(reports.curation?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'ok'} />
          <StatusPill label="Media" value={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} tone={(reports.media?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'warn'} />
          <StatusPill label="Drafts" value={`${draftCount}`} tone={draftCount > 0 ? 'warn' : 'ok'} />
          <StatusPill label="Sources" value={`${sourceCuration.packet?.curationIndex?.length ?? 0}`} tone={sourceCuration.error ? 'bad' : sourceCuration.loading ? 'warn' : 'ok'} />
          <StatusPill label="Lenses" value={`${storyLensCount}`} tone={storyLensState.isDirty ? 'warn' : storyLensState.error ? 'bad' : 'ok'} />
          <StatusPill label="Links" value={`${relationshipRows.length}`} tone={relationshipState.error ? 'bad' : relationshipDraftCount > 0 ? 'warn' : 'ok'} />
          <StatusPill label="Wall Build" value={summary.wallReady ? 'Yes' : 'No'} tone={summary.wallReady ? 'ok' : 'bad'} />
          <StatusPill label="Kiosk Ready" value={summary.kioskReady ? 'Yes' : 'No'} tone={summary.kioskReady ? 'ok' : 'bad'} />
        </div>
      </div>

      {reports.error && <div className="review-dashboard__alert">Report load error: {reports.error}</div>}
      {sourceCuration.error && <div className="review-dashboard__alert">Source data load warning: {sourceCuration.error}</div>}
      {storyLensState.error && <div className="review-dashboard__alert">Story lens load warning: {storyLensState.error}</div>}
      {relationshipState.error && <div className="review-dashboard__alert">Relationship load warning: {relationshipState.error}</div>}
      {reports.loading && <div className="review-dashboard__alert">Loading review reports...</div>}
      {!storageState.ok && <div className="review-dashboard__alert">Draft save warning: {storageState.message}</div>}
      {!relationshipStorageState.ok && <div className="review-dashboard__alert">Relationship draft save warning: {relationshipStorageState.message}</div>}
      {portalNotice && (
        <div className="portal-notice">
          <span>{portalNotice}</span>
          <button type="button" onClick={() => setPortalNotice('')}>Dismiss</button>
        </div>
      )}

      <div className="portal-tabs" aria-label="Portal sections">
        <button className={tab === 'workbench' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('workbench')}>Workbench</button>
        <button className={tab === 'source' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('source')}>Source Data</button>
        <button className={tab === 'lenses' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('lenses')}>Story Lenses {storyLensState.isDirty ? '*' : ''}</button>
        <button className={tab === 'relationships' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('relationships')}>Relationships {relationshipDraftCount > 0 ? `(${relationshipDraftCount})` : ''}</button>
        <button className={tab === 'readiness' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('readiness')}>Readiness</button>
        <button className={tab === 'exports' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('exports')}>Exports {draftCount > 0 ? `(${draftCount})` : ''}</button>
      </div>

      <div className="review-metrics" aria-label="Review metrics">
        <MetricCard label="Profiles" value={summary.totalProfiles} detail={`${summary.approvedProfiles} approved / ${summary.draftProfiles} draft`} />
        <MetricCard label="Open Drafts" value={draftCount} detail={`${summary.draftApprovedProfiles} profile approvals staged`} />
        <MetricCard label="Countries" value={summary.countryNeedsReview} detail={`${summary.inferredCountries} inferred / ${summary.approvedCountries} approved`} />
        <MetricCard label="Summaries" value={summary.approvedSummaries} detail={`${summary.summaryDrafts} draft / ${summary.draftApprovedSummaries} staged`} />
        <MetricCard label="Primary Images" value={summary.localPrimaryImages} detail={`${summary.primaryImagesWallReady} wall-ready / ${summary.primaryImagesReady} cleared`} />
        <MetricCard label="Videos" value={summary.videosReady} detail={`${summary.videoItems} items / ${summary.missingCaptions} captions needed`} />
      </div>

      <div className="portal-action-strip" aria-label="Recommended actions">
        {actionItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setQueue(item.queue);
              setTab('workbench');
            }}
          >
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>

      {tab === 'workbench' && (
        <div className="portal-layout">
          <aside className="portal-queue" aria-label="Review queue">
            <div className="review-controls portal-controls" aria-label="Review filters">
              <label className="field field--search">
                <span>Search</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, id, country, year, story, tag" type="search" />
              </label>
              <label className="field">
                <span>Queue</span>
                <select value={queue} onChange={(event) => setQueue(event.target.value as QueueMode)}>
                  {queueOptions.map((option) => (
                    <option key={option.mode} value={option.mode}>{option.label} ({option.count})</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="review-dashboard__generated portal-generated">
              <span>Curation: {formatDate(reports.curation?.generatedAt)}</span>
              <span>Media: {formatDate(reports.media?.generatedAt)}</span>
              <span>{visibleRows.length} shown</span>
            </div>

            <div className="portal-queue__list" aria-label="Profile review queue">
              {visibleRows.map((inductee) => (
                <button
                  className={selected?.id === inductee.id ? 'portal-queue-row portal-queue-row--active' : 'portal-queue-row'}
                  key={inductee.id}
                  type="button"
                  onClick={() => setSelectedId(inductee.id)}
                >
                  <span className="portal-queue-row__title">
                    <strong>{inductee.name}</strong>
                    {drafts[inductee.id] && <em>Edited</em>}
                  </span>
                  <small>{inductee.classYear ?? 'Year unknown'} / {countryOrRegionLabel(inductee)}</small>
                  <span className="portal-queue-row__needs">{formatNeeds(getReviewNeeds(inductee, reports.curation, reports.media, drafts[inductee.id]))}</span>
                </button>
              ))}
            </div>

            {visibleRows.length === 0 && <div className="review-dashboard__alert">No profiles match this queue.</div>}
          </aside>

          <section className="portal-editor-shell" aria-label="Selected profile editor">
            {selected ? (
              <ProfileEditor
                draft={selectedDraft}
                inductee={selected}
                mediaRecord={reports.manifest?.assets?.[selected.id]}
                needs={selectedNeeds}
                draftIssues={selectedDraftIssues}
                saveState={storageState}
                onClear={() => clearDraft(selected.id)}
                onOpenProfile={() => onSelect(selected)}
                onPatch={(patch) => patchDraft(selected.id, patch)}
              />
            ) : (
              <div className="review-dashboard__alert">No profile selected.</div>
            )}
          </section>
        </div>
      )}

      {tab === 'lenses' && (
        <StoryLensEditor
          inductees={inductees}
          runner={runner}
          state={storyLensState}
          onNotice={setPortalNotice}
        />
      )}

      {tab === 'source' && (
        <SourceCurationPanel
          drafts={drafts}
          inductees={inductees}
          manifest={reports.manifest}
          packet={sourceCuration.packet}
          loading={sourceCuration.loading}
          error={sourceCuration.error}
          onOpenProfile={(personId) => {
            setSelectedId(personId);
            setTab('workbench');
          }}
          onStageDraft={stageSourceDraft}
        />
      )}

      {tab === 'relationships' && (
        <RelationshipReviewPanel
          queue={relationshipQueue}
          query={relationshipQuery}
          rows={relationshipRows}
          visibleRows={visibleRelationshipRows}
          selectedRow={selectedRelationship}
          queueOptions={relationshipQueueOptions}
          storageState={relationshipStorageState}
          draftCount={relationshipDraftCount}
          onClearAll={clearAllRelationshipDrafts}
          onClearDraft={clearRelationshipDraft}
          onExportDrafts={exportRelationshipDraftJson}
          onPatchDraft={patchRelationshipDraft}
          onSaveApproved={saveRelationshipReviews}
          onQueueChange={setRelationshipQueue}
          onQueryChange={setRelationshipQuery}
          runnerAvailable={runner.available}
          approvedRecordCount={approvedRelationshipRecords.length}
          approvedDraftCount={approvedRelationshipDraftCount}
          onSelectRow={(rowId) => setSelectedRelationshipId(rowId)}
        />
      )}

      {tab === 'readiness' && (
        <ReadinessPanel
          drafts={drafts}
          inductees={inductees}
          media={reports.media}
          curation={reports.curation}
          summary={summary}
          onQueueChange={(nextQueue) => {
            setQueue(nextQueue);
            setTab('workbench');
          }}
        />
      )}

      {tab === 'exports' && (
        <ExportPanel
          draftCount={draftCount}
          editedRows={editedRows}
          reports={reports}
          runner={runner}
          drafts={drafts}
          draftIssues={draftIssues}
          applyPreviewJob={applyPreviewJob}
          applyPreviewFresh={applyPreviewFresh}
          importInputRef={importInputRef}
          onClearDrafts={clearAllDrafts}
          onExportDraftJson={exportDraftJson}
          onImportDraftJson={importDraftJson}
          onRunScript={runPortalScript}
          onApplyDrafts={applyPortalDrafts}
          onExportDecisionCsv={() => downloadReviewQueue(editedRows, reports.curation, reports.media, reports.manifest, drafts, 'portal-decisions')}
          onExportVisibleCsv={() => downloadReviewQueue(visibleRows, reports.curation, reports.media, reports.manifest, drafts, queue)}
        />
      )}
    </section>
  );
}

function SourceCurationPanel({
  packet,
  loading,
  error,
  inductees,
  drafts,
  manifest,
  onOpenProfile,
  onStageDraft,
}: {
  packet: SourceCurationPacket | null;
  loading: boolean;
  error: string;
  inductees: Inductee[];
  drafts: DraftMap;
  manifest: MediaManifest | null;
  onOpenProfile: (personId: string) => void;
  onStageDraft: (personId: string, patch: DraftPatch, notice: string) => void;
}) {
  const [queue, setQueue] = useState<SourceQueueMode>('profiles');
  const [query, setQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [targetProfileId, setTargetProfileId] = useState('');
  const normalizedPacket = packet ?? emptySourceCurationPacket();
  const peopleById = useMemo(() => new Map(inductees.map((inductee) => [inductee.id, inductee])), [inductees]);
  const rows = useMemo(() => buildSourceCandidateRows(normalizedPacket), [normalizedPacket]);
  const queueOptions = useMemo(() => buildSourceQueueOptions(rows), [rows]);
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows
      .filter((row) => row.mode === queue)
      .filter((row) => !search || matchesSourceCandidate(row, search))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || a.label.localeCompare(b.label));
  }, [query, queue, rows]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? visibleRows[0] ?? rows[0] ?? null,
    [rows, selectedRowId, visibleRows],
  );
  const defaultTargetId = selectedRow?.personId && peopleById.has(selectedRow.personId)
    ? selectedRow.personId
    : targetProfileId && peopleById.has(targetProfileId)
      ? targetProfileId
      : inductees[0]?.id ?? '';
  const selectedTargetId = targetProfileId && peopleById.has(targetProfileId) ? targetProfileId : defaultTargetId;
  const selectedTarget = selectedTargetId ? peopleById.get(selectedTargetId) ?? null : null;
  const sourceSummary = normalizedPacket.summary;

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (!selectedRowId || !visibleRows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(visibleRows[0].id);
    }
  }, [selectedRowId, visibleRows]);

  useEffect(() => {
    if (selectedRow?.personId && peopleById.has(selectedRow.personId)) {
      setTargetProfileId(selectedRow.personId);
    }
  }, [peopleById, selectedRow?.id, selectedRow?.personId]);

  function stageSelected(stageKind: SourceCandidateRow['stageKind']) {
    if (!selectedRow || !selectedTarget) return;
    const draft = drafts[selectedTarget.id];
    const mediaRecord = manifest?.assets?.[selectedTarget.id];
    const patch = sourceDraftPatchForRow(selectedRow, stageKind, selectedTarget, draft, mediaRecord);
    onStageDraft(selectedTarget.id, patch, `Staged ${sourceStageLabel(stageKind)} from source data on ${selectedTarget.name}.`);
  }

  return (
    <section className="portal-source" aria-label="Source data curation">
      <div className="portal-readiness__intro portal-source__intro">
        <div>
          <p className="eyebrow">Source Data</p>
          <h3>Review original-site leads</h3>
          <p>Source harvest records are review aids. Staged edits remain local drafts until exported or applied through the existing portal runner.</p>
        </div>
        <div className="portal-source__stamp">
          <span>Generated: {formatDate(normalizedPacket.source?.generatedAt)}</span>
          <span>{loading ? 'Loading source packet' : `${rows.length} source leads`}</span>
        </div>
      </div>

      {error && <div className="review-dashboard__alert">Source packet warning: {error}</div>}

      <div className="portal-lenses__summary portal-source__summary">
        <MetricCard label="Profiles" value={sourceSummary?.sourceProfiles?.resolved ?? 0} detail={`${sourceSummary?.sourceProfiles?.unresolved ?? 0} unresolved / ${sourceSummary?.sourceProfiles?.duplicateGroups ?? 0} duplicate groups`} />
        <MetricCard label="Media Leads" value={sourceSummary?.mediaReviewDrafts?.total ?? 0} detail={`${sourceSummary?.mediaReviewDrafts?.newSources ?? 0} new / ${sourceSummary?.mediaReviewDrafts?.highConfidenceNewSources ?? 0} high confidence`} />
        <MetricCard label="Video Leads" value={sourceSummary?.videoReviewDrafts?.total ?? 0} detail={`${sourceSummary?.videoReviewDrafts?.newSources ?? 0} new source leads`} />
        <MetricCard label="Story Leads" value={sourceSummary?.storySectionReviewDrafts?.total ?? 0} detail={`${sourceSummary?.storySectionReviewDrafts?.primaryLeads ?? 0} primary rewrite leads`} />
      </div>

      <div className="portal-source-guardrails" aria-label="Source curation guardrails">
        {Object.entries(normalizedPacket.guardrails ?? {}).map(([key, value]) => (
          <span key={key}><strong>{sourceGuardrailLabel(key)}</strong>{value}</span>
        ))}
      </div>

      <div className="portal-source-layout">
        <aside className="portal-source-queue" aria-label="Source queue">
          <div className="review-controls portal-controls">
            <label className="field field--search">
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, source, place, organization, URL" type="search" />
            </label>
            <label className="field">
              <span>Queue</span>
              <select value={queue} onChange={(event) => setQueue(event.target.value as SourceQueueMode)}>
                {queueOptions.map((option) => (
                  <option key={option.mode} value={option.mode}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
          </div>

          <div className="portal-source-queue__list" aria-label="Source rows">
            {visibleRows.map((row) => (
              <button
                className={selectedRow?.id === row.id ? 'portal-source-row portal-source-row--active' : 'portal-source-row'}
                key={row.id}
                type="button"
                onClick={() => setSelectedRowId(row.id)}
              >
                <span>
                  <strong>{row.label}</strong>
                  {row.confidence !== undefined && <em>{formatConfidence(row.confidence)}</em>}
                </span>
                <small>{sourceQueueLabels[row.mode]} / {row.subtitle}</small>
                <span>{row.detail}</span>
              </button>
            ))}
            {visibleRows.length === 0 && <div className="portal-empty-state">No source leads match this queue.</div>}
          </div>
        </aside>

        <section className="portal-source-detail" aria-label="Selected source lead">
          {selectedRow ? (
            <>
              <div className="portal-source-detail__header">
                <div>
                  <span>{sourceQueueLabels[selectedRow.mode]}</span>
                  <h4>{selectedRow.label}</h4>
                  <p>{selectedRow.detail}</p>
                </div>
                <label className="field">
                  <span>Add to profile</span>
                  <select value={selectedTargetId} onChange={(event) => setTargetProfileId(event.target.value)}>
                    {inductees.map((inductee) => (
                      <option key={inductee.id} value={inductee.id}>{inductee.name} / {inductee.classYear ?? 'Year unknown'}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="portal-source-detail__actions">
                <button disabled={!selectedTarget} type="button" onClick={() => stageSelected(selectedRow.stageKind)}>{sourcePrimaryActionLabel(selectedRow)}</button>
                <button disabled={!selectedTarget} type="button" onClick={() => stageSelected('profile-note')}>Stage Review Note</button>
                <button disabled={!selectedTarget} type="button" onClick={() => selectedTarget && onOpenProfile(selectedTarget.id)}>Open Workbench Profile</button>
              </div>

              <div className="portal-source-detail__links">
                {selectedRow.sourceUrl && <a href={selectedRow.sourceUrl} rel="noreferrer" target="_blank">Source URL</a>}
                {selectedRow.sourcePageUrl && selectedRow.sourcePageUrl !== selectedRow.sourceUrl && <a href={selectedRow.sourcePageUrl} rel="noreferrer" target="_blank">Source Page</a>}
              </div>

              <div className="portal-source-data">
                {selectedRow.fields.map((field) => (
                  <div key={`${field.label}-${field.value}`}>
                    <span>{field.label}</span>
                    <strong>{field.value}</strong>
                  </div>
                ))}
              </div>

              <label className="field">
                <span>Note staged from this source</span>
                <textarea readOnly value={selectedRow.note} rows={5} />
              </label>
            </>
          ) : (
            <div className="portal-empty-state">No source lead selected.</div>
          )}
        </section>
      </div>
    </section>
  );
}

function emptySourceCurationPacket(): SourceCurationPacket {
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

function normalizeSourceCurationPacket(packet: SourceCurationPacket | null | undefined): SourceCurationPacket {
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

function buildSourceCandidateRows(packet: SourceCurationPacket): SourceCandidateRow[] {
  const rows: SourceCandidateRow[] = [];

  (packet.curationIndex ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `profiles-${personId || index}`,
      mode: 'profiles',
      label: cleanPortalString(record.inducteeName) || personId || 'Profile source lead',
      subtitle: sourceYearRegion(record.classYear, record.region),
      detail: cleanPortalString(record.nextBestAction) || 'Review harvested original-site profile evidence.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.primarySourceProfileUrl),
      confidence: priorityConfidence(record.reviewPriority),
      action: cleanPortalString(record.nextBestAction),
      fields: compactSourceFields(
        ['Primary source', record.primarySourceProfileUrl],
        ['Profile sources', record.sourceProfileCount],
        ['New image leads', record.newImageReviewCount],
        ['New profile video leads', record.newProfileVideoReviewCount],
        ['Context video leads', record.newContextVideoReviewCount],
        ['Relationship leads', record.relationshipReviewCount],
        ['Place leads', record.placeReviewCount],
        ['Organization leads', record.organizationReviewCount],
        ['Primary story leads', record.primaryStoryLeadCount],
        ['Manual flags', record.manualFlags?.join('; ')],
      ),
      stageKind: 'profile-note',
      note: sourceNote('Source profile review', [
        record.nextBestAction,
        record.primarySourceProfileUrl,
        record.manualFlags?.join('; '),
      ]),
    });
  });

  (packet.sourceProfileReferences ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `profile-source-${personId || 'unknown'}-${index}`,
      mode: 'profiles',
      label: cleanPortalString(record.sourceTitle) || cleanPortalString(record.inducteeName) || 'Source profile',
      subtitle: `${cleanPortalString(record.matchType) || 'source profile'} / ${sourceYearRegion(record.classYear)}`,
      detail: 'Resolved original-site source profile reference.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.canonicalUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Source title', record.sourceTitle],
        ['Source URL', record.sourceUrl],
        ['Canonical URL', record.canonicalUrl],
        ['Modified', record.sourceModified],
        ['Region candidates', record.sourceRegionCandidates?.join('; ')],
        ['Class candidates', record.sourceClassYearCandidates?.join('; ')],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'profile-note',
      note: sourceNote('Resolved original-site profile source', [
        record.sourceTitle,
        record.sourceUrl,
        record.reviewAction,
      ]),
    });
  });

  (packet.mediaReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `media-${personId || 'unknown'}-${index}`,
      mode: 'media',
      label: cleanPortalString(record.inducteeName) || personId || 'Image lead',
      subtitle: `${cleanPortalString(record.roleCandidate) || 'image'} / ${record.alreadyInMediaManifest ? 'in manifest' : 'new source'}`,
      detail: cleanPortalString(record.sourcePageTitle) || cleanPortalString(record.sourceUrl) || 'Review image lead for rights and portrait suitability.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      imageAltText: cleanPortalString(record.altText),
      fields: compactSourceFields(
        ['Media type', record.mediaType],
        ['Role candidate', record.roleCandidate],
        ['Dimensions', record.width && record.height ? `${record.width} x ${record.height}` : ''],
        ['Alt text', record.altText],
        ['Caption', record.caption],
        ['Rights status', record.rightsStatus],
        ['Already in manifest', record.alreadyInMediaManifest ? 'Yes' : 'No'],
        ['Source page', record.sourcePageUrl],
        ['Review action', record.reviewAction],
      ),
      stageKind: cleanPortalString(record.sourceUrl) ? 'media-image' : 'profile-note',
      note: sourceNote('Image source lead', [
        record.roleCandidate,
        record.sourceUrl,
        record.sourcePageUrl,
        record.rightsStatus,
        'Rights and suitability still require staff review.',
      ]),
    });
  });

  (packet.videoReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `video-${personId || 'unknown'}-${index}`,
      mode: 'video',
      label: cleanPortalString(record.inducteeName) || personId || 'Video lead',
      subtitle: `${cleanPortalString(record.assignment) || 'video'} / ${record.alreadyInMediaManifest ? 'in manifest' : 'new source'}`,
      detail: cleanPortalString(record.sourcePageTitle) || cleanPortalString(record.sourceUrl) || 'Review video lead for context, rights, captions, and transcript.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      youtubeVideoId: cleanPortalString(record.youtubeVideoId),
      fields: compactSourceFields(
        ['YouTube ID', record.youtubeVideoId],
        ['Assignment', record.assignment],
        ['Rights status', record.rightsStatus],
        ['Already in manifest', record.alreadyInMediaManifest ? 'Yes' : 'No'],
        ['Source page', record.sourcePageUrl],
        ['Review action', record.reviewAction],
      ),
      stageKind: cleanPortalString(record.sourceUrl) || cleanPortalString(record.youtubeVideoId) ? 'video-source' : 'profile-note',
      note: sourceNote('Video source lead', [
        record.assignment,
        record.sourceUrl,
        record.sourcePageUrl,
        record.rightsStatus,
        'Rights, captions, transcript, and context still require staff review.',
      ]),
    });
  });

  (packet.relationshipReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.sourcePersonId);
    rows.push({
      id: `relationship-${personId || 'unknown'}-${index}`,
      mode: 'relationships',
      label: `${cleanPortalString(record.sourcePersonName) || personId || 'Source person'} -> ${cleanPortalString(record.targetDisplayName) || cleanPortalString(record.targetEntityId) || 'target'}`,
      subtitle: `${cleanPortalString(record.provenanceCandidate) || 'candidate'} / ${cleanPortalString(record.type) || 'relationship'}`,
      detail: cleanPortalString(record.referenceNote) || 'Review relationship evidence before public display.',
      personId,
      personName: cleanPortalString(record.sourcePersonName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Target type', record.targetEntityType],
        ['Target ID', record.targetEntityId],
        ['Display label', record.displayLabel],
        ['Evidence count', record.evidenceCount],
        ['Evidence types', record.evidenceTypes?.join('; ')],
        ['Public use', record.publicUse],
        ['Source pages', record.sourcePageUrls?.join('; ')],
      ),
      stageKind: 'relationship-note',
      note: sourceNote('Relationship source lead', [
        `${record.sourcePersonName ?? personId} -> ${record.targetDisplayName ?? record.targetEntityId}`,
        record.type,
        record.referenceNote,
        record.sourcePageUrls?.join('; '),
        'Approve in the Relationships tab before public use.',
      ]),
    });
  });

  (packet.placeReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `place-${personId || 'unknown'}-${index}`,
      mode: 'places',
      label: `${cleanPortalString(record.inducteeName) || personId || 'Profile'} / ${cleanPortalString(record.placeLabel) || 'Place lead'}`,
      subtitle: `${cleanPortalString(record.safeguardStatus) || 'geography review'} / ${cleanPortalString(record.migrationDirection) || 'not-inferred'}`,
      detail: 'Review place evidence. Do not infer migration direction from this lead.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      countryCandidates: cleanPortalList(record.inferredCountryTags),
      fields: compactSourceFields(
        ['Place', record.placeLabel],
        ['Scope hint', record.placeScopeHint],
        ['Evidence count', record.evidenceCount],
        ['Evidence types', record.evidenceTypes?.join('; ')],
        ['Existing countries', record.existingCountryTags?.join('; ')],
        ['Country candidates', record.inferredCountryTags?.join('; ')],
        ['Safeguard', record.safeguardStatus],
        ['Migration direction', record.migrationDirection],
        ['Source pages', record.sourcePageUrls?.join('; ')],
      ),
      stageKind: 'place-note',
      note: sourceNote('Place source lead', [
        record.placeLabel,
        record.safeguardStatus,
        record.migrationDirection,
        record.sourcePageUrls?.join('; '),
        'Geography candidate only; do not infer migration direction.',
      ]),
    });
  });

  (packet.placePhraseReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `place-phrase-${personId || 'unknown'}-${index}`,
      mode: 'places',
      label: `${cleanPortalString(record.inducteeName) || personId || 'Profile'} / ${cleanPortalString(record.phraseLabel) || 'Place phrase'}`,
      subtitle: `${cleanPortalString(record.phraseQuality) || 'phrase'} / ${cleanPortalString(record.safeguardStatus) || 'geography review'}`,
      detail: 'Exploratory place phrase. Staff should verify whether this is a usable place signal.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      countryCandidates: cleanPortalList(record.inferredCountryTags),
      fields: compactSourceFields(
        ['Phrase', record.phraseLabel],
        ['Quality', record.phraseQuality],
        ['Evidence count', record.evidenceCount],
        ['Existing countries', record.existingCountryTags?.join('; ')],
        ['Country candidates', record.inferredCountryTags?.join('; ')],
        ['Safeguard', record.safeguardStatus],
        ['Migration direction', record.migrationDirection],
        ['Source pages', record.sourcePageUrls?.join('; ')],
      ),
      stageKind: 'place-note',
      note: sourceNote('Exploratory place phrase lead', [
        record.phraseLabel,
        record.phraseQuality,
        record.safeguardStatus,
        record.sourcePageUrls?.join('; '),
        'Geography candidate only; do not infer migration direction.',
      ]),
    });
  });

  (packet.organizationReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `organization-${personId || 'unknown'}-${index}`,
      mode: 'organizations',
      label: cleanPortalString(record.organizationName) || 'Organization lead',
      subtitle: `${cleanPortalString(record.inducteeName) || personId || 'Profile'} / ${sourceYearRegion(record.classYear)}`,
      detail: 'Review organization as documented context, story signal, or relationship evidence.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sourcePageUrls?.[0],
      sourcePageUrl: record.sourcePageUrls?.[0],
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Organization', record.organizationName],
        ['Evidence count', record.evidenceCount],
        ['Public use', record.publicUse],
        ['Source pages', record.sourcePageUrls?.join('; ')],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'organization-note',
      note: sourceNote('Organization source lead', [
        record.organizationName,
        record.sourcePageUrls?.join('; '),
        'Review as context before public use.',
      ]),
    });
  });

  (packet.storySectionReviewDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `story-${personId || 'unknown'}-${index}`,
      mode: 'stories',
      label: cleanPortalString(record.inducteeName) || personId || 'Story lead',
      subtitle: `${cleanPortalString(record.suggestedTheme) || 'story'} / ${cleanPortalString(record.priority) || 'lead'}`,
      detail: cleanPortalString(record.excerpt) || 'Review source excerpt as a rewrite lead.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.sourcePageUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.priority === 'primary-story-lead' ? 0.9 : 0.58,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Source title', record.sourcePageTitle],
        ['Suggested theme', record.suggestedTheme],
        ['Block index', record.blockIndex],
        ['Word count', record.wordCount],
        ['Candidate use', record.candidateUse],
        ['Copyright note', record.copyrightNote],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'story-note',
      note: sourceNote('Story rewrite lead', [
        record.suggestedTheme,
        record.excerpt,
        record.sourcePageUrl,
        record.copyrightNote,
      ]),
    });
  });

  (packet.profileUrlAliasDrafts ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `alias-${personId || 'unknown'}-${index}`,
      mode: 'aliases',
      label: cleanPortalString(record.inducteeName) || personId || 'Profile alias',
      subtitle: `${cleanPortalString(record.matchType) || 'alias'} / ${cleanPortalString(record.publishStatus) || 'review'}`,
      detail: 'Review alternate original-site URL before changing canonical profile links.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: cleanPortalString(record.alternateSourceUrl),
      sourcePageUrl: cleanPortalString(record.currentProfileUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Current URL', record.currentProfileUrl],
        ['Alternate URL', record.alternateSourceUrl],
        ['Source title', record.sourceTitle],
        ['Publish status', record.publishStatus],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'alias-note',
      note: sourceNote('Profile URL alias lead', [
        record.alternateSourceUrl,
        record.currentProfileUrl,
        record.publishStatus,
      ]),
    });
  });

  (packet.duplicateSourceGroups ?? []).forEach((record, index) => {
    const personId = cleanPortalString(record.inducteeId);
    rows.push({
      id: `duplicate-source-${personId || 'unknown'}-${index}`,
      mode: 'aliases',
      label: cleanPortalString(record.inducteeName) || personId || 'Duplicate source group',
      subtitle: `${record.sources?.length ?? 0} source records`,
      detail: 'Review duplicate original-site source records before using as canonical references.',
      personId,
      personName: cleanPortalString(record.inducteeName),
      sourceUrl: record.sources?.[0]?.sourceUrl,
      sourcePageUrl: record.sources?.[0]?.sourceUrl,
      confidence: record.sources?.reduce((max, source) => Math.max(max, source.confidence ?? 0), 0),
      fields: compactSourceFields(
        ['Sources', record.sources?.map((source) => source.sourceUrl).join('; ')],
        ['Match types', record.sources?.map((source) => source.matchType).filter(Boolean).join('; ')],
      ),
      stageKind: 'alias-note',
      note: sourceNote('Duplicate source group lead', [
        record.sources?.map((source) => `${source.sourceTitle ?? 'Untitled'}: ${source.sourceUrl}`).join('; '),
      ]),
    });
  });

  (packet.classEvidenceReviewDrafts ?? []).forEach((record, index) => {
    rows.push({
      id: `class-evidence-${index}`,
      mode: 'classes',
      label: cleanPortalString(record.title) || 'Class evidence lead',
      subtitle: `${cleanPortalString(record.sourceKind) || 'class source'} / ${record.primaryClassYearCandidates?.join('; ') || 'year review'}`,
      detail: 'Review class page evidence before applying to individual profiles.',
      sourceUrl: cleanPortalString(record.sourcePageUrl),
      sourcePageUrl: cleanPortalString(record.sourcePageUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Primary class years', record.primaryClassYearCandidates?.join('; ')],
        ['All class years', record.allClassYearCandidates?.join('; ')],
        ['Images', record.imageCount],
        ['Attached media', record.attachedMediaCount],
        ['YouTube IDs', record.youtubeVideoIds?.join('; ')],
        ['Mentioned inductees', record.mentionedInducteeCount],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'class-note',
      note: sourceNote('Class evidence lead', [
        record.title,
        record.sourcePageUrl,
        record.primaryClassYearCandidates?.join('; '),
      ]),
    });
  });

  (packet.unresolvedSourceRecords ?? []).forEach((record, index) => {
    rows.push({
      id: `unresolved-${record.wpId ?? index}`,
      mode: 'unresolved',
      label: cleanPortalString(record.sourceTitle) || cleanPortalString(record.sourceTitleName) || 'Unresolved source',
      subtitle: `${cleanPortalString(record.sourceKind) || 'source'} / no deterministic match`,
      detail: 'Resolve manually to an existing profile or a future new record.',
      sourceUrl: cleanPortalString(record.sourceUrl),
      sourcePageUrl: cleanPortalString(record.sourceUrl),
      confidence: record.confidence,
      action: cleanPortalString(record.reviewAction),
      fields: compactSourceFields(
        ['Source title', record.sourceTitle],
        ['Source title name', record.sourceTitleName],
        ['Region candidates', record.sourceRegionCandidates?.join('; ')],
        ['Class candidates', record.sourceClassYearCandidates?.join('; ')],
        ['Notes', record.notes?.join('; ')],
        ['Review action', record.reviewAction],
      ),
      stageKind: 'unresolved-note',
      note: sourceNote('Unresolved original-site source', [
        record.sourceTitle,
        record.sourceUrl,
        record.notes?.join('; '),
      ]),
    });
  });

  return rows;
}

function buildSourceQueueOptions(rows: SourceCandidateRow[]) {
  return (Object.entries(sourceQueueLabels) as Array<[SourceQueueMode, string]>).map(([mode, label]) => ({
    mode,
    label,
    count: rows.filter((row) => row.mode === mode).length,
  }));
}

function sourceDraftPatchForRow(row: SourceCandidateRow, stageKind: SourceCandidateRow['stageKind'], target: Inductee, draft: ReviewDraft | undefined, mediaRecord: MediaManifestRecord | undefined): DraftPatch {
  if (stageKind === 'media-image' && row.sourceUrl) {
    const patch: DraftPatch = {
      imageSourceUrl: row.sourceUrl,
      imageRightsStatus: 'needs-review',
      mediaNotes: addListValue(draft?.mediaNotes ?? mediaRecord?.notes ?? [], row.note),
    };
    if (row.imageAltText) patch.primaryImageAltText = row.imageAltText;
    return patch;
  }

  if (stageKind === 'video-source') {
    const patch: DraftPatch = {
      videoRightsStatus: 'needs-review',
      captionStatus: 'review-needed',
      transcriptStatus: 'review-needed',
      mediaNotes: addListValue(draft?.mediaNotes ?? mediaRecord?.notes ?? [], row.note),
    };
    if (row.sourceUrl) patch.videoSourceUrls = addListValue(draft?.videoSourceUrls ?? [], row.sourceUrl);
    if (row.youtubeVideoId) patch.youtubeVideoIds = addListValue(draft?.youtubeVideoIds ?? [], row.youtubeVideoId);
    return patch;
  }

  if (stageKind === 'place-note') {
    const countryCandidates = row.countryCandidates ?? [];
    const patch: DraftPatch = {
      countryNotes: appendSourceText(draft?.countryNotes ?? target.countryTagsNote, row.note),
      curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
    };
    if (countryCandidates.length > 0) patch.approvedCountryTags = addListValues(draft?.approvedCountryTags ?? target.countryTags, countryCandidates);
    return patch;
  }

  if ((stageKind === 'profile-note' || stageKind === 'class-note') && !draft?.documentedContextLine && !target.documentedContextLine) {
    return {
      documentedContextLine: sourceContextLine(row),
      curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
    };
  }

  if (stageKind === 'story-note' && !draft?.lifeWorkSummary && !target.lifeWorkSummary) {
    return {
      lifeWorkSummary: row.detail || row.note,
      curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
    };
  }

  return {
    curatorNotes: addListValue(draft?.curatorNotes ?? [], row.note),
  };
}

function sourceContextLine(row: SourceCandidateRow) {
  return [row.subtitle, row.detail, row.label]
    .map(cleanPortalString)
    .filter(Boolean)
    .join(' / ')
    .slice(0, 120);
}

function matchesSourceCandidate(row: SourceCandidateRow, search: string) {
  return [
    row.label,
    row.subtitle,
    row.detail,
    row.personId,
    row.personName,
    row.sourceUrl,
    row.sourcePageUrl,
    row.action,
    row.note,
    ...row.fields.flatMap((field) => [field.label, field.value]),
  ].join(' ').toLowerCase().includes(search);
}

function sourcePrimaryActionLabel(row: SourceCandidateRow) {
  switch (row.stageKind) {
    case 'media-image':
      return 'Stage Image Source';
    case 'video-source':
      return 'Stage Video Source';
    case 'place-note':
      return 'Stage Place Candidate';
    case 'relationship-note':
      return 'Stage Relationship Note';
    case 'organization-note':
      return 'Stage Organization Note';
    case 'story-note':
      return 'Stage Story Lead';
    case 'alias-note':
      return 'Stage Alias Note';
    case 'class-note':
      return 'Stage Class Note';
    case 'unresolved-note':
      return 'Stage Manual Note';
    default:
      return 'Stage Profile Note';
  }
}

function sourceStageLabel(stageKind: SourceCandidateRow['stageKind']) {
  switch (stageKind) {
    case 'media-image':
      return 'image source';
    case 'video-source':
      return 'video source';
    case 'place-note':
      return 'place candidate';
    case 'relationship-note':
      return 'relationship note';
    case 'organization-note':
      return 'organization note';
    case 'story-note':
      return 'story lead';
    case 'alias-note':
      return 'alias note';
    case 'class-note':
      return 'class evidence';
    case 'unresolved-note':
      return 'manual source note';
    default:
      return 'profile note';
  }
}

function compactSourceFields(...fields: Array<[string, unknown]>): Array<{ label: string; value: string }> {
  return fields
    .map(([label, value]) => ({ label, value: sourceValueLabel(value) }))
    .filter((field) => field.value.length > 0);
}

function sourceValueLabel(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(sourceValueLabel).filter(Boolean).join('; ');
  return cleanPortalString(value);
}

function sourceYearRegion(classYear?: number, region?: string) {
  return [classYear ? `Class of ${classYear}` : '', cleanPortalString(region)].filter(Boolean).join(' / ') || 'Year review';
}

function sourceNote(label: string, values: Array<unknown>) {
  const detail = values.map(sourceValueLabel).filter(Boolean).join(' / ');
  return detail ? `${label}: ${detail}` : label;
}

function priorityConfidence(priority?: string) {
  if (priority === 'high') return 0.9;
  if (priority === 'medium') return 0.64;
  if (priority === 'standard') return 0.44;
  return undefined;
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function sourceGuardrailLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()) + ': ';
}

function addListValues(values: string[], nextValues: string[]) {
  return nextValues.reduce((current, value) => addListValue(current, value), values);
}

function appendSourceText(existingValue: string | undefined, nextValue: string) {
  const existing = cleanPortalString(existingValue);
  if (!existing) return nextValue;
  if (existing.includes(nextValue)) return existing;
  return `${existing}\n${nextValue}`;
}

function StoryLensEditor({
  inductees,
  state,
  runner,
  onNotice,
}: {
  inductees: Inductee[];
  state: StoryLensEditorState;
  runner: RunnerState;
  onNotice: (message: string) => void;
}) {
  const draft = state.draft ?? emptyStoryLensDocument();
  const issues = getStoryLensDraftIssues(draft, inductees);
  const blockingIssues = issues.filter((issue) => issue.severity === 'error');

  function patchLens(index: number, patch: Partial<StoryLensConfig>) {
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: draft.lenses.map((lens, lensIndex) => lensIndex === index ? { ...lens, ...patch } : lens),
    }));
  }

  function addLens() {
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: [
        ...draft.lenses,
        {
          id: uniqueLensId(draft.lenses, 'new-story-lens'),
          label: 'New Story Lens',
          prompt: 'Who Should Visitors Meet?',
          description: 'Curator-written prompt description for this interpretive grouping.',
          terms: ['community'],
          themes: [],
          pinnedPersonIds: [],
          excludedPersonIds: [],
          curatorNotes: [],
          reviewStatus: 'draft',
          maxPortraits: 36,
          enabled: false,
        },
      ],
    }));
  }

  function duplicateLens(index: number) {
    const source = draft.lenses[index];
    if (!source) return;
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: [
        ...draft.lenses.slice(0, index + 1),
        {
          ...source,
          id: uniqueLensId(draft.lenses, `${source.id}-copy`),
          label: `${source.label} Copy`,
          enabled: false,
        },
        ...draft.lenses.slice(index + 1),
      ],
    }));
  }

  function removeLens(index: number) {
    const lens = draft.lenses[index];
    if (!lens) return;
    if (!window.confirm(`Remove "${lens.label}" from the Story Lens draft?`)) return;
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: draft.lenses.filter((_, lensIndex) => lensIndex !== index),
    }));
  }

  function moveLens(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.lenses.length) return;
    const lenses = [...draft.lenses];
    const [lens] = lenses.splice(index, 1);
    lenses.splice(nextIndex, 0, lens);
    state.setDraft({ ...draft, lenses });
  }

  async function saveStoryLenses() {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    if (blockingIssues.length > 0) {
      window.alert(`Fix ${blockingIssues.length} Story Lens issue${blockingIssues.length === 1 ? '' : 's'} before saving.`);
      return;
    }
    if (!window.confirm(`Save ${draft.lenses.length} Story Lens records to the repo and runtime data?`)) return;
    const savedDocument = await runner.saveStoryLenses(draft);
    if (savedDocument) {
      state.acceptSavedDocument(savedDocument);
      onNotice(`Saved ${savedDocument.lenses.length} Story Lens records.`);
    }
  }

  function exportStoryLenses() {
    downloadJson(draft, `cihof-story-lenses-${dateStamp()}.json`);
    onNotice(`Exported ${draft.lenses.length} Story Lens records as JSON.`);
  }

  return (
    <section className="portal-lenses" aria-label="Story Lens editor">
      <div className="portal-readiness__intro portal-lenses__intro">
        <div>
          <p className="eyebrow">Story Lenses</p>
          <h3>Curate the portrait wall questions</h3>
          <p>These records control the large interpretive prompts on All People.</p>
        </div>
        <div className="portal-lenses__actions">
          <button type="button" onClick={addLens}>Add Lens</button>
          <button disabled={!state.isDirty} type="button" onClick={() => state.setDraft(state.document ?? emptyStoryLensDocument())}>Reset Draft</button>
          <button type="button" onClick={() => void state.refresh()}>{state.loading ? 'Loading' : 'Reload JSON'}</button>
          <button type="button" onClick={exportStoryLenses}>Export JSON</button>
          <button disabled={!runner.available || !state.isDirty || blockingIssues.length > 0} type="button" onClick={() => void saveStoryLenses()}>Save To Repo</button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="portal-validation" aria-label="Story Lens validation">
          <strong>Story Lens validation</strong>
          {issues.map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={issue.message}>
              {issue.message}
            </span>
          ))}
        </div>
      )}

      {!runner.available && (
        <div className="portal-runner-access">
          <label className="field">
            <span>Runner token</span>
            <input
              autoComplete="off"
              type="password"
              value={runner.token}
              onChange={(event) => runner.setToken(event.target.value)}
              placeholder="Required only for approved external portal origins"
            />
          </label>
          <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Connect Runner'}</button>
        </div>
      )}

      <div className="portal-lenses__summary">
        <MetricCard label="Lens Records" value={draft.lenses.length} detail={`${draft.lenses.filter((lens) => lens.enabled !== false).length} enabled`} />
        <MetricCard label="Terms" value={draft.lenses.reduce((count, lens) => count + lens.terms.length, 0)} detail="keyword signals" />
        <MetricCard label="Themes" value={draft.lenses.reduce((count, lens) => count + lens.themes.length, 0)} detail="metadata signals" />
        <MetricCard label="Warnings" value={issues.length} detail={`${blockingIssues.length} blocking`} />
      </div>

      <div className="portal-lens-list" aria-label="Editable Story Lenses">
        {draft.lenses.map((lens, index) => {
          const previewMatches = rankStoryLensMatches(inductees, lens);

          return (
            <article className={lens.enabled === false ? 'portal-lens-card portal-lens-card--disabled' : 'portal-lens-card'} key={`${lens.id}-${index}`}>
              <header className="portal-lens-card__header">
                <div>
                  <span>Lens {index + 1} / {lens.reviewStatus ?? 'draft'}</span>
                  <strong>{lens.prompt || 'Untitled lens'}</strong>
                </div>
                <label className="portal-check portal-check--compact">
                  <input checked={lens.enabled !== false} onChange={(event) => patchLens(index, { enabled: event.target.checked })} type="checkbox" />
                  <span>Enabled</span>
                </label>
              </header>

              <div className="portal-lens-card__grid">
                <label className="field">
                  <span>ID</span>
                  <input value={lens.id} onChange={(event) => patchLens(index, { id: slugifyLensId(event.target.value) })} />
                </label>
                <label className="field">
                  <span>Short label</span>
                  <input value={lens.label} onChange={(event) => patchLens(index, { label: event.target.value })} />
                </label>
                <label className="field">
                  <span>Max portraits</span>
                  <input min="12" max="96" type="number" value={lens.maxPortraits ?? 48} onChange={(event) => patchLens(index, { maxPortraits: Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>Review status</span>
                  <select value={lens.reviewStatus ?? 'draft'} onChange={(event) => patchLens(index, { reviewStatus: event.target.value as StoryLensConfig['reviewStatus'] })}>
                    <option value="draft">Draft</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
                <label className="field portal-lens-card__wide">
                  <span>Prompt</span>
                  <input value={lens.prompt} onChange={(event) => patchLens(index, { prompt: event.target.value })} />
                </label>
                <label className="field portal-lens-card__wide">
                  <span>Description</span>
                  <textarea value={lens.description} onChange={(event) => patchLens(index, { description: event.target.value })} rows={3} />
                </label>
                <label className="field">
                  <span>Keyword terms</span>
                  <textarea value={joinList(lens.terms)} onChange={(event) => patchLens(index, { terms: parseListInput(event.target.value) })} rows={7} />
                </label>
                <label className="field">
                  <span>Theme signals</span>
                  <textarea value={joinList(lens.themes)} onChange={(event) => patchLens(index, { themes: parseListInput(event.target.value) })} rows={7} />
                </label>
                <label className="field">
                  <span>Pinned person IDs</span>
                  <textarea value={joinList(lens.pinnedPersonIds ?? [])} onChange={(event) => patchLens(index, { pinnedPersonIds: parseListInput(event.target.value) })} rows={5} />
                </label>
                <label className="field">
                  <span>Hidden person IDs</span>
                  <textarea value={joinList(lens.excludedPersonIds ?? [])} onChange={(event) => patchLens(index, { excludedPersonIds: parseListInput(event.target.value) })} rows={5} />
                </label>
                <label className="field portal-lens-card__wide">
                  <span>Curator notes</span>
                  <textarea value={joinList(lens.curatorNotes ?? [])} onChange={(event) => patchLens(index, { curatorNotes: parseListInput(event.target.value) })} rows={3} />
                </label>
              </div>

              <StoryLensPreview
                inductees={inductees}
                lens={lens}
                matches={previewMatches}
                onExcludePerson={(personId) => patchLens(index, {
                  excludedPersonIds: addListValue(lens.excludedPersonIds ?? [], personId),
                  pinnedPersonIds: removeListValue(lens.pinnedPersonIds ?? [], personId),
                })}
                onPinPerson={(personId) => patchLens(index, {
                  pinnedPersonIds: addListValue(lens.pinnedPersonIds ?? [], personId),
                  excludedPersonIds: removeListValue(lens.excludedPersonIds ?? [], personId),
                })}
                onRestorePerson={(personId) => patchLens(index, {
                  excludedPersonIds: removeListValue(lens.excludedPersonIds ?? [], personId),
                })}
                onUnpinPerson={(personId) => patchLens(index, {
                  pinnedPersonIds: removeListValue(lens.pinnedPersonIds ?? [], personId),
                })}
              />

              <footer className="portal-lens-card__actions">
                <button disabled={index === 0} type="button" onClick={() => moveLens(index, -1)}>Move Up</button>
                <button disabled={index === draft.lenses.length - 1} type="button" onClick={() => moveLens(index, 1)}>Move Down</button>
                <button type="button" onClick={() => duplicateLens(index)}>Duplicate</button>
                <button type="button" onClick={() => removeLens(index)}>Remove</button>
              </footer>
            </article>
          );
        })}
        {draft.lenses.length === 0 && <div className="portal-empty-state">No Story Lenses are defined.</div>}
      </div>
    </section>
  );
}

function StoryLensPreview({
  inductees,
  lens,
  matches,
  onExcludePerson,
  onPinPerson,
  onRestorePerson,
  onUnpinPerson,
}: {
  inductees: Inductee[];
  lens: StoryLensConfig;
  matches: StoryLensMatch[];
  onExcludePerson: (personId: string) => void;
  onPinPerson: (personId: string) => void;
  onRestorePerson: (personId: string) => void;
  onUnpinPerson: (personId: string) => void;
}) {
  const peopleById = useMemo(() => new Map(inductees.map((inductee) => [inductee.id, inductee])), [inductees]);
  const pinnedIds = new Set(lens.pinnedPersonIds ?? []);
  const excludedIds = lens.excludedPersonIds ?? [];
  const excludedPeople = excludedIds.map((id) => peopleById.get(id)).filter((inductee): inductee is Inductee => Boolean(inductee));

  return (
    <section className="portal-lens-preview" aria-label={`${lens.label || lens.id} preview`}>
      <header className="portal-lens-preview__header">
        <div>
          <strong>Live preview</strong>
          <span>{matches.length} portraits / {pinnedIds.size} pinned / {excludedIds.length} hidden</span>
        </div>
      </header>

      <div className="portal-lens-preview__people">
        {matches.slice(0, 10).map((match) => {
          const isPinned = pinnedIds.has(match.inductee.id);
          return (
            <article className={isPinned ? 'portal-lens-preview-person portal-lens-preview-person--pinned' : 'portal-lens-preview-person'} key={match.inductee.id}>
              <FallbackImage
                alt={match.inductee.imageAltText}
                className="portal-lens-preview-person__image"
                fallbackClassName="portal-lens-preview-person__fallback"
                fallbackLabel={initials(match.inductee.name)}
                src={match.inductee.primaryImageUrl}
              />
              <div>
                <strong>{match.inductee.name}</strong>
                <span>{match.inductee.classYear ? `Class of ${match.inductee.classYear}` : 'Year unknown'} / {countryOrRegionLabel(match.inductee)}</span>
                <small>{match.reasons.join(' / ') || `Score ${match.score}`}</small>
              </div>
              <div className="portal-lens-preview-person__actions">
                {isPinned ? (
                  <button type="button" onClick={() => onUnpinPerson(match.inductee.id)}>Unpin</button>
                ) : (
                  <button type="button" onClick={() => onPinPerson(match.inductee.id)}>Pin</button>
                )}
                <button type="button" onClick={() => onExcludePerson(match.inductee.id)}>Hide</button>
              </div>
            </article>
          );
        })}
        {matches.length === 0 && <div className="portal-empty-state">No preview matches yet.</div>}
      </div>

      {excludedPeople.length > 0 && (
        <div className="portal-lens-preview__hidden" aria-label="Hidden people">
          <strong>Hidden from this lens</strong>
          {excludedPeople.map((inductee) => (
            <button key={inductee.id} type="button" onClick={() => onRestorePerson(inductee.id)}>
              Restore {inductee.name}
            </button>
          ))}
          {excludedIds.length > excludedPeople.length && <span>{excludedIds.length - excludedPeople.length} unknown hidden IDs</span>}
        </div>
      )}
    </section>
  );
}

function RelationshipReviewPanel({
  rows,
  visibleRows,
  selectedRow,
  query,
  queue,
  queueOptions,
  storageState,
  draftCount,
  approvedRecordCount,
  approvedDraftCount,
  runnerAvailable,
  onClearAll,
  onClearDraft,
  onExportDrafts,
  onPatchDraft,
  onSaveApproved,
  onQueryChange,
  onQueueChange,
  onSelectRow,
}: {
  rows: RelationshipReviewRow[];
  visibleRows: RelationshipReviewRow[];
  selectedRow: RelationshipReviewRow | null;
  query: string;
  queue: RelationshipQueueMode;
  queueOptions: Array<{ mode: RelationshipQueueMode; label: string; count: number }>;
  storageState: DraftStorageResult;
  draftCount: number;
  approvedRecordCount: number;
  approvedDraftCount: number;
  runnerAvailable: boolean;
  onClearAll: () => void;
  onClearDraft: (id: string) => void;
  onExportDrafts: () => void;
  onPatchDraft: (id: string, patch: RelationshipDraftPatch) => void;
  onSaveApproved: () => void;
  onQueryChange: (query: string) => void;
  onQueueChange: (queue: RelationshipQueueMode) => void;
  onSelectRow: (rowId: string) => void;
}) {
  const inferredCount = rows.filter((row) => row.edge.provenance === 'inferred').length;
  const hiddenCount = rows.filter((row) => row.reviewStatus === 'hidden').length;
  const approvedCount = rows.filter((row) => row.reviewStatus === 'approved').length;
  const selectedDraft = selectedRow?.draft;
  const selectedProvenance = selectedDraft?.provenanceOverride ?? selectedRow?.edge.provenance ?? 'inferred';
  const selectedType = selectedDraft?.typeOverride ?? selectedRow?.edge.type ?? 'shared_theme';

  function patchSelected(patch: RelationshipDraftPatch) {
    if (!selectedRow) return;
    onPatchDraft(selectedRow.id, patch);
  }

  return (
    <section className="portal-relationships" aria-label="Relationship review">
      <div className="portal-readiness__intro portal-relationships__intro">
        <div>
          <p className="eyebrow">Relationships</p>
          <h3>Review connection evidence</h3>
          <p>Inferred links stay possible until staff approves or documents them.</p>
        </div>
        <div className="portal-relationship-actions">
          <button disabled={!runnerAvailable || approvedDraftCount === 0} type="button" onClick={onSaveApproved}>Save Approved Links</button>
          <button disabled={draftCount === 0} type="button" onClick={onExportDrafts}>Export Review JSON</button>
          <button disabled={draftCount === 0} type="button" onClick={onClearAll}>Clear Drafts</button>
        </div>
      </div>

      <div className="portal-lenses__summary">
        <MetricCard label="Connection Edges" value={rows.length} detail={`${visibleRows.length} shown`} />
        <MetricCard label="Inferred" value={inferredCount} detail="possible until reviewed" />
        <MetricCard label="Approved" value={approvedCount} detail={`${hiddenCount} hidden`} />
        <MetricCard label="Local Drafts" value={draftCount} detail={`${approvedDraftCount} ready / ${approvedRecordCount} total / ${storageState.message}`} />
      </div>

      <div className="portal-relationship-layout">
        <aside className="portal-relationship-queue" aria-label="Relationship queue">
          <div className="review-controls portal-controls">
            <label className="field field--search">
              <span>Search</span>
              <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Person, target, reason, type, note" type="search" />
            </label>
            <label className="field">
              <span>Queue</span>
              <select value={queue} onChange={(event) => onQueueChange(event.target.value as RelationshipQueueMode)}>
                {queueOptions.map((option) => (
                  <option key={option.mode} value={option.mode}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
          </div>

          <div className="portal-relationship-queue__list" aria-label="Relationship rows">
            {visibleRows.map((row) => (
              <button
                className={selectedRow?.id === row.id ? 'portal-relationship-row portal-relationship-row--active' : 'portal-relationship-row'}
                key={row.id}
                type="button"
                onClick={() => onSelectRow(row.id)}
              >
                <span>
                  <strong>{row.sourceNode.label} -&gt; {row.targetNode.label}</strong>
                  {row.draft && <em>Edited</em>}
                </span>
                <small>{relationshipProvenanceLabel(row.effectiveProvenance)} / {relationshipTypeLabel(row.effectiveType)} / {relationshipSourceLabel(row.edge.source)}</small>
                <span>{row.effectiveLabel}</span>
              </button>
            ))}
            {visibleRows.length === 0 && <div className="portal-empty-state">No relationships match this queue.</div>}
          </div>
        </aside>

        <section className="portal-relationship-editor" aria-label="Selected relationship">
          {selectedRow ? (
            <>
              <div className="portal-relationship-editor__hero">
                <RelationshipNodeCard node={selectedRow.sourceNode} label="Source" />
                <div className="portal-relationship-editor__link">
                  <span className={`portal-relationship-provenance portal-relationship-provenance--${selectedRow.effectiveProvenance}`}>
                    {relationshipProvenanceLabel(selectedRow.effectiveProvenance)}
                  </span>
                  <strong>{relationshipTypeLabel(selectedRow.effectiveType)}</strong>
                  <p>{selectedRow.effectiveLabel}</p>
                </div>
                <RelationshipNodeCard node={selectedRow.targetNode} label="Target" />
              </div>

              <div className="portal-relationship-warning">
                {selectedRow.edge.provenance === 'inferred'
                  ? 'This relationship is inferred from prepared metadata and should remain possible until staff approves it.'
                  : 'This relationship already comes from curated or documented data; staff can still annotate it.'}
              </div>

              <div className="portal-quick-actions">
                <button type="button" onClick={() => patchSelected({ reviewStatus: 'approved', provenanceOverride: 'curated', displayLabel: selectedRow.effectiveLabel, referenceNote: selectedRow.effectiveNote })}>Approve As Curated</button>
                <button type="button" onClick={() => patchSelected({ reviewStatus: 'needs-research' })}>Needs Research</button>
                <button type="button" onClick={() => patchSelected({ reviewStatus: 'hidden' })}>Hide Link</button>
                <button disabled={!selectedDraft} type="button" onClick={() => onClearDraft(selectedRow.id)}>Clear Draft</button>
              </div>

              <div className="portal-form-grid">
                <fieldset className="portal-fieldset">
                  <legend>Review Decision</legend>
                  <label className="field">
                    <span>Status</span>
                    <select value={selectedDraft?.reviewStatus ?? ''} onChange={(event) => patchSelected({ reviewStatus: relationshipStatusValue(event.target.value) })}>
                      <option value="">Unreviewed</option>
                      <option value="approved">Approved</option>
                      <option value="needs-research">Needs research</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Provenance</span>
                    <select value={selectedProvenance} onChange={(event) => patchSelected({ provenanceOverride: event.target.value as RelationshipProvenance })}>
                      <option value="inferred">Inferred</option>
                      <option value="curated">Curated</option>
                      <option value="documented">Documented</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Relationship type</span>
                    <select value={selectedType} onChange={(event) => patchSelected({ typeOverride: event.target.value as RelationshipType })}>
                      {relationshipTypeOptions.map((type) => (
                        <option key={type} value={type}>{relationshipTypeLabel(type)}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>

                <fieldset className="portal-fieldset portal-fieldset--wide">
                  <legend>Visitor Label</legend>
                  <label className="field">
                    <span>Display label</span>
                    <input value={selectedDraft?.displayLabel ?? selectedRow.edge.label} onChange={(event) => patchSelected({ displayLabel: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Reference note</span>
                    <textarea value={selectedDraft?.referenceNote ?? selectedRow.edge.referenceNote ?? ''} onChange={(event) => patchSelected({ referenceNote: event.target.value })} rows={3} />
                  </label>
                  <label className="field">
                    <span>Curator note</span>
                    <textarea value={selectedDraft?.curatorNote ?? ''} onChange={(event) => patchSelected({ curatorNote: event.target.value })} rows={3} />
                  </label>
                </fieldset>
              </div>
            </>
          ) : (
            <div className="portal-empty-state">No relationship selected.</div>
          )}
        </section>
      </div>
    </section>
  );
}

function RelationshipNodeCard({ node, label }: { node: ConnectionNode; label: string }) {
  return (
    <div className="portal-relationship-node">
      {node.inductee ? (
        <FallbackImage
          alt={node.inductee.imageAltText}
          className="portal-relationship-node__image"
          fallbackClassName="portal-relationship-node__fallback"
          fallbackLabel={initials(node.inductee.name)}
          src={node.inductee.primaryImageUrl}
        />
      ) : (
        <span className="portal-relationship-node__entity">{entityInitials(node.label)}</span>
      )}
      <span>{label} / {nodeKindLabel(node.kind)}</span>
      <strong>{node.label}</strong>
      {node.inductee && <small>{node.inductee.classYear ? `Class of ${node.inductee.classYear}` : 'Year unknown'} / {countryOrRegionLabel(node.inductee)}</small>}
    </div>
  );
}

function ProfileEditor({
  inductee,
  draft,
  mediaRecord,
  needs,
  draftIssues,
  saveState,
  onPatch,
  onClear,
  onOpenProfile,
}: {
  inductee: Inductee;
  draft?: ReviewDraft;
  mediaRecord?: MediaManifestRecord;
  needs: string[];
  draftIssues: DraftIssue[];
  saveState: DraftStorageResult;
  onPatch: (patch: DraftPatch) => void;
  onClear: () => void;
  onOpenProfile: () => void;
}) {
  const displayName = draft?.displayName ?? inductee.name;
  const sortName = draft?.sortName ?? inductee.sortName;
  const pronunciation = draft?.pronunciation ?? inductee.pronunciation;
  const approvedSummary = draft?.approvedSummary ?? inductee.storySummary;
  const documentedContextLine = draft?.documentedContextLine ?? inductee.documentedContextLine;
  const honoredForText = draft?.honoredForSummary ?? inductee.honoredForSummary;
  const lifeWorkSummary = draft?.lifeWorkSummary ?? inductee.lifeWorkSummary;
  const approvedThemeTags = draft?.approvedThemeTags ?? inductee.themeTags;
  const approvedCountryTags = draft?.approvedCountryTags ?? inductee.countryTags;
  const countryNotes = draft?.countryNotes ?? inductee.countryTagsNote;
  const approvedCommunityTags = draft?.approvedCommunityTags ?? inductee.communityTags;
  const primaryImage = mediaRecord?.images?.primary;
  const imageSourceUrl = draft?.imageSourceUrl ?? primaryImage?.sourceUrl ?? '';
  const firstVideo = mediaRecord?.videos?.[0];
  const videoSourceUrls = draft?.videoSourceUrls ?? (mediaRecord?.videos ?? []).map((video) => video.sourceUrl ?? '').filter(Boolean);
  const youtubeVideoIds = draft?.youtubeVideoIds ?? (mediaRecord?.videos ?? []).map((video) => video.youtubeVideoId ?? '').filter(Boolean);
  const hasVideoReview = inductee.hasVideo || videoSourceUrls.length > 0 || youtubeVideoIds.length > 0;

  return (
    <div className="portal-editor">
      <div className="portal-editor__hero">
        <div className="portal-editor__identity">
          <span className="portal-editor__eyebrow">Selected Profile</span>
          <h3>{inductee.name}</h3>
          <p>{inductee.classYear ?? 'Year unknown'} / {countryOrRegionLabel(inductee)}</p>
        </div>
        <div className="portal-editor__actions">
          <span className={saveState.ok ? 'portal-save-state portal-save-state--ok' : 'portal-save-state portal-save-state--bad'}>
            {saveState.message}
          </span>
          <button type="button" onClick={onOpenProfile}>Preview</button>
          <button type="button" onClick={onClear} disabled={!draft}>Clear Draft</button>
        </div>
      </div>

      <div className="portal-editor__needs">
        {needs.length > 0 ? needs.slice(0, 6).map((need) => <Chip key={need} label={need} tone="warn" />) : <Chip label="No open review flags" tone="ok" />}
      </div>

      {draftIssues.length > 0 && (
        <div className="portal-validation" aria-label="Draft validation">
          <strong>Before export</strong>
          {draftIssues.map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={`${issue.id}-${issue.message}`}>
              {issue.message}
            </span>
          ))}
        </div>
      )}

      <div className="portal-quick-actions" aria-label="Quick decisions">
        <button type="button" onClick={() => onPatch({ approvedSummary, summaryApproved: true })}>Approve Summary</button>
        <button type="button" onClick={() => onPatch({ approvedThemeTags, approvedCountryTags, countryNotes, themeTagsApproved: true, countryTagsApproved: true })}>Approve Metadata</button>
        <button type="button" onClick={() => onPatch({ primaryImageAltText: primaryImage?.altText ?? inductee.imageAltText, imageRightsStatus: 'approved', imageRightsApproved: true })}>Approve Image</button>
        <button type="button" onClick={() => onPatch({ plainLanguageReview: 'approved', sensitiveContentReview: 'approved', imageDescriptionReview: 'approved', accessibilityApproved: true })}>Approve Accessibility</button>
        <button type="button" onClick={() => onPatch({ approvalStatus: 'approved', approveProfile: true })}>Approve Profile</button>
      </div>

      <div className="portal-form-grid">
        <fieldset className="portal-fieldset">
          <legend>Profile Status</legend>
          <label className="field">
            <span>Approval status</span>
            <select value={draft?.approvalStatus ?? inductee.approvalStatus} onChange={(event) => onPatch({ approvalStatus: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="field">
            <span>Review priority</span>
            <select value={draft?.reviewPriority ?? inductee.reviewPriority} onChange={(event) => onPatch({ reviewPriority: event.target.value })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="standard">Standard</option>
            </select>
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.approveProfile)} onChange={(event) => onPatch({ approveProfile: event.target.checked })} type="checkbox" />
            <span>Mark profile approved on import</span>
          </label>
          <label className="portal-check">
            <input checked={draft?.featured ?? inductee.featured} onChange={(event) => onPatch({ featured: event.target.checked })} type="checkbox" />
            <span>Feature this person</span>
          </label>
          <label className="portal-check">
            <input checked={draft?.featuredCandidate ?? inductee.featuredCandidate} onChange={(event) => onPatch({ featuredCandidate: event.target.checked })} type="checkbox" />
            <span>Keep as featured candidate</span>
          </label>
          <label className="field">
            <span>Attract priority</span>
            <input
              min="0"
              type="number"
              value={draft?.attractPriority ?? inductee.attractPriority}
              onChange={(event) => onPatch({ attractPriority: Number(event.target.value) })}
            />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Identity</legend>
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(event) => onPatch({ displayName: event.target.value })} />
          </label>
          <label className="field">
            <span>Sort name</span>
            <input value={sortName} onChange={(event) => onPatch({ sortName: event.target.value })} />
          </label>
          <label className="field">
            <span>Pronunciation</span>
            <input value={pronunciation} onChange={(event) => onPatch({ pronunciation: event.target.value })} />
          </label>
          <label className="field">
            <span>Source profile URL</span>
            <input value={inductee.profileUrl} readOnly />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset portal-fieldset--wide">
          <legend>Story Summary</legend>
          <label className="field">
            <span>Approved summary</span>
            <textarea value={approvedSummary} onChange={(event) => onPatch({ approvedSummary: event.target.value })} rows={5} />
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.summaryApproved)} onChange={(event) => onPatch({ summaryApproved: event.target.checked })} type="checkbox" />
            <span>Use this as the approved summary</span>
          </label>
        </fieldset>

        <fieldset className="portal-fieldset portal-fieldset--wide">
          <legend>Focused Hall Text</legend>
          <label className="field">
            <span>Documented context line</span>
            <input
              value={documentedContextLine}
              onChange={(event) => onPatch({ documentedContextLine: event.target.value })}
              placeholder="Concise sourced context shown beside the focused frame"
            />
          </label>
          <label className="field">
            <span>HONORED FOR summary</span>
            <textarea
              value={honoredForText}
              onChange={(event) => onPatch({ honoredForSummary: event.target.value })}
              rows={4}
              placeholder="Short curator-written reason for honor; falls back to biography summary when blank"
            />
          </label>
          <label className="field">
            <span>Life + Work overview</span>
            <textarea
              value={lifeWorkSummary}
              onChange={(event) => onPatch({ lifeWorkSummary: event.target.value })}
              rows={5}
              placeholder="Optional longer reading text for the anchored Life + Work panel"
            />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Metadata</legend>
          <label className="field">
            <span>Approved themes</span>
            <textarea value={joinList(approvedThemeTags)} onChange={(event) => onPatch({ approvedThemeTags: parseListInput(event.target.value) })} rows={4} />
          </label>
          <label className="field">
            <span>Approved countries</span>
            <textarea value={joinList(approvedCountryTags)} onChange={(event) => onPatch({ approvedCountryTags: parseListInput(event.target.value) })} rows={3} />
          </label>
          <label className="field">
            <span>Country note</span>
            <textarea value={countryNotes} onChange={(event) => onPatch({ countryNotes: event.target.value })} rows={3} />
          </label>
          <label className="field">
            <span>Approved communities</span>
            <textarea value={joinList(approvedCommunityTags)} onChange={(event) => onPatch({ approvedCommunityTags: parseListInput(event.target.value) })} rows={3} />
          </label>
          <div className="portal-check-grid">
            <label className="portal-check">
              <input checked={Boolean(draft?.themeTagsApproved)} onChange={(event) => onPatch({ themeTagsApproved: event.target.checked })} type="checkbox" />
              <span>Approve themes</span>
            </label>
            <label className="portal-check">
              <input checked={Boolean(draft?.countryTagsApproved)} onChange={(event) => onPatch({ countryTagsApproved: event.target.checked })} type="checkbox" />
              <span>Approve countries</span>
            </label>
            <label className="portal-check">
              <input checked={Boolean(draft?.communityTagsApproved)} onChange={(event) => onPatch({ communityTagsApproved: event.target.checked })} type="checkbox" />
              <span>Approve communities</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Media</legend>
          <label className="field">
            <span>Primary image alt text</span>
            <textarea value={draft?.primaryImageAltText ?? primaryImage?.altText ?? inductee.imageAltText} onChange={(event) => onPatch({ primaryImageAltText: event.target.value })} rows={3} />
          </label>
          <label className="field">
            <span>Primary image source URL</span>
            <input value={imageSourceUrl} onChange={(event) => onPatch({ imageSourceUrl: event.target.value })} />
          </label>
          <label className="field">
            <span>Image rights</span>
            <select value={draft?.imageRightsStatus ?? primaryImage?.rightsStatus ?? inductee.imageRightsStatus} onChange={(event) => onPatch({ imageRightsStatus: event.target.value })}>
              <option value="needs-review">Needs review</option>
              <option value="approved">Approved</option>
              <option value="restricted">Restricted</option>
              <option value="not-applicable">Not applicable</option>
            </select>
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.imageRightsApproved)} onChange={(event) => onPatch({ imageRightsApproved: event.target.checked })} type="checkbox" />
            <span>Approve image rights</span>
          </label>

          {hasVideoReview ? (
            <>
              <label className="field">
                <span>Video source URLs</span>
                <textarea value={joinList(videoSourceUrls)} onChange={(event) => onPatch({ videoSourceUrls: parseListInput(event.target.value) })} rows={3} />
              </label>
              <label className="field">
                <span>YouTube video IDs</span>
                <textarea value={joinList(youtubeVideoIds)} onChange={(event) => onPatch({ youtubeVideoIds: parseListInput(event.target.value) })} rows={2} />
              </label>
              <label className="field">
                <span>Video rights</span>
                <select value={draft?.videoRightsStatus ?? firstVideo?.rightsStatus ?? inductee.videoRightsStatus} onChange={(event) => onPatch({ videoRightsStatus: event.target.value })}>
                  <option value="needs-review">Needs review</option>
                  <option value="approved">Approved</option>
                  <option value="restricted">Restricted</option>
                  <option value="not-applicable">Not applicable</option>
                </select>
              </label>
              <label className="field">
                <span>Caption status</span>
                <select value={draft?.captionStatus ?? firstVideo?.captionStatus ?? 'review-needed'} onChange={(event) => onPatch({ captionStatus: event.target.value })}>
                  <option value="review-needed">Review needed</option>
                  <option value="approved">Approved</option>
                  <option value="missing">Missing</option>
                  <option value="not-applicable">Not applicable</option>
                </select>
              </label>
              <label className="field">
                <span>Transcript status</span>
                <select value={draft?.transcriptStatus ?? firstVideo?.transcriptStatus ?? 'review-needed'} onChange={(event) => onPatch({ transcriptStatus: event.target.value })}>
                  <option value="review-needed">Review needed</option>
                  <option value="approved">Approved</option>
                  <option value="missing">Missing</option>
                  <option value="not-applicable">Not applicable</option>
                </select>
              </label>
              <div className="portal-check-grid">
                <label className="portal-check">
                  <input checked={Boolean(draft?.videoRightsApproved)} onChange={(event) => onPatch({ videoRightsApproved: event.target.checked })} type="checkbox" />
                  <span>Approve video rights</span>
                </label>
                <label className="portal-check">
                  <input checked={Boolean(draft?.captionsApproved)} onChange={(event) => onPatch({ captionsApproved: event.target.checked })} type="checkbox" />
                  <span>Approve captions</span>
                </label>
                <label className="portal-check">
                  <input checked={Boolean(draft?.transcriptApproved)} onChange={(event) => onPatch({ transcriptApproved: event.target.checked })} type="checkbox" />
                  <span>Approve transcript</span>
                </label>
              </div>
            </>
          ) : (
            <div className="portal-empty-state">No video linked for this profile.</div>
          )}

          <label className="field">
            <span>Media notes</span>
            <textarea value={joinList(draft?.mediaNotes ?? mediaRecord?.notes ?? [])} onChange={(event) => onPatch({ mediaNotes: parseListInput(event.target.value) })} rows={3} />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Accessibility</legend>
          <label className="field">
            <span>Plain language</span>
            <select value={draft?.plainLanguageReview ?? 'needed'} onChange={(event) => onPatch({ plainLanguageReview: event.target.value })}>
              <option value="needed">Needed</option>
              <option value="approved">Approved</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="field">
            <span>Sensitive content</span>
            <select value={draft?.sensitiveContentReview ?? 'needed'} onChange={(event) => onPatch({ sensitiveContentReview: event.target.value })}>
              <option value="needed">Needed</option>
              <option value="approved">Approved</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="field">
            <span>Image description</span>
            <select value={draft?.imageDescriptionReview ?? 'needed'} onChange={(event) => onPatch({ imageDescriptionReview: event.target.value })}>
              <option value="needed">Needed</option>
              <option value="approved">Approved</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.accessibilityApproved)} onChange={(event) => onPatch({ accessibilityApproved: event.target.checked })} type="checkbox" />
            <span>Mark accessibility approved</span>
          </label>
        </fieldset>

        <fieldset className="portal-fieldset portal-fieldset--wide">
          <legend>Curator Notes</legend>
          <label className="field">
            <span>Notes, one per line</span>
            <textarea value={joinList(draft?.curatorNotes ?? [])} onChange={(event) => onPatch({ curatorNotes: parseListInput(event.target.value) })} rows={4} />
          </label>
        </fieldset>
      </div>
    </div>
  );
}

function ReadinessPanel({
  summary,
  curation,
  media,
  inductees,
  drafts,
  onQueueChange,
}: {
  summary: ReturnType<typeof buildDashboardSummary>;
  curation: CurationReport | null;
  media: MediaReport | null;
  inductees: Inductee[];
  drafts: DraftMap;
  onQueueChange: (queue: QueueMode) => void;
}) {
  const countryIds = inductees.filter((item) => item.countryTagsSource !== 'curated').map((item) => item.id);
  const imageIds = media?.summary?.imageRightsNeedsReview ?? curation?.media?.imageRightsReviewNeeded ?? [];
  const videoIds = Array.from(new Set([...(media?.summary?.missingCaptions ?? []), ...(media?.summary?.missingTranscripts ?? []), ...(curation?.media?.captionTranscriptReviewNeeded ?? [])]));
  const accessibilityIds = Array.from(new Set([
    ...(curation?.accessibility?.plainLanguageReviewNeeded ?? []),
    ...(curation?.accessibility?.sensitiveContentReviewNeeded ?? []),
    ...(curation?.accessibility?.imageDescriptionReviewNeeded ?? []),
  ]));

  return (
    <section className="portal-readiness" aria-label="Kiosk readiness">
      <div className="portal-readiness__intro">
        <p className="eyebrow">Museum Readiness</p>
        <h3>{summary.wallReady ? 'Portrait wall build is runnable' : 'Portrait wall files need attention'}</h3>
        <p>Use these queues to move profiles from generated/imported metadata to curator-approved installation data. Wall readiness confirms local portrait files; kiosk readiness still requires rights and accessible media clearance.</p>
      </div>
      <div className="portal-readiness__grid">
        <ReadinessCard title="Profile approval" ready={summary.approvedProfiles + summary.draftApprovedProfiles} total={summary.totalProfiles} action="Open high priority" onClick={() => onQueueChange('high')} />
        <ReadinessCard title="Country labels" ready={summary.approvedCountries + summary.draftApprovedCountries} total={summary.totalProfiles} action="Review countries" onClick={() => onQueueChange('country')} ids={countryIds} />
        <ReadinessCard title="Summaries" ready={summary.approvedSummaries + summary.draftApprovedSummaries} total={summary.totalProfiles} action="Review summaries" onClick={() => onQueueChange('summary')} />
        <ReadinessCard title="Portrait wall images" ready={summary.primaryImagesWallReady} total={summary.totalProfiles} action="Review images" onClick={() => onQueueChange('image-rights')} ids={imageIds} />
        <ReadinessCard title="Primary image rights" ready={summary.primaryImagesReady + summary.draftApprovedImages} total={summary.totalProfiles} action="Review images" onClick={() => onQueueChange('image-rights')} ids={imageIds} />
        <ReadinessCard title="Video captions" ready={summary.videosReady + summary.draftApprovedVideos} total={Math.max(summary.videoItems, 1)} action="Review videos" onClick={() => onQueueChange('video-captions')} ids={videoIds} />
        <ReadinessCard title="Accessibility" ready={summary.draftApprovedAccessibility} total={summary.totalProfiles} action="Review accessibility" onClick={() => onQueueChange('accessibility')} ids={accessibilityIds} />
      </div>
      <div className="portal-readiness__notes">
        <strong>{Object.keys(drafts).length} local draft records staged</strong>
        <span>Drafts are browser-local until exported and applied through the project scripts.</span>
      </div>
    </section>
  );
}

function ExportPanel({
  draftCount,
  editedRows,
  reports,
  runner,
  drafts,
  draftIssues,
  applyPreviewJob,
  applyPreviewFresh,
  importInputRef,
  onClearDrafts,
  onExportDraftJson,
  onExportDecisionCsv,
  onExportVisibleCsv,
  onImportDraftJson,
  onRunScript,
  onApplyDrafts,
}: {
  draftCount: number;
  editedRows: Inductee[];
  reports: ReportState;
  runner: RunnerState;
  drafts: DraftMap;
  draftIssues: DraftIssue[];
  applyPreviewJob: RunnerJob | null;
  applyPreviewFresh: boolean;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
  onClearDrafts: () => void;
  onExportDraftJson: () => void;
  onExportDecisionCsv: () => void;
  onExportVisibleCsv: () => void;
  onImportDraftJson: (event: ChangeEvent<HTMLInputElement>) => void;
  onRunScript: (script: RunnerScript) => void;
  onApplyDrafts: (dryRun: boolean) => void;
}) {
  return (
    <section className="portal-exports" aria-label="Decision exports">
      <div className="portal-readiness__intro">
        <p className="eyebrow">Exports</p>
        <h3>Move portal decisions into the repo</h3>
        <p>Export the edited decision CSV, apply it with the existing scripts, regenerate data, and rebuild the kiosk.</p>
      </div>

      <div className="portal-export-actions">
        <button disabled={!runner.available || draftCount === 0 || runner.activeJob?.status === 'running'} type="button" onClick={() => onApplyDrafts(true)}>1. Dry Run Portal Edits</button>
        <button disabled={!runner.available || draftCount === 0 || !applyPreviewFresh || draftIssues.some((issue) => issue.severity === 'error') || runner.activeJob?.status === 'running'} type="button" onClick={() => onApplyDrafts(false)}>2. Apply Validated Edits</button>
        <button disabled={draftCount === 0} type="button" onClick={onExportDecisionCsv}>Export Edited Decisions CSV</button>
        <button disabled={draftCount === 0} type="button" onClick={onExportDraftJson}>Export Draft JSON</button>
        <button type="button" onClick={onExportVisibleCsv}>Export Current Queue CSV</button>
        <button type="button" onClick={() => importInputRef.current?.click()}>Import Draft JSON</button>
        <button disabled={draftCount === 0} type="button" onClick={onClearDrafts}>Clear Local Drafts</button>
      </div>
      <input ref={importInputRef} className="portal-file-input" accept="application/json,.json" type="file" onChange={onImportDraftJson} />

      <div className="portal-export-summary">
        <MetricCard label="Edited Records" value={editedRows.length} detail={`${draftCount} browser draft entries`} />
        <MetricCard label="Draft Warnings" value={draftIssues.length} detail={`${draftIssues.filter((issue) => issue.severity === 'error').length} blocking issues`} />
        <MetricCard label="Curation Errors" value={reports.curation?.validation?.errors?.length ?? 0} detail={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} />
        <MetricCard label="Media Errors" value={reports.media?.validation?.errors?.length ?? 0} detail={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} />
      </div>

      <ApplyPreviewPanel
        draftCount={draftCount}
        blockingIssueCount={draftIssues.filter((issue) => issue.severity === 'error').length}
        previewFresh={applyPreviewFresh}
        previewJob={applyPreviewJob}
      />

      <PortalRunnerPanel runner={runner} onRunScript={onRunScript} />

      {draftIssues.length > 0 && (
        <div className="portal-validation portal-validation--exports" aria-label="Draft export warnings">
          <strong>Review before applying</strong>
          {draftIssues.slice(0, 12).map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={`${issue.id}-${issue.message}`}>
              {issue.name}: {issue.message}
            </span>
          ))}
          {draftIssues.length > 12 && <span className="portal-validation__more">+{draftIssues.length - 12} more issues</span>}
        </div>
      )}

      <div className="portal-command-box">
        <strong>Runner apply sequence</strong>
        <code>1. Dry Run Portal Edits</code>
        <code>2. Review Apply Gate summary and runner job output</code>
        <code>3. Apply Validated Edits: apply, prepare data, validate reports/entities, build public app</code>
      </div>

      <div className="portal-draft-list">
        {editedRows.map((inductee) => (
          <div key={inductee.id}>
            <strong>{inductee.name}</strong>
            <span>{Object.keys(drafts[inductee.id] ?? {}).filter((key) => key !== 'id' && key !== 'updatedAt').length} edited fields</span>
          </div>
        ))}
        {editedRows.length === 0 && <div className="portal-empty-state">No local edits yet.</div>}
      </div>
    </section>
  );
}

function ApplyPreviewPanel({
  draftCount,
  blockingIssueCount,
  previewFresh,
  previewJob,
}: {
  draftCount: number;
  blockingIssueCount: number;
  previewFresh: boolean;
  previewJob: RunnerJob | null;
}) {
  const summary = previewJob?.meta?.applySummary;
  const dryRunResults = summary?.dryRunResults ?? [];
  const recordsChanged = dryRunResults.reduce((sum, result) => sum + (result.recordsChanged ?? 0), 0);

  return (
    <section className={previewFresh ? 'portal-apply-preview portal-apply-preview--ready' : 'portal-apply-preview'} aria-label="Portal apply preview">
      <div className="portal-apply-preview__header">
        <div>
          <p className="eyebrow">Apply Gate</p>
          <h4>{previewFresh ? 'Dry run complete for current edits' : 'Dry run required before apply'}</h4>
          <span>
            {draftCount === 0
              ? 'Create or import draft edits before applying.'
              : previewJob
                ? `Preview job ${previewJob.status}${previewJob.logPath ? ` / ${previewJob.logPath}` : ''}`
                : 'Run the dry run to generate a reviewable impact summary.'}
          </span>
        </div>
        <strong>{previewFresh ? 'READY' : 'LOCKED'}</strong>
      </div>

      <div className="portal-apply-preview__grid">
        <div>
          <span>Rows</span>
          <strong>{summary?.targetRows ?? draftCount}</strong>
        </div>
        <div>
          <span>Curation Inputs</span>
          <strong>{summary?.curationFieldInputs ?? 0}</strong>
        </div>
        <div>
          <span>Media Inputs</span>
          <strong>{summary?.mediaFieldInputs ?? 0}</strong>
        </div>
        <div>
          <span>Would Change</span>
          <strong>{recordsChanged || 'Run dry run'}</strong>
        </div>
        <div>
          <span>Blocking Issues</span>
          <strong>{blockingIssueCount}</strong>
        </div>
        <div>
          <span>Targets</span>
          <strong>{summary?.targets?.join(' + ') || 'curation + media'}</strong>
        </div>
      </div>

      {dryRunResults.length > 0 && (
        <div className="portal-apply-preview__results">
          {dryRunResults.map((result) => (
            <div key={result.label}>
              <strong>{result.label}</strong>
              <span>{result.recordsChanged ?? 0} records / {result.rowsRead ?? 0} rows / {result.status}</span>
              {(result.errors ?? 0) > 0 && <em>{result.errors} errors</em>}
              {(result.warnings ?? 0) > 0 && <em>{result.warnings} warnings</em>}
            </div>
          ))}
        </div>
      )}

      {summary?.affectedRecords && summary.affectedRecords.length > 0 && (
        <div className="portal-apply-preview__records" aria-label="Affected records preview">
          {summary.affectedRecords.slice(0, 10).map((record) => (
            <span key={record.id}>
              <strong>{record.name || record.id}</strong>
              {(record.curationFields?.length ?? 0) > 0 && ` curation: ${record.curationFields?.slice(0, 4).join(', ')}`}
              {(record.mediaFields?.length ?? 0) > 0 && ` media: ${record.mediaFields?.slice(0, 4).join(', ')}`}
            </span>
          ))}
          {summary.affectedRecords.length > 10 && <span>+{summary.affectedRecords.length - 10} more records in this preview</span>}
        </div>
      )}

      <div className="portal-apply-preview__pipeline">
        <strong>Apply pipeline</strong>
        {(summary?.pipeline ?? ['Apply decisions', 'Prepare data', 'Curation report', 'Media validate', 'Validate entities', 'Build public site']).map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
    </section>
  );
}

function PortalRunnerPanel({ runner, onRunScript }: { runner: RunnerState; onRunScript: (script: RunnerScript) => void }) {
  const latestJob = runner.activeJob ?? runner.jobs[0] ?? null;
  const jobLogDir = runner.health?.jobLogDir ?? '.portal/jobs';
  const git = runner.health?.git;
  const tokenLabel = runner.health?.tokenRequired === false
    ? 'Token not required'
    : runner.health?.tokenSource === 'environment'
      ? 'Token from environment'
      : 'Token required';
  const dirtyLabel = git?.available
    ? git.dirty
      ? `Dirty: ${git.changedFiles ?? 0} files`
      : 'Clean'
    : 'Git unavailable';

  return (
    <section className={runner.available ? 'portal-runner portal-runner--online' : 'portal-runner'} aria-label="Local script runner">
      <div className="portal-runner__header">
        <div>
          <p className="eyebrow">Local Runner</p>
          <h4>{runner.available ? 'Connected to localhost runner' : 'Runner not connected'}</h4>
          <span>{runner.available ? `Portal can run whitelisted scripts. Logs persist to ${jobLogDir}.` : 'Start it with npm run portal:server, paste the printed token, then reconnect.'}</span>
        </div>
        <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Refresh'}</button>
      </div>

      {runner.error && <div className="portal-runner__error">{runner.error}</div>}

      <div className="portal-runner-meta" aria-label="Runner status details">
        <span>{tokenLabel}</span>
        <span>Logs: {jobLogDir}</span>
        <span>Active jobs: {runner.health?.activeJobs ?? 0}</span>
        <span>Retains: {runner.health?.maxPersistedJobs ?? 80}</span>
        <span className={git?.dirty ? 'portal-runner-meta__warning' : ''}>{dirtyLabel}</span>
      </div>

      <div className="portal-runner-repo" aria-label="Repository status">
        <div>
          <span>Repo Root</span>
          <strong>{formatRepoPath(runner.health?.repoRoot ?? git?.root)}</strong>
        </div>
        <div>
          <span>Branch</span>
          <strong>{git?.available ? git.branch || 'Detached' : git?.error || 'Unavailable'}</strong>
        </div>
        <div>
          <span>Latest Commit</span>
          <strong>{formatGitCommit(git)}</strong>
        </div>
        <div>
          <span>Remote State</span>
          <strong>{formatAheadBehind(git)}</strong>
        </div>
        <div>
          <span>Last Validation</span>
          <strong>{formatRunnerJobSummary(runner.health?.lastSuccessfulValidation)}</strong>
        </div>
        <div>
          <span>Last Build</span>
          <strong>{formatRunnerJobSummary(runner.health?.lastSuccessfulBuild)}</strong>
        </div>
      </div>

      {git?.dirty && git.changes && git.changes.length > 0 && (
        <div className="portal-runner-changes" aria-label="Uncommitted changes">
          {git.changes.map((change) => (
            <span key={`${change.status}-${change.path}`}>{change.status} {change.path}</span>
          ))}
        </div>
      )}

      <div className="portal-runner-access portal-runner-access--embedded">
        <label className="field">
          <span>Runner token</span>
          <input
            autoComplete="off"
            type="password"
            value={runner.token}
            onChange={(event) => runner.setToken(event.target.value)}
            placeholder="Paste token printed by npm run portal:server"
          />
        </label>
        <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Reconnect'}</button>
      </div>

      <div className="portal-runner__scripts" aria-label="Available scripts">
        {runner.scripts.map((script) => (
          <button
            className={script.destructive ? 'portal-runner-script portal-runner-script--danger' : 'portal-runner-script'}
            disabled={!runner.available || runner.activeJob?.status === 'running'}
            key={script.id}
            type="button"
            onClick={() => onRunScript(script)}
          >
            <strong>{script.label}</strong>
            <span>{script.description}</span>
            {script.strict && <em>Strict</em>}
            {script.destructive && <em>Careful</em>}
          </button>
        ))}
        {runner.scripts.length === 0 && <div className="portal-empty-state">No runner scripts loaded.</div>}
      </div>

      {latestJob && (
        <div className="portal-runner-job" aria-label="Latest runner job">
          <div className="portal-runner-job__summary">
            <strong>{latestJob.label}</strong>
            <span className={`portal-runner-job__status portal-runner-job__status--${latestJob.status}`}>{latestJob.status}</span>
            {latestJob.currentStep && <span>{latestJob.currentStep}</span>}
            {latestJob.logPath && <span>Log: {latestJob.logPath}</span>}
          </div>
          {latestJob.steps && latestJob.steps.length > 0 && (
            <div className="portal-runner-steps">
              {latestJob.steps.map((step) => (
                <span className={`portal-runner-step portal-runner-step--${step.status}`} key={`${latestJob.id}-${step.label}`}>
                  {step.label}: {step.status}
                </span>
              ))}
            </div>
          )}
          <pre>{latestJob.output || 'No output yet.'}</pre>
        </div>
      )}
    </section>
  );
}

function useReviewReports(): ReportState {
  const [state, setState] = useState<ReportState>({ curation: null, media: null, manifest: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchJson<CurationReport>(reportUrls.curation), fetchJson<MediaReport>(reportUrls.media), fetchJson<MediaManifest>(reportUrls.manifest)])
      .then(([curation, media, manifest]) => {
        if (!cancelled) setState({ curation, media, manifest, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ curation: null, media: null, manifest: null, loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function useSourceCurationPacket(): SourceCurationState {
  const [state, setState] = useState<SourceCurationState>({ packet: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    fetchJson<SourceCurationPacket>(reportUrls.sourceCuration)
      .then((packet) => {
        if (!cancelled) setState({ packet: normalizeSourceCurationPacket(packet), loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ packet: emptySourceCurationPacket(), loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function useStoryLensDocument(): StoryLensEditorState {
  const [document, setDocument] = useState<StoryLensDocument | null>(null);
  const [draft, setDraft] = useState<StoryLensDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isDirty = useMemo(() => JSON.stringify(document) !== JSON.stringify(draft), [document, draft]);

  async function refresh() {
    setLoading(true);
    try {
      const payload = await fetchJson<StoryLensDocument>(reportUrls.storyLenses);
      const normalized = normalizeStoryLensDocument(payload);
      setDocument(normalized);
      setDraft(normalized);
      setError('');
    } catch (errorValue) {
      const fallback = emptyStoryLensDocument();
      setDocument(fallback);
      setDraft(fallback);
      setError(errorValue instanceof Error ? errorValue.message : 'Could not load Story Lens JSON.');
    } finally {
      setLoading(false);
    }
  }

  function acceptSavedDocument(savedDocument: StoryLensDocument) {
    const normalized = normalizeStoryLensDocument(savedDocument);
    setDocument(normalized);
    setDraft(normalized);
    setError('');
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { document, draft, loading, error, isDirty, setDraft, refresh, acceptSavedDocument };
}

function usePortalRunner(): RunnerState {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [token, setTokenValue] = useState(() => readSessionValue(runnerTokenStorageKey));
  const [health, setHealth] = useState<RunnerHealth | null>(null);
  const [scripts, setScripts] = useState<RunnerScript[]>([]);
  const [jobs, setJobs] = useState<RunnerJob[]>([]);

  const activeJob = jobs.find((job) => job.status === 'running' || job.status === 'queued') ?? null;

  function setToken(nextToken: string) {
    const cleanedToken = nextToken.trim();
    setTokenValue(cleanedToken);
    writeSessionValue(runnerTokenStorageKey, cleanedToken);
  }

  async function refresh() {
    setChecking(true);
    try {
      const [health, scriptPayload, jobPayload] = await Promise.all([
        fetchRunner<RunnerHealth>('/api/health', token),
        fetchRunner<{ scripts: RunnerScript[] }>('/api/scripts', token),
        fetchRunner<{ jobs: RunnerJob[] }>('/api/jobs', token),
      ]);
      setAvailable(Boolean(health.ok));
      setHealth(health);
      setScripts(scriptPayload.scripts ?? []);
      setJobs(jobPayload.jobs ?? []);
      setError('');
    } catch (errorValue) {
      setAvailable(false);
      setHealth(null);
      setScripts([]);
      setJobs([]);
      setError(errorValue instanceof Error ? errorValue.message : 'Local portal runner is not available.');
    } finally {
      setChecking(false);
    }
  }

  async function runScript(scriptId: string) {
    try {
      const payload = await postRunner<{ job: RunnerJob }>('/api/run', { scriptId }, token);
      await refresh();
      return payload.job;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not start script.');
      return null;
    }
  }

  async function applyDecisions(csv: string, options: { dryRun: boolean; previewJobId?: string; previewHash?: string }) {
    try {
      const payload = await postRunner<{ job: RunnerJob }>('/api/apply-decisions', { csv, ...options, targets: ['curation', 'media'] }, token);
      await refresh();
      return payload.job;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not start portal decision apply.');
      return null;
    }
  }

  async function saveStoryLenses(document: StoryLensDocument) {
    try {
      const payload = await postRunner<{ document: StoryLensDocument }>('/api/story-lenses', { document }, token);
      await refresh();
      return normalizeStoryLensDocument(payload.document);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not save Story Lens JSON.');
      return null;
    }
  }

  async function saveRelationships(records: RelationshipRecord[]) {
    try {
      const payload = await postRunner<{ records: RelationshipRecord[] }>('/api/relationships', { records }, token);
      await refresh();
      return payload.records ?? [];
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not save relationship JSON.');
      return null;
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, activeJob ? 1500 : 6000);
    return () => window.clearInterval(interval);
  }, [activeJob?.id, activeJob?.status, token]);

  return { available, checking, error, token, health, scripts, jobs, activeJob, setToken, refresh, runScript, applyDecisions, saveStoryLenses, saveRelationships };
}

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
}

async function fetchRunner<T>(path: string, token = ''): Promise<T> {
  const response = await fetch(`${portalRunnerBaseUrl}${path}`, {
    cache: 'no-store',
    headers: runnerHeaders(token),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `Portal runner ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function postRunner<T>(path: string, body: unknown, token = ''): Promise<T> {
  const response = await fetch(`${portalRunnerBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...runnerHeaders(token) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `Portal runner ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function runnerHeaders(token: string): HeadersInit {
  const cleanedToken = token.trim();
  return cleanedToken ? { 'x-cihof-portal-token': cleanedToken } : {};
}

function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeSessionValue(key: string, value: string) {
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Session storage can be unavailable in some locked-down kiosk browser modes.
  }
}

function buildDashboardSummary(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  const totalProfiles = inductees.length;
  const draftValues = Object.values(drafts);
  const approvedProfiles = inductees.filter((item) => item.approvalStatus === 'approved').length;
  const highPriority = inductees.filter((item) => item.reviewPriority === 'high').length;
  const mediumPriority = inductees.filter((item) => item.reviewPriority === 'medium').length;
  const standardPriority = inductees.filter((item) => item.reviewPriority === 'standard').length;
  const localPrimaryImages = inductees.filter((item) => item.primaryImageUrl.startsWith('/media/')).length;
  const primaryImagesWallReady = media?.summary?.primaryImagesWallReady ?? localPrimaryImages;
  const primaryImagesReady = media?.summary?.primaryImagesReady ?? 0;
  const videosReady = media?.summary?.videosReady ?? 0;
  const videoItems = media?.summary?.videoItems ?? 0;
  const missingCaptions = media?.summary?.missingCaptions?.length ?? 0;
  const approvedCountries = curation?.countries?.approved ?? inductees.filter((item) => item.countryTagsSource === 'curated').length;
  const inferredCountries = curation?.countries?.inferred ?? inductees.filter((item) => item.countryTagsSource === 'inferred').length;

  return {
    totalProfiles,
    approvedProfiles,
    draftProfiles: totalProfiles - approvedProfiles,
    highPriority,
    mediumPriority,
    standardPriority,
    approvedSummaries: curation?.summaries?.approved ?? 0,
    summaryDrafts: curation?.summaries?.draftOnly?.length ?? inductees.filter((item) => item.storySummarySource !== 'curated').length,
    truncatedDrafts: curation?.summaries?.truncatedDrafts?.length ?? 0,
    approvedThemes: curation?.themes?.approved ?? 0,
    themeCandidates: curation?.themes?.candidateOnly?.length ?? inductees.filter((item) => item.themeTagsSource !== 'curated').length,
    approvedCountries,
    inferredCountries,
    countryNeedsReview: inductees.filter((item) => item.countryTagsSource !== 'curated').length,
    localPrimaryImages,
    primaryImagesWallReady,
    primaryImagesReady,
    videosReady,
    videoItems,
    missingCaptions,
    draftApprovedProfiles: draftValues.filter((draft) => draft.approveProfile || draft.approvalStatus === 'approved').length,
    draftApprovedSummaries: draftValues.filter((draft) => draft.summaryApproved || Boolean(draft.approvedSummary)).length,
    draftApprovedCountries: draftValues.filter((draft) => draft.countryTagsApproved || (draft.approvedCountryTags?.length ?? 0) > 0).length,
    draftApprovedImages: draftValues.filter((draft) => draft.imageRightsApproved || draft.imageRightsStatus === 'approved').length,
    draftApprovedVideos: draftValues.filter((draft) => draft.videoRightsApproved || draft.captionsApproved || draft.transcriptApproved).length,
    draftApprovedAccessibility: draftValues.filter((draft) => draft.accessibilityApproved).length,
    wallReady: primaryImagesWallReady === totalProfiles && (media?.validation?.errors?.length ?? 0) === 0,
    kioskReady: primaryImagesReady === totalProfiles && videoItems === videosReady && (media?.validation?.errors?.length ?? 0) === 0,
  };
}

function buildQueueOptions(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  const options: Array<{ mode: QueueMode; label: string }> = [
    { mode: 'high', label: 'High priority' },
    { mode: 'edited', label: 'Local draft edits' },
    { mode: 'country', label: 'Country review' },
    { mode: 'summary', label: 'Summary drafts' },
    { mode: 'themes', label: 'Theme candidates' },
    { mode: 'image-rights', label: 'Image rights' },
    { mode: 'video-captions', label: 'Video captions' },
    { mode: 'accessibility', label: 'Accessibility' },
    { mode: 'featured', label: 'Featured candidates' },
    { mode: 'all', label: 'All profiles' },
  ];

  return options.map((option) => ({
    ...option,
    count: inductees.filter((inductee) => matchesQueue(inductee, option.mode, curation, media, drafts)).length,
  }));
}

function buildActionItems(summary: ReturnType<typeof buildDashboardSummary>, draftCount: number) {
  const items: Array<{ label: string; detail: string; queue: QueueMode; priority: number }> = [];

  if (draftCount > 0) {
    items.push({
      label: 'Review Staged Edits',
      detail: `${draftCount} local drafts should be exported or cleared`,
      queue: 'edited',
      priority: 0,
    });
  }
  if (summary.countryNeedsReview > summary.draftApprovedCountries) {
    items.push({
      label: 'Approve Countries',
      detail: `${summary.countryNeedsReview - summary.draftApprovedCountries} country labels still need review`,
      queue: 'country',
      priority: 1,
    });
  }
  if (summary.summaryDrafts > summary.draftApprovedSummaries) {
    items.push({
      label: 'Tighten Summaries',
      detail: `${summary.summaryDrafts - summary.draftApprovedSummaries} generated summaries need curator approval`,
      queue: 'summary',
      priority: 2,
    });
  }
  if (summary.missingCaptions > 0) {
    items.push({
      label: 'Fix Video Access',
      detail: `${summary.missingCaptions} caption files are still missing`,
      queue: 'video-captions',
      priority: 3,
    });
  }
  if (summary.primaryImagesWallReady < summary.totalProfiles) {
    items.push({
      label: 'Fix Portrait Files',
      detail: `${summary.totalProfiles - summary.primaryImagesWallReady} primary portraits are not local wall-ready`,
      queue: 'image-rights',
      priority: 4,
    });
  }
  if (summary.primaryImagesReady < summary.totalProfiles) {
    items.push({
      label: 'Approve Images',
      detail: `${summary.totalProfiles - summary.primaryImagesReady} primary images are not kiosk-ready`,
      queue: 'image-rights',
      priority: 5,
    });
  }
  if (items.length === 0) {
    items.push({
      label: 'Audit All Profiles',
      detail: 'No urgent queue is currently above threshold',
      queue: 'all',
      priority: 9,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

function matchesQueue(inductee: Inductee, queue: QueueMode, curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  if (queue === 'all') return true;
  if (queue === 'edited') return Boolean(drafts[inductee.id]);
  if (queue === 'high') return inductee.reviewPriority === 'high';
  if (queue === 'country') return inductee.countryTagsSource !== 'curated' || Boolean(drafts[inductee.id]?.countryTagsApproved);
  if (queue === 'featured') return inductee.featuredCandidate && !inductee.featured;
  if (queue === 'summary') return inductee.storySummarySource !== 'curated';
  if (queue === 'themes') return inductee.themeTagsSource !== 'curated';
  if (queue === 'image-rights') return inductee.imageRightsStatus !== 'approved' || hasId(media?.summary?.imageRightsNeedsReview, inductee.id);
  if (queue === 'video-captions') return Boolean(curation?.media?.captionTranscriptReviewNeeded?.includes(inductee.id)) || (inductee.hasVideo && inductee.videoRightsStatus !== 'approved');
  if (queue === 'accessibility') {
    return Boolean(
      curation?.accessibility?.plainLanguageReviewNeeded?.includes(inductee.id) ||
        curation?.accessibility?.sensitiveContentReviewNeeded?.includes(inductee.id) ||
        curation?.accessibility?.imageDescriptionReviewNeeded?.includes(inductee.id),
    );
  }
  return true;
}

function getDraftIssues(inductee: Inductee, draft: ReviewDraft | undefined, mediaRecord?: MediaManifestRecord): DraftIssue[] {
  if (!draft) return [];
  const issues: DraftIssue[] = [];
  const add = (message: string, severity: DraftIssue['severity'] = 'warning') => {
    issues.push({ id: inductee.id, name: inductee.name, message, severity });
  };
  const firstVideo = mediaRecord?.videos?.[0];
  const approvedSummary = draft.approvedSummary?.trim() ?? '';

  if (draft.displayName !== undefined && draft.displayName.trim().length === 0) add('Display name cannot be empty.', 'error');
  if (draft.documentedContextLine && draft.documentedContextLine.trim().length > 120) add('Documented context line is long for the focused Hall panel.');
  if (draft.honoredForSummary && draft.honoredForSummary.trim().split(/\s+/).filter(Boolean).length > 58) {
    add('HONORED FOR summary is long for the focused Hall panel.');
  }
  if (draft.summaryApproved && approvedSummary.length < 80) add('Approved summary is very short or empty.', 'error');
  if (draft.themeTagsApproved && (draft.approvedThemeTags?.length ?? 0) === 0) add('Theme approval is checked but no approved themes are staged.', 'error');
  if (draft.countryTagsApproved && (draft.approvedCountryTags?.length ?? 0) === 0) add('Country approval is checked but no approved countries are staged.', 'error');
  if (draft.communityTagsApproved && (draft.approvedCommunityTags?.length ?? 0) === 0) add('Community approval is checked but no approved communities are staged.');
  if (draft.approveProfile && !draft.summaryApproved && !draft.approvedSummary) add('Profile approval is staged before summary approval.');
  if (draft.approveProfile && !draft.countryTagsApproved && (draft.approvedCountryTags?.length ?? 0) === 0 && inductee.countryTagsSource !== 'curated') {
    add('Profile approval is staged before country metadata is curator-approved.');
  }
  if (draft.primaryImageAltText !== undefined && draft.primaryImageAltText.trim().length < 20) add('Primary image alt text is very short.');
  if (draft.imageRightsApproved && draft.imageRightsStatus && draft.imageRightsStatus !== 'approved') add('Image rights approval conflicts with a non-approved rights status.', 'error');
  if (draft.videoRightsApproved && draft.videoRightsStatus && draft.videoRightsStatus !== 'approved') add('Video rights approval conflicts with a non-approved rights status.', 'error');
  if (draft.captionsApproved && inductee.hasVideo && !firstVideo?.captionFilePath && !firstVideo?.captionRuntimePath) add('Captions are marked approved but no caption file is linked.');
  if (draft.transcriptApproved && inductee.hasVideo && !firstVideo?.transcriptFilePath && !firstVideo?.transcriptRuntimePath) {
    add('Transcript is marked approved but no transcript file is linked.');
  }
  if ((draft.videoRightsApproved || draft.captionsApproved || draft.transcriptApproved) && inductee.hasVideo && !mediaRecord?.videos?.length) {
    add('Video decisions are staged but no video record is loaded from the media manifest.', 'error');
  }
  if (draft.accessibilityApproved && (!draft.plainLanguageReview || !draft.sensitiveContentReview || !draft.imageDescriptionReview)) {
    add('Accessibility is marked approved without all three accessibility fields staged as approved.');
  }

  return issues;
}

function matchesSearch(inductee: Inductee, draft: ReviewDraft | undefined, search: string) {
  const draftText = draft
    ? [
        draft.displayName,
        draft.sortName,
        draft.pronunciation,
        draft.approvedSummary,
        draft.documentedContextLine,
        draft.honoredForSummary,
        draft.lifeWorkSummary,
        draft.countryNotes,
        ...(draft.approvedThemeTags ?? []),
        ...(draft.approvedCountryTags ?? []),
        ...(draft.approvedCommunityTags ?? []),
        ...(draft.curatorNotes ?? []),
        ...(draft.mediaNotes ?? []),
        draft.imageSourceUrl,
        ...(draft.videoSourceUrls ?? []),
        ...(draft.youtubeVideoIds ?? []),
      ].join(' ')
    : '';
  return [inductee.searchText, inductee.id, draftText].join(' ').toLowerCase().includes(search);
}

function getReviewNeeds(inductee: Inductee, curation: CurationReport | null, media: MediaReport | null, draft?: ReviewDraft) {
  const needs: string[] = [];
  const profileApproved = draft?.approveProfile || draft?.approvalStatus === 'approved' || inductee.approvalStatus === 'approved';
  const summaryApproved = draft?.summaryApproved || Boolean(draft?.approvedSummary) || inductee.storySummarySource === 'curated';
  const themesApproved = draft?.themeTagsApproved || (draft?.approvedThemeTags?.length ?? 0) > 0 || inductee.themeTagsSource === 'curated';
  const countriesApproved = draft?.countryTagsApproved || (draft?.approvedCountryTags?.length ?? 0) > 0 || inductee.countryTagsSource === 'curated';
  const imageApproved = draft?.imageRightsApproved || draft?.imageRightsStatus === 'approved' || inductee.imageRightsStatus === 'approved';
  const videoApproved = !inductee.hasVideo || draft?.videoRightsApproved || draft?.videoRightsStatus === 'approved' || inductee.videoRightsStatus === 'approved';
  const captionsApproved = !inductee.hasVideo || draft?.captionsApproved || draft?.captionStatus === 'approved';
  const transcriptApproved = !inductee.hasVideo || draft?.transcriptApproved || draft?.transcriptStatus === 'approved';
  const accessibilityApproved = draft?.accessibilityApproved;

  if (!profileApproved) needs.push('Approve profile metadata');
  if (!summaryApproved) needs.push('Approve or rewrite story summary');
  if (!themesApproved) needs.push('Approve theme tags');
  if (!countriesApproved) needs.push('Approve country tags');
  if (inductee.featuredCandidate && !inductee.featured && draft?.featured !== true) needs.push('Featured story decision');
  if (!imageApproved || hasId(curation?.media?.imageRightsReviewNeeded, inductee.id) || hasId(media?.summary?.imageRightsNeedsReview, inductee.id)) {
    needs.push('Approve primary image rights');
  }
  if (hasId(media?.summary?.missingPrimaryLocalFiles, inductee.id)) needs.push('Localize primary image');

  if (inductee.hasVideo) {
    if (!videoApproved || hasId(curation?.media?.videoRightsReviewNeeded, inductee.id) || hasId(media?.summary?.videoRightsNeedsReview, inductee.id)) {
      needs.push('Approve video rights');
    }
    if (!captionsApproved || hasId(curation?.media?.captionTranscriptReviewNeeded, inductee.id) || hasId(media?.summary?.missingCaptions, inductee.id)) needs.push('Add captions');
    if (!transcriptApproved || hasId(media?.summary?.missingTranscripts, inductee.id)) needs.push('Add transcript');
    if (hasId(media?.summary?.missingVideoLocalFiles, inductee.id)) needs.push('Localize video file');
    if (hasId(media?.summary?.missingVideoPosters, inductee.id)) needs.push('Add video poster');
  }

  if (!accessibilityApproved && hasId(curation?.accessibility?.plainLanguageReviewNeeded, inductee.id)) needs.push('Plain-language review');
  if (!accessibilityApproved && hasId(curation?.accessibility?.sensitiveContentReviewNeeded, inductee.id)) needs.push('Sensitive-content review');
  if (!accessibilityApproved && hasId(curation?.accessibility?.imageDescriptionReviewNeeded, inductee.id)) needs.push('Image description review');

  return Array.from(new Set(needs));
}

function emptyStoryLensDocument(): StoryLensDocument {
  return {
    schemaVersion: 1,
    source: {
      name: 'CIHOF trace themes',
      note: 'Curator-editable interpretive prompts for arranging portrait traces.',
    },
    lenses: [],
  };
}

function normalizeStoryLensDocument(input: unknown): StoryLensDocument {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Partial<StoryLensDocument> : {};
  const sourceInfo = source.source && typeof source.source === 'object'
    ? {
        name: typeof source.source.name === 'string' ? source.source.name.trim() : 'CIHOF trace themes',
        note: typeof source.source.note === 'string' ? source.source.note.trim() : '',
      }
    : emptyStoryLensDocument().source;
  const lenses = Array.isArray(source.lenses) ? source.lenses.map(normalizeStoryLens).filter((lens): lens is StoryLensConfig => Boolean(lens)) : [];

  return {
    schemaVersion: typeof source.schemaVersion === 'number' ? source.schemaVersion : 1,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    source: sourceInfo,
    lenses,
  };
}

function normalizeStoryLens(input: unknown): StoryLensConfig | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const lens = input as Partial<StoryLensConfig>;
  return {
    id: slugifyLensId(lens.id ?? ''),
    label: cleanPortalString(lens.label),
    prompt: cleanPortalString(lens.prompt),
    description: cleanPortalString(lens.description),
    terms: cleanPortalList(lens.terms),
    themes: cleanPortalList(lens.themes),
    pinnedPersonIds: cleanPortalList(lens.pinnedPersonIds),
    excludedPersonIds: cleanPortalList(lens.excludedPersonIds),
    curatorNotes: cleanPortalList(lens.curatorNotes),
    reviewStatus: lens.reviewStatus === 'reviewed' || lens.reviewStatus === 'approved' ? lens.reviewStatus : 'draft',
    maxPortraits: typeof lens.maxPortraits === 'number' && Number.isFinite(lens.maxPortraits) ? Math.round(lens.maxPortraits) : 48,
    enabled: lens.enabled !== false,
  };
}

function getStoryLensDraftIssues(document: StoryLensDocument, inductees: Inductee[] = []): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const ids = new Set<string>();
  const validPersonIds = new Set(inductees.map((inductee) => inductee.id));
  const add = (message: string, severity: DraftIssue['severity'] = 'warning') => {
    issues.push({ id: 'story-lenses', name: 'Story Lenses', message, severity });
  };

  document.lenses.forEach((lens, index) => {
    const label = lens.label || lens.id || `Lens ${index + 1}`;
    if (!lens.id) add(`${label}: ID is required.`, 'error');
    if (lens.id && ids.has(lens.id)) add(`${label}: ID duplicates another lens.`, 'error');
    ids.add(lens.id);
    if (!lens.label) add(`${label}: short label is required.`, 'error');
    if (!lens.prompt) add(`${label}: prompt is required.`, 'error');
    if (!lens.description) add(`${label}: description is required.`, 'error');
    if (lens.terms.length + lens.themes.length === 0) add(`${label}: add at least one keyword term or theme signal.`, 'error');
    if (!Number.isFinite(lens.maxPortraits) || (lens.maxPortraits ?? 0) < 12 || (lens.maxPortraits ?? 0) > 96) {
      add(`${label}: max portraits must be from 12 to 96.`, 'error');
    }
    if (lens.terms.length < 3 && lens.themes.length === 0) add(`${label}: add more matching signals for reliable results.`);
    if (lens.prompt.length > 42) add(`${label}: prompt may be too long for the museum button.`);
    if (lens.description.length > 180) add(`${label}: description may be too long for the wall focus panel.`);
    if (lens.reviewStatus !== 'approved') add(`${label}: review status is ${lens.reviewStatus ?? 'draft'}.`);
    for (const personId of lens.pinnedPersonIds ?? []) {
      if (validPersonIds.size > 0 && !validPersonIds.has(personId)) add(`${label}: pinned person id ${personId} is not in the current inductee data.`, 'error');
    }
    for (const personId of lens.excludedPersonIds ?? []) {
      if (validPersonIds.size > 0 && !validPersonIds.has(personId)) add(`${label}: hidden person id ${personId} is not in the current inductee data.`, 'error');
    }
    const excludedIds = new Set(lens.excludedPersonIds ?? []);
    for (const personId of lens.pinnedPersonIds ?? []) {
      if (excludedIds.has(personId)) add(`${label}: ${personId} cannot be both pinned and hidden.`, 'error');
    }
  });

  if (document.lenses.filter((lens) => lens.enabled !== false).length === 0) add('At least one Story Lens should be enabled.', 'error');
  return issues;
}

function materializeApprovedRelationshipRecords(rows: RelationshipReviewRow[], existingRecords: RelationshipRecord[]) {
  const records = new Map<string, RelationshipRecord>();
  existingRecords.forEach((record) => records.set(relationshipRecordKey(record), record));

  rows.forEach((row) => {
    if (row.draft?.reviewStatus !== 'approved') return;
    const record = relationshipRowToRecord(row);
    if (record) records.set(relationshipRecordKey(record), record);
  });

  return Array.from(records.values()).sort((a, b) => (
    a.sourcePersonId.localeCompare(b.sourcePersonId) ||
    (a.targetEntityType ?? '').localeCompare(b.targetEntityType ?? '') ||
    a.targetEntityId.localeCompare(b.targetEntityId) ||
    a.type.localeCompare(b.type) ||
    a.displayLabel.localeCompare(b.displayLabel)
  ));
}

function relationshipRowToRecord(row: RelationshipReviewRow): RelationshipRecord | null {
  if (row.sourceNode.kind !== 'person' || !row.sourceNode.inductee) return null;
  if (row.targetNode.kind === 'person' && !row.targetNode.inductee) return null;

  const targetIsPerson = row.targetNode.kind === 'person';
  const referenceNote = [row.effectiveNote, row.draft?.curatorNote]
    .map((value) => cleanPortalString(value))
    .filter(Boolean)
    .join(' ');
  const record: RelationshipRecord = {
    sourcePersonId: row.sourceNode.inductee.id,
    targetEntityId: targetIsPerson && row.targetNode.inductee ? row.targetNode.inductee.id : row.targetNode.entityId,
    targetEntityType: row.targetNode.kind,
    type: row.effectiveType,
    displayLabel: cleanPortalString(row.effectiveLabel) || relationshipTypeLabel(row.effectiveType),
    provenance: row.effectiveProvenance === 'inferred' ? 'curated' : row.effectiveProvenance,
  };

  if (!targetIsPerson) record.targetDisplayName = row.targetNode.label;
  if (referenceNote) record.referenceNote = referenceNote;
  return record;
}

function relationshipRecordKey(record: RelationshipRecord) {
  return [
    record.sourcePersonId,
    record.targetEntityType ?? '',
    record.targetEntityId,
    record.type,
    record.displayLabel,
    record.provenance,
  ].join('|');
}

function buildRelationshipReviewRows(inductees: Inductee[], relationships: RelationshipRecord[], drafts: RelationshipDraftMap): RelationshipReviewRow[] {
  const graph = buildConnectionGraph(inductees, relationships);
  const uniqueEdges = new Map<string, ConnectionEdge>();

  graph.adjacency.forEach((edges) => {
    edges.forEach((edge) => uniqueEdges.set(edge.id, edge));
  });

  return Array.from(uniqueEdges.values())
    .map<RelationshipReviewRow | null>((edge) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) return null;

      const sourceNode = fromNode.kind === 'person' ? fromNode : toNode.kind === 'person' ? toNode : fromNode;
      const targetNode = sourceNode.id === fromNode.id ? toNode : fromNode;
      const draft = drafts[edge.id];
      const effectiveLabel = cleanPortalString(draft?.displayLabel) || edge.label;
      const effectiveNote = cleanPortalString(draft?.referenceNote) || edge.referenceNote || '';
      const effectiveProvenance = draft?.provenanceOverride ?? edge.provenance;
      const effectiveType = draft?.typeOverride ?? edge.type;
      const reviewStatus: RelationshipReviewRow['reviewStatus'] = draft?.reviewStatus ?? (edge.provenance === 'inferred' ? 'unreviewed' : 'approved');
      const searchText = [
        sourceNode.label,
        targetNode.label,
        effectiveLabel,
        effectiveNote,
        effectiveProvenance,
        relationshipProvenanceLabel(effectiveProvenance),
        effectiveType,
        relationshipTypeLabel(effectiveType),
        edge.source,
        relationshipSourceLabel(edge.source),
        sourceNode.kind,
        targetNode.kind,
        nodeKindLabel(sourceNode.kind),
        nodeKindLabel(targetNode.kind),
        reviewStatus,
      ].join(' ').toLowerCase();

      return {
        id: edge.id,
        edge,
        sourceNode,
        targetNode,
        draft,
        effectiveLabel,
        effectiveNote,
        effectiveProvenance,
        effectiveType,
        reviewStatus,
        searchText,
      };
    })
    .filter((row): row is RelationshipReviewRow => Boolean(row));
}

function buildRelationshipQueueOptions(rows: RelationshipReviewRow[]): Array<{ mode: RelationshipQueueMode; label: string; count: number }> {
  const count = (mode: RelationshipQueueMode) => rows.filter((row) => matchesRelationshipQueue(row, mode)).length;
  return [
    { mode: 'needs-review', label: 'Needs Review', count: count('needs-review') },
    { mode: 'inferred', label: 'Inferred', count: count('inferred') },
    { mode: 'curated', label: 'Curated', count: count('curated') },
    { mode: 'documented', label: 'Documented', count: count('documented') },
    { mode: 'people', label: 'Person Links', count: count('people') },
    { mode: 'entities', label: 'Entity Links', count: count('entities') },
    { mode: 'approved', label: 'Approved', count: count('approved') },
    { mode: 'hidden', label: 'Hidden', count: count('hidden') },
    { mode: 'all', label: 'All Links', count: rows.length },
  ];
}

function matchesRelationshipQueue(row: RelationshipReviewRow, queue: RelationshipQueueMode) {
  if (queue === 'all') return true;
  if (queue === 'needs-review') return row.reviewStatus === 'unreviewed' || row.reviewStatus === 'needs-research';
  if (queue === 'inferred') return row.effectiveProvenance === 'inferred';
  if (queue === 'curated') return row.effectiveProvenance === 'curated';
  if (queue === 'documented') return row.effectiveProvenance === 'documented';
  if (queue === 'people') return row.sourceNode.kind === 'person' && row.targetNode.kind === 'person';
  if (queue === 'entities') return row.targetNode.kind !== 'person';
  if (queue === 'approved') return row.reviewStatus === 'approved';
  if (queue === 'hidden') return row.reviewStatus === 'hidden';
  return true;
}

function relationshipPriorityRank(row: RelationshipReviewRow) {
  if (row.reviewStatus === 'hidden') return 8;
  if (row.reviewStatus === 'needs-research') return 0;
  if (row.reviewStatus === 'unreviewed' && row.effectiveProvenance === 'inferred') return 1;
  if (row.edge.source === 'relatedIds') return 2;
  if (row.effectiveProvenance === 'inferred') return 3;
  if (row.effectiveProvenance === 'documented') return 4;
  if (row.effectiveProvenance === 'curated') return 5;
  return 6;
}

function relationshipTypeLabel(type: RelationshipType) {
  const labels: Record<RelationshipType, string> = {
    inducted_by: 'Inducted by',
    same_class: 'Same class',
    shared_theme: 'Shared theme',
    shared_organization: 'Shared organization',
    shared_community: 'Shared community',
    civic_collaboration: 'Civic collaboration',
    mentor: 'Mentor',
    colleague: 'Colleague',
    family: 'Family',
    related_place: 'Related place',
    related_event: 'Related event',
  };
  return labels[type];
}

function relationshipProvenanceLabel(provenance: RelationshipProvenance) {
  const labels: Record<RelationshipProvenance, string> = {
    documented: 'Documented',
    curated: 'Curated',
    inferred: 'Inferred',
  };
  return labels[provenance];
}

function relationshipSourceLabel(source: ConnectionEdge['source']) {
  const labels: Record<ConnectionEdge['source'], string> = {
    relationship: 'Explicit relationship',
    metadata: 'Prepared metadata',
    relatedIds: 'Legacy suggestion',
  };
  return labels[source];
}

function nodeKindLabel(kind: ConnectionNode['kind']) {
  const labels: Record<ConnectionNode['kind'], string> = {
    person: 'Person',
    organization: 'Organization',
    place: 'Place',
    community: 'Community',
    event: 'Event',
    theme: 'Theme',
    media: 'Media',
  };
  return labels[kind];
}

function entityInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function relationshipStatusValue(value: string) {
  return relationshipReviewStatusValues.has(value as RelationshipReviewStatus) ? value as RelationshipReviewStatus : undefined;
}

function hasId(values: string[] | undefined, id: string) {
  return Boolean(values?.includes(id));
}

function formatNeeds(needs: string[]) {
  if (needs.length === 0) return 'No open review flags';
  return needs.slice(0, 3).join(' / ') + (needs.length > 3 ? ` / +${needs.length - 3}` : '');
}

function downloadReviewQueue(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, drafts: DraftMap, queue: string) {
  if (inductees.length === 0) {
    window.alert('There are no rows to export for this queue.');
    return;
  }
  const csv = buildReviewCsv(inductees, curation, media, manifest, drafts);
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cihof-${queue}-review-queue-${dateStamp()}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildReviewCsv(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, drafts: DraftMap) {
  const headers = [
    'id',
    'name',
    'display_name',
    'sort_name',
    'pronunciation',
    'class_year',
    'country_tags',
    'country_source',
    'country_note',
    'approved_country_tags',
    'country_tags_approved',
    'region',
    'profile_url',
    'approval_status',
    'review_priority',
    'approve_profile',
    'featured_candidate',
    'featured',
    'attract_priority',
    'current_summary',
    'approved_summary',
    'documented_context_line',
    'honored_for_summary',
    'life_work_summary',
    'summary_approved',
    'summary_source',
    'current_theme_tags',
    'approved_theme_tags',
    'theme_tags_approved',
    'theme_source',
    'current_community_tags',
    'approved_community_tags',
    'community_tags_approved',
    'primary_image_source_url',
    'image_source_url',
    'primary_image_file_path',
    'primary_image_runtime_path',
    'primary_image_checksum_sha256',
    'primary_image_width',
    'primary_image_height',
    'primary_image_local',
    'primary_image_alt_text',
    'image_rights_status',
    'image_rights_approved',
    'primary_image_kiosk_approved',
    'has_video',
    'video_count',
    'video_index',
    'video_source_url',
    'youtube_video_id',
    'video_source_urls',
    'youtube_video_ids',
    'video_file_path',
    'video_runtime_path',
    'video_poster_file_path',
    'video_poster_runtime_path',
    'caption_file_path',
    'caption_runtime_path',
    'transcript_file_path',
    'transcript_runtime_path',
    'duration_seconds',
    'codec',
    'video_rights_status',
    'video_rights_approved',
    'caption_status',
    'captions_approved',
    'transcript_status',
    'transcript_approved',
    'audio_description_status',
    'video_kiosk_approved',
    'accessibility_approved',
    'plain_language_review',
    'sensitive_content_review',
    'image_description_review',
    'curator_notes',
    'media_notes',
    'review_needs',
  ];
  const rows = inductees.map((inductee) => {
    const draft = drafts[inductee.id];
    const mediaRecord = manifest?.assets?.[inductee.id];
    const primaryImage = mediaRecord?.images?.primary;
    const videos = mediaRecord?.videos ?? [];
    const firstVideo = videos[0];
    const stagedVideoSourceUrls = draft?.videoSourceUrls ?? [];
    const stagedYoutubeVideoIds = draft?.youtubeVideoIds ?? [];
    const hasStagedVideoSource = stagedVideoSourceUrls.length > 0 || stagedYoutubeVideoIds.length > 0;

    return [
      inductee.id,
      inductee.name,
      draft?.displayName ?? inductee.name,
      draft?.sortName ?? inductee.sortName,
      draft?.pronunciation ?? inductee.pronunciation,
      inductee.classYear ?? '',
      inductee.countryTags.join('; '),
      inductee.countryTagsSource,
      draft?.countryNotes ?? inductee.countryTagsNote,
      (draft?.approvedCountryTags ?? []).join('; '),
      toDecisionFlag(draft?.countryTagsApproved),
      inductee.region,
      inductee.profileUrl,
      draft?.approvalStatus ?? '',
      draft?.reviewPriority ?? '',
      toDecisionFlag(draft?.approveProfile),
      toDecisionFlag(draft?.featuredCandidate),
      toDecisionFlag(draft?.featured),
      draft?.attractPriority ?? '',
      inductee.storySummary,
      draft?.approvedSummary ?? '',
      draft?.documentedContextLine ?? inductee.documentedContextLine,
      draft?.honoredForSummary ?? inductee.honoredForSummary,
      draft?.lifeWorkSummary ?? inductee.lifeWorkSummary,
      toDecisionFlag(draft?.summaryApproved),
      inductee.storySummarySource,
      inductee.themeTags.join('; '),
      (draft?.approvedThemeTags ?? []).join('; '),
      toDecisionFlag(draft?.themeTagsApproved),
      inductee.themeTagsSource,
      inductee.communityTags.join('; '),
      (draft?.approvedCommunityTags ?? []).join('; '),
      toDecisionFlag(draft?.communityTagsApproved),
      draft?.imageSourceUrl ?? primaryImage?.sourceUrl ?? '',
      draft?.imageSourceUrl ?? primaryImage?.sourceUrl ?? '',
      primaryImage?.filePath ?? '',
      primaryImage?.runtimePath ?? '',
      primaryImage?.checksumSha256 ?? '',
      primaryImage?.width ?? '',
      primaryImage?.height ?? '',
      primaryImage?.runtimePath?.startsWith('/media/') ? 'yes' : inductee.primaryImageUrl.startsWith('/media/') ? 'yes' : 'no',
      draft?.primaryImageAltText ?? primaryImage?.altText ?? inductee.imageAltText,
      draft?.imageRightsStatus ?? primaryImage?.rightsStatus ?? '',
      toDecisionFlag(draft?.imageRightsApproved),
      primaryImage?.approvedForKiosk ? 'yes' : 'no',
      inductee.hasVideo || hasStagedVideoSource ? 'yes' : 'no',
      videos.length,
      videos.length === 1 ? '1' : '',
      videos.length === 1 ? firstVideo?.sourceUrl ?? '' : stagedVideoSourceUrls.length === 1 ? stagedVideoSourceUrls[0] : '',
      videos.length === 1 ? firstVideo?.youtubeVideoId ?? '' : stagedYoutubeVideoIds.length === 1 ? stagedYoutubeVideoIds[0] : '',
      stagedVideoSourceUrls.join('; '),
      stagedYoutubeVideoIds.join('; '),
      videos.length === 1 ? firstVideo?.filePath ?? '' : '',
      videos.length === 1 ? firstVideo?.runtimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.posterFilePath ?? '' : '',
      videos.length === 1 ? firstVideo?.posterRuntimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.captionFilePath ?? '' : '',
      videos.length === 1 ? firstVideo?.captionRuntimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.transcriptFilePath ?? '' : '',
      videos.length === 1 ? firstVideo?.transcriptRuntimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.durationSeconds ?? '' : '',
      videos.length === 1 ? firstVideo?.codec ?? '' : '',
      draft?.videoRightsStatus ?? firstVideo?.rightsStatus ?? inductee.videoRightsStatus,
      toDecisionFlag(draft?.videoRightsApproved),
      draft?.captionStatus ?? firstVideo?.captionStatus ?? '',
      toDecisionFlag(draft?.captionsApproved),
      draft?.transcriptStatus ?? firstVideo?.transcriptStatus ?? '',
      toDecisionFlag(draft?.transcriptApproved),
      firstVideo?.audioDescriptionStatus ?? '',
      videos.length > 0 && videos.every((video) => video.approvedForKiosk) ? 'yes' : videos.length > 0 ? 'no' : '',
      toDecisionFlag(draft?.accessibilityApproved),
      draft?.plainLanguageReview ?? '',
      draft?.sensitiveContentReview ?? '',
      draft?.imageDescriptionReview ?? '',
      (draft?.curatorNotes ?? []).join('; '),
      (draft?.mediaNotes ?? mediaRecord?.notes ?? []).join('; '),
      getReviewNeeds(inductee, curation, media, draft).join('; '),
    ];
  });
  return [headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n');
}

function loadStoredDrafts(): DraftMap {
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return {};
    return normalizeDraftPayload(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persistDrafts(drafts: DraftMap) {
  const count = Object.keys(drafts).length;

  try {
    if (count === 0) {
      window.localStorage.removeItem(draftStorageKey);
      return { ok: true, message: 'No local drafts' };
    }

    window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
    const savedAt = new Date().toISOString();
    return { ok: true, message: `Saved ${count} local draft${count === 1 ? '' : 's'} at ${formatClock(savedAt)}`, savedAt };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not save local portal drafts.',
    };
  }
}

function loadStoredRelationshipDrafts(): RelationshipDraftMap {
  try {
    const raw = window.localStorage.getItem(relationshipDraftStorageKey);
    if (!raw) return {};
    return normalizeRelationshipDraftPayload(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persistRelationshipDrafts(drafts: RelationshipDraftMap) {
  const count = Object.keys(drafts).length;

  try {
    if (count === 0) {
      window.localStorage.removeItem(relationshipDraftStorageKey);
      return { ok: true, message: 'No relationship drafts' };
    }

    window.localStorage.setItem(relationshipDraftStorageKey, JSON.stringify(drafts));
    const savedAt = new Date().toISOString();
    return { ok: true, message: `Saved ${count} relationship draft${count === 1 ? '' : 's'} at ${formatClock(savedAt)}`, savedAt };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not save relationship review drafts.',
    };
  }
}

function normalizeRelationshipDraftPayload(payload: unknown): RelationshipDraftMap {
  const source = getDraftRecordSource(payload);
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

function normalizeDraftPayload(payload: unknown, inductees: Inductee[] = []): DraftMap {
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

function getDraftRecordSource(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const objectPayload = payload as { drafts?: unknown; records?: unknown };
  const source = objectPayload.drafts ?? objectPayload.records ?? payload;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  return source as Record<string, unknown>;
}

function isMeaningfulDraft(draft: ReviewDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (key === 'id' || key === 'updatedAt' || value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

function isMeaningfulRelationshipDraft(draft: RelationshipDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (key === 'id' || key === 'updatedAt' || value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
  });
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value: CsvValue) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toDecisionFlag(value?: boolean) {
  if (value === undefined) return '';
  return value ? 'yes' : 'no';
}

function parseListInput(value: string) {
  return Array.from(new Set(value.split(/[|;\n]/).map((item) => item.trim()).filter(Boolean)));
}

function joinList(values: string[]) {
  return values.join('\n');
}

function addListValue(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function removeListValue(values: string[], value: string) {
  return values.filter((item) => item !== value);
}

function cleanPortalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPortalList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanPortalString(item)).filter(Boolean)));
}

function slugifyLensId(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueLensId(lenses: StoryLensConfig[], baseId: string) {
  const normalizedBase = slugifyLensId(baseId) || 'story-lens';
  const ids = new Set(lenses.map((lens) => lens.id));
  if (!ids.has(normalizedBase)) return normalizedBase;
  let index = 2;
  while (ids.has(`${normalizedBase}-${index}`)) index += 1;
  return `${normalizedBase}-${index}`;
}

function priorityRank(priority: string) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function ReadinessCard({ title, ready, total, action, ids, onClick }: { title: string; ready: number; total: number; action: string; ids?: string[]; onClick: () => void }) {
  const clampedTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((ready / clampedTotal) * 100));
  return (
    <div className="portal-readiness-card">
      <span>{title}</span>
      <strong>{ready}/{total}</strong>
      <div className="portal-progress" aria-label={`${title} ${percent}% ready`}>
        <i style={{ width: `${percent}%` }} />
      </div>
      {ids && ids.length > 0 && <small>{ids.slice(0, 4).join(', ')}{ids.length > 4 ? `, +${ids.length - 4}` : ''}</small>}
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="review-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'accent' }) {
  return <span className={`review-chip review-chip--${tone}`}>{label}</span>;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <span className={`review-status review-status--${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function statusLabel(errors: number, warnings: number) {
  if (errors > 0) return `${errors} errors`;
  if (warnings > 0) return `${warnings} warnings`;
  return 'Clean';
}

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatRepoPath(value?: string) {
  if (!value) return 'Unavailable';
  const parts = value.split('/').filter(Boolean);
  if (parts.length <= 3) return value;
  return `.../${parts.slice(-3).join('/')}`;
}

function formatGitCommit(git?: RunnerGitStatus) {
  if (!git?.available) return git?.error || 'Unavailable';
  if (!git.commit) return 'No commit';
  return git.commitSubject ? `${git.commit} ${git.commitSubject}` : git.commit;
}

function formatAheadBehind(git?: RunnerGitStatus) {
  if (!git?.available) return 'Unavailable';
  if (!git.upstream) return 'No upstream';
  const ahead = typeof git.ahead === 'number' ? git.ahead : 0;
  const behind = typeof git.behind === 'number' ? git.behind : 0;
  if (ahead === 0 && behind === 0) return `Synced with ${git.upstream}`;
  return `${ahead} ahead, ${behind} behind ${git.upstream}`;
}

function formatRunnerJobSummary(job?: RunnerJobSummary | null) {
  if (!job) return 'No success yet';
  const date = formatDate(job.finishedAt || job.startedAt);
  return `${job.label} - ${date}`;
}

function formatClock(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
