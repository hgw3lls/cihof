import type { Inductee } from '../../../data/types';
import {
  draftStorageKey,
  relationshipDraftStorageKey,
} from '../services/portalDrafts';
import type {
  DraftMap,
  RelationshipDraftMap,
  ReviewDraft,
} from '../services/portalDrafts';
import type {
  CurationReport,
  MediaManifest,
  MediaManifestRecord,
  MediaReport,
} from '../services/portalReports';

export type QueueMode =
  | 'all'
  | 'edited'
  | 'high'
  | 'focused-copy'
  | 'country'
  | 'summary'
  | 'themes'
  | 'image-rights'
  | 'video-captions'
  | 'accessibility'
  | 'featured';

type CsvValue = string | number | boolean | null | undefined;

export type DraftIssue = {
  id: string;
  name: string;
  message: string;
  severity: 'warning' | 'error';
};

export type ProfileReadinessStatus = 'ready' | 'drafted' | 'needed' | 'blocked' | 'optional';

export type ProfileReadinessItem = {
  id: string;
  label: string;
  status: ProfileReadinessStatus;
  detail: string;
};

export type DashboardSummary = ReturnType<typeof buildDashboardSummary>;

export type PortalCurationPackage = {
  schemaVersion: 1;
  packageKind: 'cihof-portal-curation-package';
  exportedAt: string;
  source: string;
  profileDrafts: DraftMap;
  relationshipDrafts: RelationshipDraftMap;
  decisionCsv: string;
  summary: {
    totalProfiles: number;
    profileDraftCount: number;
    relationshipDraftCount: number;
    draftIssueCount: number;
    blockingDraftIssueCount: number;
    sourceLeadCount: number;
    curationErrors: number;
    curationWarnings: number;
    mediaErrors: number;
    mediaWarnings: number;
    runnerConnected: boolean;
    runnerGitBranch?: string;
    runnerGitCommit?: string;
  };
  provenance: {
    app: string;
    profileDraftStorageKey: string;
    relationshipDraftStorageKey: string;
  };
};

type PortalCurationPackageInput = {
  inductees: Inductee[];
  drafts: DraftMap;
  relationshipDrafts: RelationshipDraftMap;
  decisionCsv: string;
  draftIssues: DraftIssue[];
  sourceLeadCount: number;
  curation: CurationReport | null;
  media: MediaReport | null;
  runnerConnected: boolean;
  runnerGitBranch?: string;
  runnerGitCommit?: string;
};

export function buildDashboardSummary(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
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
  const focusedCopyReady = inductees.filter(hasFocusedHallCopy).length;
  const draftFocusedCopy = draftValues.filter(hasFocusedHallCopyDraft).length;

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
    focusedCopyReady,
    focusedCopyNeeded: Math.max(0, totalProfiles - focusedCopyReady),
    countryNeedsReview: inductees.filter((item) => item.countryTagsSource !== 'curated').length,
    localPrimaryImages,
    primaryImagesWallReady,
    primaryImagesReady,
    videosReady,
    videoItems,
    missingCaptions,
    draftApprovedProfiles: draftValues.filter((draft) => draft.approveProfile || draft.approvalStatus === 'approved').length,
    draftApprovedSummaries: draftValues.filter((draft) => draft.summaryApproved || Boolean(draft.approvedSummary)).length,
    draftFocusedCopy,
    draftApprovedCountries: draftValues.filter((draft) => draft.countryTagsApproved || (draft.approvedCountryTags?.length ?? 0) > 0).length,
    draftApprovedImages: draftValues.filter((draft) => draft.imageRightsApproved || draft.imageRightsStatus === 'approved').length,
    draftApprovedVideos: draftValues.filter((draft) => draft.videoRightsApproved || draft.captionsApproved || draft.transcriptApproved).length,
    draftApprovedAccessibility: draftValues.filter((draft) => draft.accessibilityApproved).length,
    wallReady: primaryImagesWallReady === totalProfiles && (media?.validation?.errors?.length ?? 0) === 0,
    kioskReady: primaryImagesReady === totalProfiles && videoItems === videosReady && (media?.validation?.errors?.length ?? 0) === 0,
  };
}

