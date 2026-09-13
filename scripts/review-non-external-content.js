import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  loadCuratedMetadata,
  loadInductees,
  loadMediaManifest,
  loadPhysicalWallMetadata,
  validateCuratedMetadata,
  validatePhysicalWallMetadata,
} from './data-utils.js';

const markdownOutputPath = resolve('docs/non-external-content-review-report.md');
const jsonOutputPath = resolve('artifacts/non-external-content-review.json');

const reviewedSources = [
  'data/cihof_kiosk_manifest.csv',
  'data/cihof_inductees.json',
  'data/cihof_curated_metadata.json',
  'data/cihof_country_inferences.json',
  'data/media_manifest.json',
  'data/physical_wall_positions.json',
  'data/cihof_story_sections.json',
  'data/cihof_story_lenses.json',
  'data/cihof_archive_items.json',
  'data/original-site-harvest/cihof-source-candidates.json',
  'public/data/source-curation-packet.json',
  'public/data/inductees.json',
  'public/data/media-manifest.json',
  'public/data/media-report.json',
  'public/data/curation-report.json',
  'public/data/entity-model-report.json',
  'public/data/entity-relationships.json',
  'public/data/story-sections.json',
  'public/data/story-lenses.json',
  'public/data/archive-leads.json',
];

const explicitlyExcludedSources = ['data/external-research/*'];

const inductees = loadInductees();
const baseInductees = loadInductees({ includeCurated: false, includeMedia: false, includePhysicalWall: false });
const curatedMetadata = loadCuratedMetadata();
const mediaManifest = loadMediaManifest();
const physicalWallMetadata = loadPhysicalWallMetadata();
const sourcePacket = readJson('public/data/source-curation-packet.json', {});
const originalSourceCandidates = readJson('data/original-site-harvest/cihof-source-candidates.json', {});
const mediaReport = readJson('public/data/media-report.json', {});
const curationReport = readJson('public/data/curation-report.json', {});
const entityReport = readJson('public/data/entity-model-report.json', {});
const entityRelationships = readJson('public/data/entity-relationships.json', {});
const explicitRelationships = readJson('data/cihof_relationships.json', []);
const storySections = readJson('data/cihof_story_sections.json', {});
const storyLenses = readJson('data/cihof_story_lenses.json', {});
const archiveItems = readJson('data/cihof_archive_items.json', {});
const wrhsAddendum = readJson('data/wrhs_exhibition_research_addendum.json', {});

const expectedIds = baseInductees.map((item) => item.id);
const sourceIndex = new Map((sourcePacket.curationIndex ?? []).map((item) => [item.inducteeId, item]));
const mediaRecords = mediaManifest.assets ?? {};
const curatedRecords = curatedMetadata.inductees ?? {};
const physicalWallValidation = validatePhysicalWallMetadata(physicalWallMetadata, expectedIds);
const explicitRelationshipList = Array.isArray(explicitRelationships)
  ? explicitRelationships
  : Object.values(explicitRelationships.relationships ?? explicitRelationships.records ?? {});
const entityRelationshipList = Array.isArray(entityRelationships)
  ? entityRelationships
  : entityRelationships.relationships ?? Object.values(entityRelationships.records ?? {});

const personReviews = inductees.map((person) => reviewPerson(person));
const summary = buildSummary(personReviews);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  title: 'CIHOF Non-External Content Review',
  scope: {
    included: reviewedSources,
    excluded: explicitlyExcludedSources,
    note: 'This review uses only current repository content and generated reports. It does not use data/external-research.',
  },
  summary,
  sourceInventory: buildSourceInventory(),
  findings: buildFindings(summary),
  recommendedPlan: buildRecommendedPlan(summary),
  personReviews,
};

mkdirSync(dirname(jsonOutputPath), { recursive: true });
mkdirSync(dirname(markdownOutputPath), { recursive: true });
writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(markdownOutputPath, `${buildMarkdown(report)}\n`);

console.log('Non-external content review complete.');
console.log(`${summary.coverage.totalInductees} inductees reviewed.`);
console.log(`${summary.readiness.recordsWithoutEditorialCleanupFlags} records without targeted editorial cleanup flags.`);
console.log(`${summary.readiness.highestPriorityCleanup.length} highest-priority cleanup records listed.`);
console.log(`Wrote ${markdownOutputPath}`);
console.log(`Wrote ${jsonOutputPath}`);

function readJson(path, fallback) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return fallback;
  return JSON.parse(readFileSync(absolute, 'utf8'));
}