export function buildQueueOptions(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  const options: Array<{ mode: QueueMode; label: string }> = [
    { mode: 'high', label: 'High priority' },
    { mode: 'edited', label: 'Local draft edits' },
    { mode: 'focused-copy', label: 'Focused Hall copy' },
    { mode: 'country', label: 'Nationality review' },
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

export function buildActionItems(summary: DashboardSummary, draftCount: number) {
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
      label: 'Approve Nationality',
      detail: `${summary.countryNeedsReview - summary.draftApprovedCountries} nationality labels still need review`,
      queue: 'country',
      priority: 1,
    });
  }
  if (summary.focusedCopyNeeded > summary.draftFocusedCopy) {
    items.push({
      label: 'Write Hall Copy',
      detail: `${summary.focusedCopyNeeded - summary.draftFocusedCopy} focused portrait panels need concise copy`,
      queue: 'focused-copy',
      priority: 1.5,
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

export function matchesQueue(inductee: Inductee, queue: QueueMode, curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  if (queue === 'all') return true;
  if (queue === 'edited') return Boolean(drafts[inductee.id]);
  if (queue === 'high') return inductee.reviewPriority === 'high';
  if (queue === 'focused-copy') return !hasFocusedHallCopy(inductee) || hasFocusedHallCopyDraft(drafts[inductee.id]);
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

export function hasFocusedHallCopy(inductee: Inductee) {
  return Boolean(inductee.documentedContextLine.trim() && inductee.honoredForSummary.trim());
}

export function hasFocusedHallCopyDraft(draft: ReviewDraft | undefined) {
  return Boolean(draft?.documentedContextLine?.trim() || draft?.honoredForSummary?.trim() || draft?.lifeWorkSummary?.trim());
}

export function getDraftIssues(inductee: Inductee, draft: ReviewDraft | undefined, mediaRecord?: MediaManifestRecord): DraftIssue[] {
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
  if (draft.countryTagsApproved && (draft.approvedCountryTags?.length ?? 0) === 0) add('Nationality approval is checked but no approved nationality or heritage labels are staged.', 'error');
  if (draft.communityTagsApproved && (draft.approvedCommunityTags?.length ?? 0) === 0) add('Community approval is checked but no approved communities are staged.');
  if (draft.approveProfile && !draft.summaryApproved && !draft.approvedSummary) add('Profile approval is staged before summary approval.');
  if (draft.approveProfile && !draft.countryTagsApproved && (draft.approvedCountryTags?.length ?? 0) === 0 && inductee.countryTagsSource !== 'curated') {
    add('Profile approval is staged before nationality or heritage metadata is curator-approved.');
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

export function buildProfileReadinessChecklist(
  inductee: Inductee,
  draft: ReviewDraft | undefined,
  curation: CurationReport | null,
  media: MediaReport | null,
  mediaRecord: MediaManifestRecord | undefined,
  draftIssues: DraftIssue[],
): ProfileReadinessItem[] {
  const blockingIssues = draftIssues.filter((issue) => issue.severity === 'error');
  const hasVideo = inductee.hasVideo || Boolean(mediaRecord?.videos?.length) || (draft?.videoSourceUrls?.length ?? 0) > 0 || (draft?.youtubeVideoIds?.length ?? 0) > 0;
  const localPrimaryReady = !hasId(media?.summary?.missingPrimaryLocalFiles, inductee.id) && Boolean(inductee.primaryImageUrl || mediaRecord?.images?.primary?.runtimePath);
  const imageRightsReady = draft?.imageRightsApproved || draft?.imageRightsStatus === 'approved' || inductee.imageRightsStatus === 'approved';
  const imageDrafted = draft?.imageRightsStatus !== undefined || draft?.primaryImageAltText !== undefined || draft?.imageSourceUrl !== undefined;
  const videoRightsReady = !hasVideo || draft?.videoRightsApproved || draft?.videoRightsStatus === 'approved' || inductee.videoRightsStatus === 'approved';
  const captionsReady = !hasVideo || draft?.captionsApproved || draft?.captionStatus === 'approved' || !hasId(media?.summary?.missingCaptions, inductee.id);
  const transcriptReady = !hasVideo || draft?.transcriptApproved || draft?.transcriptStatus === 'approved' || !hasId(media?.summary?.missingTranscripts, inductee.id);
  const videoDrafted = Boolean(draft?.videoRightsStatus || draft?.videoRightsApproved || draft?.captionStatus || draft?.captionsApproved || draft?.transcriptStatus || draft?.transcriptApproved);
  const accessibilityOpen = Boolean(
    curation?.accessibility?.plainLanguageReviewNeeded?.includes(inductee.id) ||
    curation?.accessibility?.sensitiveContentReviewNeeded?.includes(inductee.id) ||
    curation?.accessibility?.imageDescriptionReviewNeeded?.includes(inductee.id),
  );
  const accessibilityReady = Boolean(draft?.accessibilityApproved) || !accessibilityOpen;
  const accessibilityDrafted = Boolean(draft?.plainLanguageReview || draft?.sensitiveContentReview || draft?.imageDescriptionReview);
  const contextReady = hasFocusedHallCopy(inductee);
  const contextDrafted = hasFocusedHallCopyDraft(draft);
  const summaryReady = inductee.storySummarySource === 'curated' || Boolean(draft?.summaryApproved || draft?.approvedSummary?.trim());
  const metadataReady = (inductee.themeTagsSource === 'curated' || Boolean(draft?.themeTagsApproved || (draft?.approvedThemeTags?.length ?? 0) > 0))
    && (inductee.countryTagsSource === 'curated' || Boolean(draft?.countryTagsApproved || (draft?.approvedCountryTags?.length ?? 0) > 0));
  const metadataDrafted = Boolean(
    draft?.themeTagsApproved ||
    draft?.countryTagsApproved ||
    draft?.communityTagsApproved ||
    (draft?.approvedThemeTags?.length ?? 0) > 0 ||
    (draft?.approvedCountryTags?.length ?? 0) > 0 ||
    (draft?.approvedCommunityTags?.length ?? 0) > 0,
  );
  const profileReady = inductee.approvalStatus === 'approved';
  const profileDrafted = Boolean(draft?.approveProfile || draft?.approvalStatus === 'approved');

  return [
    {
      id: 'draft-validity',
      label: 'Draft validity',
      status: blockingIssues.length > 0 ? 'blocked' : draftIssues.length > 0 ? 'drafted' : 'ready',
      detail: blockingIssues.length > 0
        ? `${blockingIssues.length} blocking issue${blockingIssues.length === 1 ? '' : 's'}`
        : draftIssues.length > 0
          ? `${draftIssues.length} warning${draftIssues.length === 1 ? '' : 's'} before export`
          : 'No draft validation issues',
    },
    {
      id: 'profile-approval',
      label: 'Profile approval',
      status: profileReady ? 'ready' : profileDrafted ? 'drafted' : 'needed',
      detail: profileReady ? 'Approved in runtime data' : profileDrafted ? 'Approval staged in local draft' : 'Profile still needs approval decision',
    },
    {
      id: 'focused-hall-copy',
      label: 'Focused Hall copy',
      status: contextReady ? 'ready' : contextDrafted ? 'drafted' : 'needed',
      detail: contextReady
        ? 'Context and HONORED FOR text are curated'
        : contextDrafted
          ? 'Focused-Hall text is staged locally'
          : 'Uses generated/fallback text until curated',
    },
    {
      id: 'summary',
      label: 'Story summary',
      status: summaryReady ? 'ready' : draft?.approvedSummary ? 'drafted' : 'needed',
      detail: summaryReady ? 'Curated or staged summary is available' : 'Generated summary still needs review',
    },
    {
      id: 'metadata',
      label: 'Story metadata',
      status: metadataReady ? 'ready' : metadataDrafted ? 'drafted' : 'needed',
      detail: metadataReady ? 'Theme and nationality metadata are curated or staged' : 'Theme/nationality metadata still needs review',
    },
    {
      id: 'portrait-media',
      label: 'Portrait media',
      status: localPrimaryReady && imageRightsReady ? 'ready' : imageDrafted ? 'drafted' : 'needed',
      detail: localPrimaryReady && imageRightsReady
        ? 'Primary image is local/available and rights-approved'
        : imageDrafted
          ? 'Primary image decision is staged locally'
          : 'Primary image localization or rights review is still open',
    },
    {
      id: 'watch-media',
      label: 'Watch media',
      status: !hasVideo ? 'optional' : videoRightsReady && captionsReady && transcriptReady ? 'ready' : videoDrafted ? 'drafted' : 'needed',
      detail: !hasVideo
        ? 'No approved video is linked for this profile'
        : videoRightsReady && captionsReady && transcriptReady
          ? 'Video rights, captions, and transcript are clear or staged'
          : 'Video rights, captions, or transcript still need review',
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      status: accessibilityReady ? 'ready' : accessibilityDrafted ? 'drafted' : 'needed',
      detail: accessibilityReady ? 'Accessibility review is staged' : accessibilityDrafted ? 'Partial accessibility notes are staged' : 'Plain-language, sensitive-content, and image-description review remain open',
    },
  ];
}

export function matchesSearch(inductee: Inductee, draft: ReviewDraft | undefined, search: string) {
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

export function getReviewNeeds(inductee: Inductee, curation: CurationReport | null, media: MediaReport | null, draft?: ReviewDraft) {
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
  const focusedCopyReady = hasFocusedHallCopy(inductee);
  const focusedCopyDrafted = hasFocusedHallCopyDraft(draft);

  if (!profileApproved) needs.push('Approve profile metadata');
  if (!focusedCopyReady && !focusedCopyDrafted) needs.push('Stage focused Hall copy');
  if (!summaryApproved) needs.push('Approve or rewrite story summary');
  if (!themesApproved) needs.push('Approve theme tags');
  if (!countriesApproved) needs.push('Approve nationality tags');
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

export function formatNeeds(needs: string[]) {
  if (needs.length === 0) return 'No open review flags';
  return needs.slice(0, 3).join(' / ') + (needs.length > 3 ? ` / +${needs.length - 3}` : '');
}

export function readinessStatusLabel(status: ProfileReadinessStatus) {
  if (status === 'ready') return 'Ready';
  if (status === 'drafted') return 'Staged';
  if (status === 'blocked') return 'Blocked';
  if (status === 'optional') return 'Optional';
  return 'Needed';
}

export function buildReviewCsv(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, drafts: DraftMap) {
  const headers = [
    'id',
    'name',
    'display_name',
    'sort_name',
    'pronunciation',
    'class_year',
    'nationality_heritage_tags',
    'nationality_heritage_source',
    'nationality_heritage_note',
    'approved_nationality_heritage_tags',
    'nationality_heritage_tags_approved',
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

export function buildPortalCurationPackage({
  inductees,
  drafts,
  relationshipDrafts,
  decisionCsv,
  draftIssues,
  sourceLeadCount,
  curation,
  media,
  runnerConnected,
  runnerGitBranch,
  runnerGitCommit,
}: PortalCurationPackageInput): PortalCurationPackage {
  return {
    schemaVersion: 1,
    packageKind: 'cihof-portal-curation-package',
    exportedAt: new Date().toISOString(),
    source: 'CIHOF staff portal curation package',
    profileDrafts: drafts,
    relationshipDrafts,
    decisionCsv,
    summary: {
      totalProfiles: inductees.length,
      profileDraftCount: Object.keys(drafts).length,
      relationshipDraftCount: Object.keys(relationshipDrafts).length,
      draftIssueCount: draftIssues.length,
      blockingDraftIssueCount: draftIssues.filter((issue) => issue.severity === 'error').length,
      sourceLeadCount,
      curationErrors: curation?.validation?.errors?.length ?? 0,
      curationWarnings: curation?.validation?.warnings?.length ?? 0,
      mediaErrors: media?.validation?.errors?.length ?? 0,
      mediaWarnings: media?.validation?.warnings?.length ?? 0,
      runnerConnected,
      runnerGitBranch,
      runnerGitCommit,
    },
    provenance: {
      app: 'CIHOF staff portal',
      profileDraftStorageKey: draftStorageKey,
      relationshipDraftStorageKey,
    },
  };
}

export function priorityRank(priority: string) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

export function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function hasId(values: string[] | undefined, id: string) {
  return Boolean(values?.includes(id));
}

function toCsvCell(value: CsvValue) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toDecisionFlag(value?: boolean) {
  if (value === undefined) return '';
  return value ? 'yes' : 'no';
}