function reviewPerson(person) {
  const curated = curatedRecords[person.id] ?? {};
  const media = mediaRecords[person.id] ?? {};
  const source = sourceIndex.get(person.id) ?? {};
  const issues = [];
  const positives = [];

  const bioWords = wordCount(person.bioText);
  const summaryWords = wordCount(person.storySummary);
  const mediaShape = summarizeMedia(media, person);

  if (person.bioText) positives.push('bio-present');
  if (person.storySummary) positives.push('summary-present');
  if (person.documentedContextLine) positives.push('context-line-present');
  if (person.honoredForSummary) positives.push('honored-for-summary-present');
  if (person.lifeWorkSummary) positives.push('life-work-summary-present');
  if (person.primaryImageUrl) positives.push('primary-image-present');
  if (person.countryTags.length > 0) positives.push('country-tags-present');
  if (source.primaryStoryLeadCount > 0) positives.push('source-story-leads-available');

  if (person.approvalStatus !== 'approved') {
    addIssue(issues, 'PROFILE_APPROVAL_DRAFT', 'blocker', 'Profile record is still in draft approval status.', 18);
  }
  if (curated.accessibility?.plainLanguageReview !== 'approved' || curated.accessibility?.sensitiveContentReview !== 'approved') {
    addIssue(issues, 'ACCESSIBILITY_REVIEW_NEEDED', 'blocker', 'Plain-language and sensitive-content reviews are not approved.', 12);
  }
  if (person.imageRightsStatus !== 'approved') {
    addIssue(issues, 'IMAGE_RIGHTS_REVIEW_NEEDED', 'blocker', 'Primary/gallery image rights are not approved for final use.', 12);
  }
  if (person.hasVideo && person.videoRightsStatus !== 'approved') {
    addIssue(issues, 'VIDEO_RIGHTS_REVIEW_NEEDED', 'high', 'Linked video rights are not approved.', 10);
  }
  if (person.hasVideo && mediaShape.missingCaptionOrTranscript) {
    addIssue(issues, 'VIDEO_CAPTIONS_TRANSCRIPTS_NEEDED', 'high', 'Linked video needs captions and transcripts before final kiosk approval.', 9);
  }
  if (person.hasVideo && mediaShape.missingLocalVideoFile) {
    addIssue(issues, 'VIDEO_LOCAL_FILE_MISSING', 'high', 'At least one linked video is missing a local file path.', 8);
  }
  if (!person.hasVideo) {
    addIssue(issues, 'NO_VIDEO_LINKED', 'low', 'No video is currently linked for this profile.', 2);
  }
  if (person.themeTagsSource !== 'curated') {
    addIssue(issues, 'THEME_TAGS_GENERATED_ONLY', 'medium', 'Theme tags are generated, not curator-approved.', 6);
  }
  if (person.countryTags.length === 0) {
    addIssue(issues, 'COUNTRY_TAGS_MISSING', 'high', 'Nationality/heritage tags are missing.', 8);
  }
  if (person.communityTags.length === 0) {
    addIssue(issues, 'COMMUNITY_TAGS_MISSING', 'low', 'Community tags are not approved or normalized yet.', 2);
  }
  if (!person.pronunciation) {
    addIssue(issues, 'PRONUNCIATION_MISSING', 'low', 'Pronunciation guidance is missing.', 1);
  }
  if (curated.summaryDraft?.endsWith('...') || curated.approvedSummary?.endsWith('...') || person.storySummary.endsWith('...')) {
    addIssue(issues, 'SUMMARY_TRUNCATED', 'medium', 'Summary text appears truncated with an ellipsis.', 5);
  }
  if (bioWords < 150) {
    addIssue(issues, 'BIO_TOO_SHORT', 'medium', `Biography is short for exhibit storytelling (${bioWords} words).`, 5);
  }
  if (bioWords > 900) {
    addIssue(issues, 'BIO_TOO_LONG', 'medium', `Biography is long for exhibit reading flow (${bioWords} words).`, 5);
  }
  if (hasLeadingDuplicateName(person)) {
    addIssue(issues, 'LEADING_NAME_DUPLICATION', 'medium', 'Biography appears to begin with a repeated scraped heading/name.', 4);
  }
  if (hasClassYearInDisplayName(person)) {
    addIssue(issues, 'CLASS_YEAR_IN_DISPLAY_NAME', 'high', 'Display name appears to include the induction year as scrape residue.', 9);
  }
  if (hasLifeDatesInDisplayName(person)) {
    addIssue(issues, 'LIFE_DATES_IN_DISPLAY_NAME', 'low', 'Display name includes life dates; confirm this is intentional for the wall and kiosk.', 2);
  }
  if (hasTemporalWording(person.bioText)) {
    addIssue(issues, 'TEMPORAL_WORDING_REVIEW', 'medium', 'Biography uses time-sensitive language such as currently, today, or now.', 3);
  }
  if (hasContactLikeText(person.bioText)) {
    addIssue(issues, 'CONTACT_OR_ADDRESS_TEXT', 'high', 'Biography appears to include current contact/address/phone-like text.', 9);
  }
  if (isDefaultAltText(person.imageAltText)) {
    addIssue(issues, 'GENERIC_IMAGE_ALT_TEXT', 'low', 'Primary image alt text is generic and should be made person-specific.', 2);
  }
  if (!hasPhysicalWallMapping(person)) {
    addIssue(issues, 'PHYSICAL_WALL_POSITION_MISSING', 'high', 'Physical portrait wall mapping is not set.', 8);
  }
  if ((source.sourceProfileCount ?? 0) > 1 || (source.profileAliasCount ?? 0) > 0) {
    addIssue(issues, 'PROFILE_ALIAS_OR_DUPLICATE_REVIEW', 'medium', 'Original-site profile alias or duplicate source page needs review.', 5);
  }
  if ((source.relationshipReviewCount ?? 0) > 0) {
    addIssue(issues, 'RELATIONSHIP_REVIEW_QUEUE', 'medium', 'Original-source relationship leads exist but remain candidate-only.', 4);
  }
  if ((source.placeReviewCount ?? 0) > 0) {
    addIssue(issues, 'PLACE_REVIEW_QUEUE', 'medium', 'Place/geography leads require review before public use.', 4);
  }
  if ((source.organizationReviewCount ?? 0) > 0) {
    addIssue(issues, 'ORGANIZATION_REVIEW_QUEUE', 'low', 'Organization/entity leads require cleanup before public use.', 2);
  }

  const weightedIssueScore = issues.reduce((total, issue) => total + issue.weight, 0);
  const tier = readinessTier(issues);

  return {
    id: person.id,
    name: person.name,
    classYear: person.classYear,
    region: person.region,
    approvalStatus: person.approvalStatus,
    reviewPriority: person.reviewPriority,
    readinessTier: tier,
    weightedIssueScore,
    positives,
    text: {
      bioWords,
      summaryWords,
      storySummarySource: person.storySummarySource,
      summaryPreview: person.storySummary,
      documentedContextLine: person.documentedContextLine,
      honoredForSummary: person.honoredForSummary,
      lifeWorkWordCount: wordCount(person.lifeWorkSummary),
    },
    taxonomy: {
      themeTags: person.themeTags,
      themeTagsSource: person.themeTagsSource,
      countryTags: person.countryTags,
      countryTagsSource: person.countryTagsSource,
      communityTags: person.communityTags,
    },
    media: mediaShape,
    sourceReview: {
      sourceProfileCount: source.sourceProfileCount ?? 0,
      profileAliasCount: source.profileAliasCount ?? 0,
      newImageReviewCount: source.newImageReviewCount ?? 0,
      existingImageSourceCount: source.existingImageSourceCount ?? 0,
      newContextVideoReviewCount: source.newContextVideoReviewCount ?? 0,
      existingVideoSourceCount: source.existingVideoSourceCount ?? 0,
      relationshipReviewCount: source.relationshipReviewCount ?? 0,
      placeReviewCount: source.placeReviewCount ?? 0,
      organizationReviewCount: source.organizationReviewCount ?? 0,
      primaryStoryLeadCount: source.primaryStoryLeadCount ?? 0,
      manualFlags: source.manualFlags ?? [],
      nextBestAction: source.nextBestAction || nextBestAction(issues, source, person),
    },
    issues: issues
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.weight - a.weight || a.code.localeCompare(b.code))
      .map(({ weight, ...issue }) => issue),
  };
}

function summarizeMedia(media, person) {
  const primary = media.images?.primary ?? null;
  const gallery = Array.isArray(media.images?.gallery) ? media.images.gallery : [];
  const videos = Array.isArray(media.videos) ? media.videos : [];
  const imageItems = [primary, ...gallery].filter(Boolean);
  return {
    primaryImagePresent: Boolean(primary || person.primaryImageUrl),
    primaryImageWallReady: Boolean(primary?.filePath && primary.runtimePath && primary.altText && existsSync(resolve(primary.filePath))),
    primaryImageKioskReady: Boolean(primary?.approvedForKiosk && primary.rightsStatus === 'approved'),
    imageCount: imageItems.length || person.imageUrls.length,
    galleryImageCount: gallery.length,
    imageRightsStatus: person.imageRightsStatus,
    hasVideo: person.hasVideo,
    videoCount: videos.length || person.youtubeVideoIds.length,
    videosKioskReady: videos.filter((video) => video.approvedForKiosk && video.rightsStatus === 'approved').length,
    videoRightsStatus: person.videoRightsStatus,
    mediaReviewStatus: person.mediaReviewStatus,
    missingLocalVideoFile: videos.some((video) => !video.filePath) || (person.localVideoPaths.length === 0 && person.youtubeVideoIds.length > 0),
    missingCaptionOrTranscript: videos.some((video) => !video.captionFilePath || !video.transcriptFilePath),
    missingPoster: videos.some((video) => !video.posterFilePath),
    videoSourceCount: person.youtubeVideoIds.length + person.videoUrls.length + person.localVideoPaths.length,
  };
}

function buildSummary(reviews) {
  const years = inductees.map((item) => item.classYear).filter(Number.isFinite);
  const issueCounts = countIssues(reviews);
  const highCleanup = reviews
    .filter((item) => item.issues.some((issue) => ['CONTACT_OR_ADDRESS_TEXT', 'CLASS_YEAR_IN_DISPLAY_NAME', 'COUNTRY_TAGS_MISSING', 'SUMMARY_TRUNCATED', 'BIO_TOO_SHORT', 'BIO_TOO_LONG'].includes(issue.code)))
    .sort((a, b) => b.weightedIssueScore - a.weightedIssueScore || a.name.localeCompare(b.name));
  const recordsWithoutEditorialCleanupFlags = reviews.filter((item) => {
    const blockingCodes = new Set(item.issues.map((issue) => issue.code));
    return (
      !blockingCodes.has('CONTACT_OR_ADDRESS_TEXT') &&
      !blockingCodes.has('CLASS_YEAR_IN_DISPLAY_NAME') &&
      !blockingCodes.has('COUNTRY_TAGS_MISSING') &&
      !blockingCodes.has('SUMMARY_TRUNCATED') &&
      !blockingCodes.has('BIO_TOO_SHORT') &&
      !blockingCodes.has('BIO_TOO_LONG') &&
      !blockingCodes.has('PROFILE_ALIAS_OR_DUPLICATE_REVIEW')
    );
  }).length;

  return {
    coverage: {
      totalInductees: inductees.length,
      yearRange: { min: Math.min(...years), max: Math.max(...years) },
      classYears: countBy(inductees.map((item) => String(item.classYear))),
      regions: countBy(inductees.map((item) => item.region)),
      missingClassYear: inductees.filter((item) => !Number.isFinite(item.classYear)).map((item) => item.id),
      missingBioText: inductees.filter((item) => !item.bioText).map((item) => item.id),
      missingPrimaryImage: inductees.filter((item) => !item.primaryImageUrl).map((item) => item.id),
      duplicateIds: duplicateIds(inductees),
    },
    curation: {
      curatedMetadataRecords: Object.keys(curatedRecords).length,
      curatedMetadataValidation: validateCuratedMetadata(curatedMetadata, expectedIds),
      approvalStatus: countBy(inductees.map((item) => item.approvalStatus || 'blank')),
      reviewPriority: countBy(inductees.map((item) => item.reviewPriority || 'blank')),
      summariesPopulated: inductees.filter((item) => Boolean(item.storySummary)).length,
      summarySource: countBy(inductees.map((item) => item.storySummarySource || 'blank')),
      truncatedSummaries: reviews.filter((item) => hasIssue(item, 'SUMMARY_TRUNCATED')).map((item) => item.id),
      documentedContextLines: inductees.filter((item) => Boolean(item.documentedContextLine)).length,
      honoredForSummaries: inductees.filter((item) => Boolean(item.honoredForSummary)).length,
      lifeWorkSummaries: inductees.filter((item) => Boolean(item.lifeWorkSummary)).length,
      pronunciationFilled: inductees.filter((item) => Boolean(item.pronunciation)).length,
      featured: inductees.filter((item) => item.featured).length,
      featuredCandidates: inductees.filter((item) => item.featuredCandidate).length,
    },
    taxonomy: {
      themeTagsSource: countBy(inductees.map((item) => item.themeTagsSource || 'blank')),
      approvedThemeTagRecords: inductees.filter((item) => item.themeTagsSource === 'curated').length,
      countryTagsSource: countBy(inductees.map((item) => item.countryTagsSource || 'blank')),
      recordsWithCountryTags: inductees.filter((item) => item.countryTags.length > 0).length,
      recordsMissingCountryTags: inductees.filter((item) => item.countryTags.length === 0).map((item) => item.id),
      recordsWithCommunityTags: inductees.filter((item) => item.communityTags.length > 0).length,
      recordsMissingCommunityTags: inductees.filter((item) => item.communityTags.length === 0).length,
      topThemes: topCounts(inductees.flatMap((item) => item.themeTags), 12),
      topCountries: topCounts(inductees.flatMap((item) => item.countryTags), 12),
      topCommunities: topCounts(inductees.flatMap((item) => item.communityTags), 12),
    },
    textQuality: {
      averageBioWords: round(average(reviews.map((item) => item.text.bioWords))),
      medianBioWords: median(reviews.map((item) => item.text.bioWords)),
      shortestProfiles: reviews.slice().sort((a, b) => a.text.bioWords - b.text.bioWords).slice(0, 10).map(profileSummary),
      longestProfiles: reviews.slice().sort((a, b) => b.text.bioWords - a.text.bioWords).slice(0, 10).map(profileSummary),
      leadingNameDuplication: reviews.filter((item) => hasIssue(item, 'LEADING_NAME_DUPLICATION')).map((item) => item.id),
      classYearInDisplayName: reviews.filter((item) => hasIssue(item, 'CLASS_YEAR_IN_DISPLAY_NAME')).map((item) => item.id),
      lifeDatesInDisplayName: reviews.filter((item) => hasIssue(item, 'LIFE_DATES_IN_DISPLAY_NAME')).map((item) => item.id),
      temporalWording: reviews.filter((item) => hasIssue(item, 'TEMPORAL_WORDING_REVIEW')).map((item) => item.id),
      contactOrAddressText: reviews.filter((item) => hasIssue(item, 'CONTACT_OR_ADDRESS_TEXT')).map((item) => item.id),
      shortProfiles: reviews.filter((item) => hasIssue(item, 'BIO_TOO_SHORT')).map((item) => item.id),
      longProfiles: reviews.filter((item) => hasIssue(item, 'BIO_TOO_LONG')).map((item) => item.id),
    },
    media: buildMediaSummary(reviews),
    physicalWall: {
      positionRecords: Object.keys(physicalWallMetadata.positions ?? {}).length,
      recordsWithWallMapping: reviews.filter((item) => !hasIssue(item, 'PHYSICAL_WALL_POSITION_MISSING')).length,
      recordsMissingWallMapping: reviews.filter((item) => hasIssue(item, 'PHYSICAL_WALL_POSITION_MISSING')).map((item) => item.id),
      validation: physicalWallValidation,
    },
    relationshipsAndEntities: buildRelationshipSummary(),
    sourceBacklog: buildSourceBacklog(),
    storyInfrastructure: {
      storySections: Array.isArray(storySections.records) ? storySections.records.length : Object.keys(storySections.records ?? {}).length,
      storyLenses: Array.isArray(storyLenses.lenses) ? storyLenses.lenses.length : Object.keys(storyLenses.lenses ?? {}).length,
      archiveItems: Array.isArray(archiveItems.records) ? archiveItems.records.length : Object.keys(archiveItems.records ?? {}).length,
      wrhsStoryLeads: wrhsAddendum.summary?.storySectionReviewDrafts?.wrhsAddendumLeads ?? 0,
    },
    readiness: {
      recordsWithoutEditorialCleanupFlags,
      needsEditorialCleanupBeforeApproval: highCleanup.length,
      highestPriorityCleanup: highCleanup.slice(0, 30).map((item) => ({
        id: item.id,
        name: item.name,
        classYear: item.classYear,
        score: item.weightedIssueScore,
        issueCodes: item.issues.map((issue) => issue.code),
        nextBestAction: item.sourceReview.nextBestAction,
      })),
      readinessTiers: countBy(reviews.map((item) => item.readinessTier)),
    },
    issueCounts,
  };
}

function buildMediaSummary(reviews) {
  const mediaSummary = mediaReport.summary ?? {};
  const imageItems = [];
  const videoItems = [];
  Object.values(mediaRecords).forEach((record) => {
    if (record.images?.primary) imageItems.push({ id: record.id, asset: record.images.primary });
    (record.images?.gallery ?? []).forEach((asset) => imageItems.push({ id: record.id, asset }));
    (record.videos ?? []).forEach((asset) => videoItems.push({ id: record.id, asset }));
  });

  return {
    mediaRecords: Object.keys(mediaRecords).length,
    primaryImages: inductees.filter((item) => item.primaryImageUrl).length,
    primaryImagesWallReady: mediaSummary.primaryImagesWallReady ?? reviews.filter((item) => item.media.primaryImageWallReady).length,
    primaryImagesKioskReady: mediaSummary.primaryImagesReady ?? reviews.filter((item) => item.media.primaryImageKioskReady).length,
    galleryImages: mediaSummary.galleryImages ?? imageItems.length - inductees.length,
    recordsWithGalleryImages: inductees.filter((item) => item.hasGallery).length,
    recordsWithVideo: inductees.filter((item) => item.hasVideo).length,
    recordsWithoutVideo: inductees.filter((item) => !item.hasVideo).length,
    videoItems: mediaSummary.videoItems ?? videoItems.length,
    videosKioskReady: mediaSummary.videosReady ?? videoItems.filter((item) => item.asset.approvedForKiosk).length,
    missingVideoLocalFiles: unique(mediaSummary.missingVideoLocalFiles ?? []),
    missingVideoPosters: unique(mediaSummary.missingVideoPosters ?? []),
    missingCaptions: unique(mediaSummary.missingCaptions ?? []),
    missingTranscripts: unique(mediaSummary.missingTranscripts ?? []),
    imageRightsNeedsReview: unique(mediaSummary.imageRightsNeedsReview ?? []),
    videoRightsNeedsReview: unique(mediaSummary.videoRightsNeedsReview ?? []),
  };
}

function buildRelationshipSummary() {
  return {
    explicitCuratedRelationships: explicitRelationshipList.length,
    generatedEntityRelationships: entityRelationshipList.length,
    generatedRelationshipTypes: entityReport.relationshipTypes ?? topCounts(entityRelationshipList.map((item) => item.type), 20),
    generatedRelationshipProvenance: entityReport.provenance ?? [],
    generatedEntityTotals: entityReport.totals ?? {},
    generatedEntityTypes: entityReport.entityTypes ?? [],
    validation: entityReport.validation ?? {},
    averageRelatedIdsPerPerson: round(average(inductees.map((item) => item.relatedIds.length))),
    recordsWithoutRelatedIds: inductees.filter((item) => item.relatedIds.length === 0).map((item) => item.id),
    relationshipReviewDrafts: sourcePacket.summary?.relationshipReviewDrafts ?? originalSourceCandidates.summary?.relationshipReviewDrafts ?? {},
  };
}

function buildSourceBacklog() {
  return {
    originalSiteHarvest: originalSourceCandidates.summary ?? {},
    sourceCurationPacket: sourcePacket.summary ?? {},
    duplicateSourceGroups: sourcePacket.summary?.sourceProfiles?.duplicateGroups ?? originalSourceCandidates.summary?.duplicateSourceGroups ?? 0,
    unresolvedSourceProfiles: sourcePacket.summary?.sourceProfiles?.unresolved ?? originalSourceCandidates.summary?.unresolvedProfileCandidates ?? 0,
    sourceProfileReferences: Array.isArray(sourcePacket.sourceProfileReferences) ? sourcePacket.sourceProfileReferences.length : 0,
    guardrails: sourcePacket.guardrails ?? {},
  };
}

function buildSourceInventory() {
  return {
    reviewedSources,
    explicitlyExcludedSources,
    originalSourceProfileMatches: originalSourceCandidates.summary?.resolvedProfileMatches ?? sourcePacket.summary?.sourceProfiles?.resolved ?? 0,
    unresolvedOriginalSourceProfiles: sourcePacket.summary?.sourceProfiles?.unresolved ?? originalSourceCandidates.summary?.unresolvedProfileCandidates ?? 0,
    originalMediaCandidates: originalSourceCandidates.summary?.mediaCandidates ?? 0,
    originalVideoCandidates: originalSourceCandidates.summary?.videoCandidates ?? 0,
    originalRelationshipCandidates: originalSourceCandidates.summary?.relationshipCandidates ?? 0,
    originalOrganizationCandidates: originalSourceCandidates.summary?.organizationCandidates ?? 0,
    originalStoryBeatCandidates: originalSourceCandidates.summary?.storyBeatCandidates ?? 0,
  };
}

function buildFindings(summary) {
  return [
    {
      title: 'Coverage is structurally complete, but curation remains draft-state.',
      detail: `All ${summary.coverage.totalInductees} records have biography text, class year, profile URL, and primary image coverage; approval status is still ${formatCountMap(summary.curation.approvalStatus)}.`,
    },
    {
      title: 'Text is usable as a draft base, not final exhibit copy.',
      detail: `${summary.curation.summariesPopulated} profiles have populated summaries and ${summary.curation.lifeWorkSummaries} have life/work summaries, but ${summary.textQuality.leadingNameDuplication.length} bios show leading scraped-name duplication, ${summary.curation.truncatedSummaries.length} summaries appear truncated, and ${summary.textQuality.longProfiles.length} profiles are over 900 words.`,
    },
    {
      title: 'Taxonomy is partially normalized.',
      detail: `${summary.taxonomy.recordsWithCountryTags} records have country/heritage tags, but theme tags are ${formatCountMap(summary.taxonomy.themeTagsSource)} and only ${summary.taxonomy.recordsWithCommunityTags} records have normalized community tags.`,
    },
    {
      title: 'Media can support wall display, but not final rights-cleared kiosk use.',
      detail: `${summary.media.primaryImagesWallReady}/${summary.media.primaryImages} primary images are wall-ready; ${summary.media.primaryImagesKioskReady} primary images and ${summary.media.videosKioskReady}/${summary.media.videoItems} videos are kiosk-ready under rights/caption/transcript rules.`,
    },
    {
      title: 'Physical wall placement needs a source-of-truth mapping pass.',
      detail: `${summary.physicalWall.recordsMissingWallMapping.length}/${summary.coverage.totalInductees} records are missing row, column, panel, or coordinate metadata. The wall metadata validator reports ${summary.physicalWall.validation.errors.length} errors and ${summary.physicalWall.validation.warnings.length} warnings.`,
    },
    {
      title: 'Relationship content is scaffolded, not approved.',
      detail: `${summary.relationshipsAndEntities.generatedEntityRelationships} generated entity relationships exist, but the explicit curated relationship file has ${summary.relationshipsAndEntities.explicitCuratedRelationships} approved relationships.`,
    },
    {
      title: 'The original-source backlog is valuable but needs triage.',
      detail: `The source packet has ${summary.sourceBacklog.sourceCurationPacket?.mediaReviewDrafts?.total ?? 0} media review drafts, ${summary.sourceBacklog.sourceCurationPacket?.relationshipReviewDrafts?.total ?? 0} relationship review drafts, and ${summary.sourceBacklog.sourceCurationPacket?.storySectionReviewDrafts?.total ?? 0} story-section leads.`,
    },
  ];
}

function buildRecommendedPlan(summary) {
  return [
    {
      phase: 'Pass 1: identity and scrape cleanup',
      work: [
        `Fix ${summary.textQuality.classYearInDisplayName.length} display-name/year artifacts.`,
        `Review ${summary.textQuality.leadingNameDuplication.length} leading-name duplication cases.`,
        `Remove or rewrite ${summary.textQuality.contactOrAddressText.length} contact/address-like profile fragments.`,
      ],
    },
    {
      phase: 'Pass 2: exhibit-copy approval',
      work: [
        `Move ${summary.curation.summariesPopulated} populated summaries from draft to curator-reviewed status in batches.`,
        `Rewrite ${summary.curation.truncatedSummaries.length} truncated summaries before approval.`,
        `Condense ${summary.textQuality.longProfiles.length} long biographies and expand ${summary.textQuality.shortProfiles.length} short biographies where needed.`,
      ],
    },
    {
      phase: 'Pass 3: taxonomy and accessibility',
      work: [
        `Approve or revise generated theme tags across ${summary.coverage.totalInductees} records.`,
        `Fill the ${summary.taxonomy.recordsMissingCountryTags.length} missing country/heritage tag records.`,
        `Complete plain-language, sensitive-content, and image-description review across all ${summary.coverage.totalInductees} records.`,
      ],
    },
    {
      phase: 'Pass 4: media and relationship readiness',
      work: [
        `Clear rights for ${summary.media.imageRightsNeedsReview.length} records with image rights needs.`,
        `Clear video rights/captions/transcripts for ${summary.media.videoRightsNeedsReview.length} video records.`,
        `Set physical wall placement metadata for ${summary.physicalWall.recordsMissingWallMapping.length} records.`,
        `Promote only reviewed relationship leads from the ${summary.sourceBacklog.sourceCurationPacket?.relationshipReviewDrafts?.total ?? 0}-item relationship review backlog.`,
      ],
    },
  ];
}

function buildMarkdown(data) {
  const s = data.summary;
  const lines = [];
  lines.push('# CIHOF Non-External Content Review');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('This report reviews the current repository content only. It excludes the external research collection and contribution files under `data/external-research/`.');
  lines.push('');
  lines.push('Reviewed non-external sources:');
  lines.push('');
  data.scope.included.forEach((source) => lines.push(`- \`${source}\``));
  lines.push('');
  lines.push('Explicitly excluded:');
  lines.push('');
  data.scope.excluded.forEach((source) => lines.push(`- \`${source}\``));
  lines.push('');
  lines.push('## Executive Read');
  lines.push('');
  lines.push(`The collection is structurally broad: ${s.coverage.totalInductees} inductees from ${s.coverage.yearRange.min}-${s.coverage.yearRange.max}, all with biography text and primary images. It is not yet final exhibit content. Every profile is still in draft approval status, all theme tags are generated-only, all primary images need rights approval for kiosk use, and accessibility review is open across the set.`);
  lines.push('');
  lines.push(`${s.readiness.recordsWithoutEditorialCleanupFlags} records do not show one of the targeted editorial cleanup flags in this pass; those still need the global approval, rights, accessibility, taxonomy, and wall-mapping checks before final use.`);
  lines.push('');
  lines.push('The best next move is a cleanup-and-approval pass over the content we already have, before integrating any external material. Fix scrape artifacts and obvious stale text first, then approve summaries/taxonomy/media in small batches.');
  lines.push('');
  lines.push('## Key Metrics');
  lines.push('');
  lines.push('| Area | Current state |');
  lines.push('| --- | --- |');
  lines.push(`| Profiles | ${s.coverage.totalInductees} records; missing bios: ${s.coverage.missingBioText.length}; missing primary images: ${s.coverage.missingPrimaryImage.length}; duplicate ids: ${s.coverage.duplicateIds.length} |`);
  lines.push(`| Approval | ${formatCountMap(s.curation.approvalStatus)} |`);
  lines.push(`| Review priority | ${formatCountMap(s.curation.reviewPriority)} |`);
  lines.push(`| Summaries | ${s.curation.summariesPopulated} populated; ${s.curation.truncatedSummaries.length} appear truncated |`);
  lines.push(`| Taxonomy | country tags on ${s.taxonomy.recordsWithCountryTags}; community tags on ${s.taxonomy.recordsWithCommunityTags}; theme tags approved on ${s.taxonomy.approvedThemeTagRecords} |`);
  lines.push(`| Media | ${s.media.primaryImagesWallReady}/${s.media.primaryImages} primary images wall-ready; ${s.media.primaryImagesKioskReady} primary images kiosk-ready; ${s.media.videosKioskReady}/${s.media.videoItems} videos kiosk-ready |`);
  lines.push(`| Relationships | ${s.relationshipsAndEntities.generatedEntityRelationships} generated entity relationships; ${s.relationshipsAndEntities.explicitCuratedRelationships} explicit curated relationships |`);
  lines.push(`| Physical wall | ${s.physicalWall.recordsWithWallMapping}/${s.coverage.totalInductees} mapped; ${s.physicalWall.recordsMissingWallMapping.length} missing; validation errors: ${s.physicalWall.validation.errors.length}; warnings: ${s.physicalWall.validation.warnings.length} |`);
  lines.push(`| Cleanup triage | ${s.readiness.recordsWithoutEditorialCleanupFlags} records without targeted editorial cleanup flags; ${s.readiness.needsEditorialCleanupBeforeApproval} records needing targeted cleanup before approval |`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  data.findings.forEach((finding) => {
    lines.push(`### ${finding.title}`);
    lines.push('');
    lines.push(finding.detail);
    lines.push('');
  });
  lines.push('## Content Quality Flags');
  lines.push('');
  lines.push('| Flag | Count | Records |');
  lines.push('| --- | ---: | --- |');
  lines.push(rowForList('Class year in display name', s.textQuality.classYearInDisplayName));
  lines.push(rowForList('Leading name duplication', s.textQuality.leadingNameDuplication));
  lines.push(rowForList('Truncated summaries', s.curation.truncatedSummaries));
  lines.push(rowForList('Long biographies over 900 words', s.textQuality.longProfiles));
  lines.push(rowForList('Short biographies under 150 words', s.textQuality.shortProfiles));
  lines.push(rowForList('Time-sensitive wording', s.textQuality.temporalWording));
  lines.push(rowForList('Contact/address-like text', s.textQuality.contactOrAddressText));
  lines.push(rowForList('Missing country/heritage tags', s.taxonomy.recordsMissingCountryTags));
  lines.push('');
  lines.push('## Highest Priority Cleanup Queue');
  lines.push('');
  lines.push('| # | Person | Class | Score | Main flags | Next action |');
  lines.push('| ---: | --- | ---: | ---: | --- | --- |');
  s.readiness.highestPriorityCleanup.slice(0, 30).forEach((item, index) => {
    lines.push(
      `| ${index + 1} | ${escapeCell(item.name)} | ${item.classYear ?? ''} | ${item.score} | ${escapeCell(item.issueCodes.slice(0, 6).join(', '))} | ${escapeCell(item.nextBestAction)} |`,
    );
  });
  lines.push('');
  lines.push('## Recommended Plan');
  lines.push('');
  data.recommendedPlan.forEach((phase) => {
    lines.push(`### ${phase.phase}`);
    lines.push('');
    phase.work.forEach((item) => lines.push(`- ${item}`));
    lines.push('');
  });
  lines.push('## Source And Review Backlog');
  lines.push('');
  lines.push('| Backlog | Count | Notes |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| Resolved original source profiles | ${s.sourceBacklog.sourceCurationPacket?.sourceProfiles?.resolved ?? 0} | Current source packet references. |`);
  lines.push(`| Unresolved original source profiles | ${s.sourceBacklog.unresolvedSourceProfiles} | Needs manual source mapping. |`);
  lines.push(`| Duplicate source groups | ${s.sourceBacklog.duplicateSourceGroups} | Needs merge/alias review. |`);
  lines.push(`| Media review drafts | ${s.sourceBacklog.sourceCurationPacket?.mediaReviewDrafts?.total ?? 0} | Candidate-only, rights review required. |`);
  lines.push(`| Video review drafts | ${s.sourceBacklog.sourceCurationPacket?.videoReviewDrafts?.total ?? 0} | Candidate-only, context/rights/captions required. |`);
  lines.push(`| Relationship review drafts | ${s.sourceBacklog.sourceCurationPacket?.relationshipReviewDrafts?.total ?? 0} | Candidate-only; do not public-display until approved. |`);
  lines.push(`| Story-section review drafts | ${s.sourceBacklog.sourceCurationPacket?.storySectionReviewDrafts?.total ?? 0} | Rewrite before publication. |`);
  lines.push(`| WRHS addendum leads | ${s.storyInfrastructure.wrhsStoryLeads} | Catalog/finding-aid leads only. |`);
  lines.push('');
  lines.push('## Appendix: All Profile Review Matrix');
  lines.push('');
  lines.push('| Person | Class | Priority | Bio words | Media | Issue count | Top issues |');
  lines.push('| --- | ---: | --- | ---: | --- | ---: | --- |');
  data.personReviews.forEach((item) => {
    const media = item.media.hasVideo ? `${item.media.imageCount} img, ${item.media.videoCount} vid` : `${item.media.imageCount} img, no vid`;
    lines.push(
      `| ${escapeCell(item.name)} | ${item.classYear ?? ''} | ${escapeCell(item.reviewPriority)} | ${item.text.bioWords} | ${escapeCell(media)} | ${item.issues.length} | ${escapeCell(item.issues.slice(0, 5).map((issue) => issue.code).join(', '))} |`,
    );
  });
  lines.push('');
  lines.push(`Full per-person details are in \`${jsonOutputPath.replace(`${process.cwd()}/`, '')}\`.`);
  return lines.join('\n');
}

function addIssue(issues, code, severity, message, weight) {
  issues.push({ code, severity, message, weight });
}

function readinessTier(issues) {
  if (issues.some((issue) => issue.severity === 'blocker')) return 'not-ready-draft';
  if (issues.some((issue) => issue.severity === 'high')) return 'needs-high-priority-cleanup';
  if (issues.some((issue) => issue.severity === 'medium')) return 'needs-editorial-review';
  return 'ready-for-curator-approval';
}

function nextBestAction(issues, source, person) {
  if (issues.some((issue) => issue.code === 'CONTACT_OR_ADDRESS_TEXT')) return 'Remove or rewrite contact/address-like text before approval.';
  if (issues.some((issue) => issue.code === 'CLASS_YEAR_IN_DISPLAY_NAME')) return 'Clean display name and regenerate dependent ids only with an alias plan.';
  if (issues.some((issue) => issue.code === 'SUMMARY_TRUNCATED')) return 'Rewrite summary from the source profile before curator approval.';
  if (issues.some((issue) => issue.code === 'COUNTRY_TAGS_MISSING')) return 'Confirm nationality/heritage metadata.';
  if ((source.newImageReviewCount ?? 0) > 0) return 'Review image leads for rights and portrait suitability.';
  if (person.hasVideo) return 'Review linked video rights, captions, transcripts, and local file status.';
  return 'Approve summary, taxonomy, image rights, and accessibility fields as a batch.';
}

function hasIssue(review, code) {
  return review.issues.some((issue) => issue.code === code);
}

function hasLeadingDuplicateName(person) {
  const base = stripDisplayNameArtifacts(person.name);
  const normalizedBio = normalizeText(person.bioText);
  const normalizedName = normalizeText(base);
  if (!normalizedName) return false;
  return normalizedBio.startsWith(`${normalizedName} ${normalizedName}`);
}

function hasClassYearInDisplayName(person) {
  return new RegExp(`[–-]\\s*${person.classYear}\\s*$`, 'u').test(person.name);
}

function hasLifeDatesInDisplayName(person) {
  return /\(\d{4}\s*[–-]\s*\d{4}\)/u.test(person.name);
}

function hasTemporalWording(text) {
  return /\b(currently|today|now)\b/i.test(text);
}

function hasContactLikeText(text) {
  return (
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(text) ||
    /\b\d{2,5}\s+(?:Public Square|Lakeshore Boulevard)\b/i.test(text)
  );
}

function isDefaultAltText(text) {
  return /^Portrait or archival image of .+, Class of \d{4}\.$/.test(text);
}

function hasPhysicalWallMapping(person) {
  return Boolean(person.physicalRow || person.physicalColumn || person.physicalPanel || person.wallCoordinates || person.physicalPortraitPresent);
}

function stripDisplayNameArtifacts(name) {
  return name
    .replace(/\s+[–-]\s*\d{4}$/u, '')
    .replace(/\s*\(\d{4}\s*[–-]\s*\d{4}\)\s*$/u, '')
    .trim();
}

function buildFindIssueCounts(reviews) {
  return reviews.flatMap((review) => review.issues.map((issue) => issue.code));
}

function countIssues(reviews) {
  return countBy(buildFindIssueCounts(reviews));
}

function profileSummary(item) {
  return {
    id: item.id,
    name: item.name,
    classYear: item.classYear,
    words: item.text.bioWords,
  };
}

function duplicateIds(items) {
  const counts = countBy(items.map((item) => item.id));
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}

function unique(values) {
  return Array.from(new Set(values));
}

function countBy(values) {
  return values.reduce((counts, value) => {
    const key = String(value || 'blank');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function topCounts(values, limit) {
  return Object.entries(countBy(values))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  if (usable.length === 0) return 0;
  return usable.reduce((total, value) => total + value, 0) / usable.length;
}

function median(values) {
  const usable = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (usable.length === 0) return 0;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[mid] : round((usable[mid - 1] + usable[mid]) / 2);
}

function wordCount(text) {
  return String(text ?? '').split(/\s+/).filter(Boolean).length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function severityRank(severity) {
  return { blocker: 0, high: 1, medium: 2, low: 3 }[severity] ?? 4;
}

function formatCountMap(map) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}: ${count}`)
    .join('; ');
}

function rowForList(label, values) {
  return `| ${escapeCell(label)} | ${values.length} | ${escapeCell(formatList(values, 12))} |`;
}

function formatList(values, limit = 12) {
  const list = values.slice(0, limit).join(', ');
  const remaining = values.length - limit;
  return remaining > 0 ? `${list}, +${remaining} more` : list || 'none';
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
