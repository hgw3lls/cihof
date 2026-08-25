import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCountryInferences, loadCuratedMetadata, loadInductees, loadMediaManifest } from './data-utils.js';

const candidatesPath = resolve('data/original-site-harvest/cihof-source-candidates.json');
const outputDir = resolve('data/original-site-harvest/pre-curation');
const packetPath = resolve(outputDir, 'cihof-pre-curation-packet.json');

if (!existsSync(candidatesPath)) {
  throw new Error(`Missing source candidates. Run npm run source:candidates first: ${candidatesPath}`);
}

const generatedAt = new Date().toISOString();
const sourceCandidates = JSON.parse(readFileSync(candidatesPath, 'utf8'));
const inductees = loadInductees();
const mediaManifest = loadMediaManifest({ optional: true });
const curatedMetadata = loadCuratedMetadata({ optional: true });
const countryInferences = loadCountryInferences({ optional: true });

const inducteeById = new Map(inductees.map((inductee) => [inductee.id, inductee]));
const currentMedia = buildCurrentMediaIndex(mediaManifest, inductees);

const sourceProfileReferences = buildSourceProfileReferences(sourceCandidates.profileMatches);
const profileUrlAliasDrafts = buildProfileUrlAliasDrafts(sourceCandidates.profileAliasCandidates);
const mediaReviewDrafts = buildMediaReviewDrafts(sourceCandidates.mediaCandidates, currentMedia);
const videoReviewDrafts = buildVideoReviewDrafts(sourceCandidates.videoCandidates, currentMedia);
const relationshipReviewDrafts = buildRelationshipReviewDrafts(sourceCandidates);
const placeReviewDrafts = buildPlaceReviewDrafts(sourceCandidates.placeCandidates);
const placePhraseReviewDrafts = buildPlacePhraseReviewDrafts(sourceCandidates.placeCandidates);
const organizationReviewDrafts = buildOrganizationReviewDrafts(sourceCandidates.organizationCandidates);
const storySectionReviewDrafts = buildStorySectionReviewDrafts(sourceCandidates.storyBeatCandidates);
const classEvidenceReviewDrafts = buildClassEvidenceReviewDrafts(sourceCandidates.classEvidenceCandidates);
const unresolvedSourceRecords = buildUnresolvedSourceRecords(sourceCandidates.unresolvedProfileCandidates);
const duplicateSourceGroups = sourceCandidates.duplicateSourceGroups ?? [];

const packet = {
  schemaVersion: 1,
  source: {
    generator: 'scripts/generate-source-drafts.js',
    generatedAt,
    sourceCandidatesPath: 'data/original-site-harvest/cihof-source-candidates.json',
    originalSite: 'https://clevelandinternationalhalloffame.com/',
    note: 'Pre-curation drafts derived from the original CIHOF site harvest. These are review aids only and do not approve public facts, media rights, geography, or relationships.',
  },
  guardrails: {
    runtimeDataChanged: false,
    mediaRights: 'Do not mark media approved from this packet. Route image and video leads through the existing media manifest review workflow.',
    relationships: 'Relationships here are documented-source or weak-source candidates. Curator approval is still required before public relationship display.',
    geography: 'Places are textual evidence leads only. Migration direction is never inferred.',
    storyText: 'Story beat excerpts are short source pointers for curator rewriting, not publication-ready text.',
  },
  summary: {},
  curationIndex: [],
  sourceProfileReferences,
  profileUrlAliasDrafts,
  duplicateSourceGroups,
  mediaReviewDrafts,
  videoReviewDrafts,
  relationshipReviewDrafts,
  placeReviewDrafts,
  placePhraseReviewDrafts,
  organizationReviewDrafts,
  storySectionReviewDrafts,
  classEvidenceReviewDrafts,
  unresolvedSourceRecords,
};

packet.summary = buildSummary(packet);
packet.curationIndex = buildCurationIndex(packet);

mkdirSync(outputDir, { recursive: true });
writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`);
writeReviewCsvs(packet);
writeReadme(packet);

console.log(`Generated pre-curation packet for ${packet.curationIndex.length} current inductees.`);
console.log(`${packet.summary.profileUrlAliasDrafts.safeReview} profile aliases are ready for low-risk review.`);
console.log(`${packet.summary.videoReviewDrafts.newProfileEmbeds} new profile-page videos need rights/caption review.`);
console.log(`${packet.summary.relationshipReviewDrafts.resolvedInductionLinks} resolved inducted-by links can be reviewed as documented relationship candidates.`);
console.log(`Wrote ${packetPath}`);
console.log(`Wrote review CSVs to ${outputDir}`);

function buildSourceProfileReferences(matches = []) {
  return matches
    .filter((match) => match.inducteeId)
    .map((match) => ({
      inducteeId: match.inducteeId,
      inducteeName: match.inducteeName,
      classYear: match.classYear,
      sourceUrl: match.sourceUrl,
      canonicalUrl: match.canonicalUrl,
      sourceTitle: match.sourceTitle,
      sourceModified: match.sourceModified,
      matchType: match.matchType,
      confidence: match.confidence,
      sourceRegionCandidates: match.sourceRegionCandidates ?? [],
      sourceClassYearCandidates: match.sourcePrimaryClassYearCandidates ?? [],
      reviewAction: match.confidence >= 0.95 ? 'source-profile-reference-ready' : 'source-profile-reference-review',
    }))
    .sort(compareByPerson);
}

function buildProfileUrlAliasDrafts(candidates = []) {
  return candidates
    .map((candidate) => ({
      inducteeId: candidate.inducteeId,
      inducteeName: candidate.inducteeName,
      classYear: candidate.classYear,
      currentProfileUrl: candidate.currentProfileUrl,
      alternateSourceUrl: candidate.alternateSourceUrl,
      sourceTitle: candidate.sourceTitle,
      matchType: candidate.matchType,
      confidence: candidate.confidence,
      reviewAction: candidate.confidence >= 0.95 ? 'safe-profile-alias-review' : 'profile-alias-needs-review',
      publishStatus: 'do-not-publish-until-reviewed',
    }))
    .sort(compareByPerson);
}

function buildMediaReviewDrafts(candidates = [], currentMediaIndex) {
  const seen = new Set();
  return candidates
    .filter((candidate) => candidate.inducteeId && candidate.sourceUrl && candidate.confidence >= 0.56)
    .map((candidate) => {
      const existing = currentMediaIndex.imageUrlsByPerson.get(candidate.inducteeId)?.has(normalizeUrl(candidate.sourceUrl)) ?? false;
      return {
        inducteeId: candidate.inducteeId,
        inducteeName: candidate.inducteeName,
        classYear: candidate.classYear,
        mediaType: 'image',
        roleCandidate: candidate.roleCandidate,
        confidence: candidate.confidence,
        sourceUrl: candidate.sourceUrl,
        sourcePageUrl: candidate.sourcePageUrl,
        sourcePageTitle: candidate.sourcePageTitle,
        width: candidate.width ?? null,
        height: candidate.height ?? null,
        altText: candidate.altText ?? '',
        caption: trimForReview(candidate.caption, 24),
        alreadyInMediaManifest: existing,
        rightsStatus: existing ? 'existing-source-reference' : 'needs-rights-review',
        reviewAction: existing
          ? 'confirm-existing-media-source'
          : candidate.confidence >= 0.84
            ? 'review-as-person-specific-image'
            : 'review-as-profile-or-gallery-image',
      };
    })
    .filter((candidate) => {
      const key = `${candidate.inducteeId}:${normalizeUrl(candidate.sourceUrl)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.alreadyInMediaManifest) - Number(b.alreadyInMediaManifest) || b.confidence - a.confidence || compareByPerson(a, b));
}

function buildVideoReviewDrafts(candidates = [], currentMediaIndex) {
  const seen = new Set();
  return candidates
    .filter((candidate) => candidate.inducteeId && candidate.youtubeVideoId)
    .map((candidate) => {
      const existing = candidate.alreadyPresent || (currentMediaIndex.youtubeIdsByPerson.get(candidate.inducteeId)?.has(candidate.youtubeVideoId) ?? false);
      const sourceUrl = `https://www.youtube.com/watch?v=${candidate.youtubeVideoId}`;
      return {
        inducteeId: candidate.inducteeId,
        inducteeName: candidate.inducteeName,
        classYear: candidate.classYear,
        youtubeVideoId: candidate.youtubeVideoId,
        sourceUrl,
        sourcePageUrl: candidate.sourcePageUrl,
        sourcePageTitle: candidate.sourcePageTitle,
        assignment: candidate.assignment,
        confidence: candidate.confidence,
        alreadyInMediaManifest: existing,
        rightsStatus: existing ? 'existing-source-reference' : 'needs-rights-caption-transcript-review',
        reviewAction: existing
          ? 'confirm-existing-video-source'
          : candidate.assignment === 'profile-page-embed' && candidate.confidence >= 0.88
            ? 'review-as-profile-video'
            : 'review-video-context-before-assignment',
      };
    })
    .filter((candidate) => {
      const key = `${candidate.inducteeId}:${candidate.youtubeVideoId}:${candidate.sourcePageUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.alreadyInMediaManifest) - Number(b.alreadyInMediaManifest) || b.confidence - a.confidence || compareByPerson(a, b));
}

function buildRelationshipReviewDrafts(candidates) {
  const inductionLinks = (candidates.inductionRelationshipCandidates ?? []).map((candidate) => ({
    sourcePersonId: candidate.fromInducteeId,
    sourcePersonName: candidate.fromName,
    targetEntityType: candidate.targetInducteeId ? 'person' : 'person-name',
    targetEntityId: candidate.targetInducteeId ?? slugify(candidate.targetName),
    targetDisplayName: candidate.targetInducteeName ?? candidate.targetName,
    type: 'inducted_by',
    displayLabel: 'Inducted by',
    provenanceCandidate: candidate.targetInducteeId ? 'documented-source-candidate' : 'source-name-needs-resolution',
    confidence: candidate.confidence,
    evidenceCount: 1,
    evidenceTypes: ['inducted-by-line'],
    sourcePageUrls: [candidate.sourcePageUrl],
    referenceNote: `Original CIHOF profile lists inducted by ${candidate.targetName}.`,
    reviewAction: candidate.targetInducteeId ? 'review-as-documented-person-relationship' : 'resolve-presenter-before-relationship',
    publicUse: 'candidate-only',
  }));

  const groupedPairs = new Map();
  for (const candidate of candidates.relationshipCandidates ?? []) {
    if (!candidate.personAId || !candidate.personBId) continue;
    const key = [candidate.personAId, candidate.personBId].sort().join('|');
    const existing = groupedPairs.get(key) ?? {
      sourcePersonId: candidate.personAId,
      sourcePersonName: candidate.personAName,
      targetEntityType: 'person',
      targetEntityId: candidate.personBId,
      targetDisplayName: candidate.personBName,
      type: candidate.evidenceType === 'profile-name-mention' ? 'related_event' : 'same_class',
      displayLabel: candidate.evidenceType === 'profile-name-mention' ? 'Named in profile source' : 'Shared source page',
      provenanceCandidate: 'weak-source-candidate',
      confidence: 0,
      evidenceCount: 0,
      evidenceTypes: [],
      sourcePageUrls: [],
      referenceNote: '',
      reviewAction: '',
      publicUse: 'candidate-only',
    };
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    existing.evidenceCount += 1;
    existing.evidenceTypes = Array.from(new Set([...existing.evidenceTypes, candidate.evidenceType])).sort();
    existing.sourcePageUrls = Array.from(new Set([...existing.sourcePageUrls, candidate.sourcePageUrl])).sort();
    groupedPairs.set(key, existing);
  }

  const pairLinks = Array.from(groupedPairs.values()).map((candidate) => ({
    ...candidate,
    provenanceCandidate: candidate.evidenceTypes.includes('profile-name-mention') ? 'profile-mention-candidate' : 'shared-page-candidate',
    referenceNote:
      candidate.evidenceTypes.includes('profile-name-mention')
        ? 'Original CIHOF source text names both people; review the page context before labeling a relationship.'
        : 'Original CIHOF source page mentions both people; review before using as a public connection.',
    reviewAction:
      candidate.evidenceTypes.includes('profile-name-mention') && candidate.evidenceCount > 1
        ? 'prioritize-relationship-context-review'
        : 'relationship-context-review',
  }));

  return [...inductionLinks, ...pairLinks].sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount || a.sourcePersonName.localeCompare(b.sourcePersonName));
}

function buildPlaceReviewDrafts(candidates = []) {
  const grouped = new Map();
  for (const candidate of candidates) {
    if (!candidate.inducteeId || !candidate.placeLabel) continue;
    const countryKeys = new Set([
      ...(inducteeById.get(candidate.inducteeId)?.countryTags ?? []),
      ...(countryInferences.records?.[candidate.inducteeId]?.inferredCountryTags ?? []),
    ].map(nameKey));
    if (!isReviewablePlaceLead(candidate, countryKeys)) continue;
    const placeLabel = cleanReviewLabel(candidate.placeLabel);
    const key = `${candidate.inducteeId}:${nameKey(placeLabel)}`;
    const existing = grouped.get(key) ?? {
      inducteeId: candidate.inducteeId,
      inducteeName: candidate.inducteeName,
      classYear: candidate.classYear,
      placeLabel,
      placeScopeHint: classifyPlaceScope(placeLabel),
      confidence: 0,
      evidenceCount: 0,
      evidenceTypes: [],
      sourcePageUrls: [],
      existingCountryTags: inducteeById.get(candidate.inducteeId)?.countryTags ?? [],
      inferredCountryTags: countryInferences.records?.[candidate.inducteeId]?.inferredCountryTags ?? [],
      safeguardStatus: 'needs-geography-review',
      migrationDirection: 'not-inferred',
      reviewAction: 'geography-safeguard-review',
      publicUse: 'candidate-only',
    };
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    existing.evidenceCount += 1;
    existing.evidenceTypes = Array.from(new Set([...existing.evidenceTypes, candidate.evidenceType])).sort();
    existing.sourcePageUrls = Array.from(new Set([...existing.sourcePageUrls, candidate.sourcePageUrl])).sort();
    grouped.set(key, existing);
  }
  return Array.from(grouped.values()).sort((a, b) => b.confidence - a.confidence || compareByPerson(a, b));
}

function buildPlacePhraseReviewDrafts(candidates = []) {
  const grouped = new Map();
  for (const candidate of candidates) {
    if (!candidate.inducteeId || !candidate.placeLabel || candidate.evidenceType !== 'source-phrase') continue;
    const countryKeys = new Set([
      ...(inducteeById.get(candidate.inducteeId)?.countryTags ?? []),
      ...(countryInferences.records?.[candidate.inducteeId]?.inferredCountryTags ?? []),
    ].map(nameKey));
    if (isReviewablePlaceLead(candidate, countryKeys)) continue;
    const phraseLabel = cleanReviewLabel(candidate.placeLabel);
    const labelKey = nameKey(phraseLabel);
    if (!labelKey) continue;
    const key = `${candidate.inducteeId}:${labelKey}`;
    const existing = grouped.get(key) ?? {
      inducteeId: candidate.inducteeId,
      inducteeName: candidate.inducteeName,
      classYear: candidate.classYear,
      phraseLabel,
      phraseQuality: isNoisyPlacePhrase(labelKey) ? 'fragment-or-nonplace-likely' : 'needs-heavy-place-review',
      confidence: 0,
      evidenceCount: 0,
      sourcePageUrls: [],
      existingCountryTags: inducteeById.get(candidate.inducteeId)?.countryTags ?? [],
      inferredCountryTags: countryInferences.records?.[candidate.inducteeId]?.inferredCountryTags ?? [],
      safeguardStatus: 'needs-geography-review',
      migrationDirection: 'not-inferred',
      reviewAction: 'exploratory-place-phrase-review',
      publicUse: 'candidate-only',
    };
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    existing.evidenceCount += 1;
    existing.sourcePageUrls = Array.from(new Set([...existing.sourcePageUrls, candidate.sourcePageUrl])).sort();
    grouped.set(key, existing);
  }
  return Array.from(grouped.values()).sort((a, b) => b.evidenceCount - a.evidenceCount || compareByPerson(a, b));
}

function buildOrganizationReviewDrafts(candidates = []) {
  const grouped = new Map();
  for (const candidate of candidates) {
    if (!candidate.inducteeId || !candidate.organizationName) continue;
    const key = `${candidate.inducteeId}:${nameKey(candidate.organizationName)}`;
    const existing = grouped.get(key) ?? {
      inducteeId: candidate.inducteeId,
      inducteeName: candidate.inducteeName,
      classYear: candidate.classYear,
      organizationName: candidate.organizationName,
      confidence: 0,
      evidenceCount: 0,
      sourcePageUrls: [],
      reviewAction: 'organization-context-review',
      publicUse: 'candidate-only',
    };
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    existing.evidenceCount += 1;
    existing.sourcePageUrls = Array.from(new Set([...existing.sourcePageUrls, candidate.sourcePageUrl])).sort();
    grouped.set(key, existing);
  }
  return Array.from(grouped.values()).sort((a, b) => b.evidenceCount - a.evidenceCount || compareByPerson(a, b));
}

function buildStorySectionReviewDrafts(candidates = []) {
  const ranked = candidates
    .filter((candidate) => candidate.inducteeId)
    .map((candidate) => ({
      inducteeId: candidate.inducteeId,
      inducteeName: candidate.inducteeName,
      classYear: candidate.classYear,
      sourcePageUrl: candidate.sourcePageUrl,
      sourcePageTitle: candidate.sourcePageTitle,
      suggestedTheme: normalizeStoryTheme(candidate.suggestedTheme),
      blockIndex: candidate.blockIndex,
      wordCount: candidate.wordCount,
      excerpt: candidate.excerpt,
      candidateUse: 'staff-draft-only',
      copyrightNote: 'Rewrite from source before publication; do not publish this excerpt as final copy.',
      reviewAction: 'story-beat-rewrite-review',
    }))
    .sort((a, b) => compareByPerson(a, b) || storyThemeRank(a.suggestedTheme) - storyThemeRank(b.suggestedTheme) || b.wordCount - a.wordCount);

  const countsByPerson = new Map();
  return ranked.map((candidate) => {
    const count = countsByPerson.get(candidate.inducteeId) ?? 0;
    countsByPerson.set(candidate.inducteeId, count + 1);
    return {
      ...candidate,
      priority: count < 3 ? 'primary-story-lead' : 'secondary-story-lead',
    };
  });
}

function buildClassEvidenceReviewDrafts(candidates = []) {
  return candidates
    .map((candidate) => ({
      sourceKind: candidate.sourceKind,
      title: candidate.title,
      sourcePageUrl: candidate.sourcePageUrl,
      primaryClassYearCandidates: candidate.primaryClassYearCandidates ?? [],
      allClassYearCandidates: candidate.allClassYearCandidates ?? [],
      imageCount: candidate.imageCount,
      attachedMediaCount: candidate.attachedMediaCount,
      youtubeVideoIds: candidate.youtubeVideoIds ?? [],
      mentionedInducteeCount: candidate.mentionedInductees?.length ?? 0,
      confidence: candidate.confidence,
      reviewAction: candidate.confidence >= 0.78 ? 'review-as-class-source' : 'class-source-needs-review',
    }))
    .sort((a, b) => b.confidence - a.confidence || String(a.title).localeCompare(String(b.title)));
}

function buildUnresolvedSourceRecords(candidates = []) {
  return candidates.map((candidate) => ({
    wpId: candidate.wpId,
    sourceKind: candidate.sourceKind,
    sourceTitle: candidate.sourceTitle,
    sourceTitleName: candidate.sourceTitleName,
    sourceUrl: candidate.sourceUrl,
    sourceRegionCandidates: candidate.sourceRegionCandidates ?? [],
    sourceClassYearCandidates: candidate.sourcePrimaryClassYearCandidates ?? candidate.sourceClassYearCandidates ?? [],
    confidence: candidate.confidence,
    notes: candidate.notes ?? [],
    reviewAction: 'resolve-source-to-current-inductee-or-new-record',
  }));
}

function buildCurationIndex(packet) {
  const profilesById = groupBy(packet.sourceProfileReferences, (item) => item.inducteeId);
  const aliasesById = groupBy(packet.profileUrlAliasDrafts, (item) => item.inducteeId);
  const mediaById = groupBy(packet.mediaReviewDrafts, (item) => item.inducteeId);
  const videosById = groupBy(packet.videoReviewDrafts, (item) => item.inducteeId);
  const relationshipsById = groupRelationships(packet.relationshipReviewDrafts);
  const placesById = groupBy(packet.placeReviewDrafts, (item) => item.inducteeId);
  const organizationsById = groupBy(packet.organizationReviewDrafts, (item) => item.inducteeId);
  const storiesById = groupBy(packet.storySectionReviewDrafts, (item) => item.inducteeId);
  const duplicateIds = new Set((packet.duplicateSourceGroups ?? []).map((group) => group.inducteeId));

  return inductees
    .map((inductee) => {
      const profileSources = profilesById.get(inductee.id) ?? [];
      const aliases = aliasesById.get(inductee.id) ?? [];
      const media = mediaById.get(inductee.id) ?? [];
      const videos = videosById.get(inductee.id) ?? [];
      const relationships = relationshipsById.get(inductee.id) ?? [];
      const places = placesById.get(inductee.id) ?? [];
      const organizations = organizationsById.get(inductee.id) ?? [];
      const stories = storiesById.get(inductee.id) ?? [];
      const curatedRecord = curatedMetadata.inductees?.[inductee.id];
      const newProfileVideos = videos.filter((item) => !item.alreadyInMediaManifest && item.reviewAction === 'review-as-profile-video');
      const newContextVideos = videos.filter((item) => !item.alreadyInMediaManifest && item.reviewAction !== 'review-as-profile-video');
      const manualFlags = [];

      if (profileSources.length === 0) manualFlags.push('no-original-profile-match');
      if (aliases.length > 0) manualFlags.push('profile-alias-review');
      if (duplicateIds.has(inductee.id)) manualFlags.push('duplicate-source-pages');
      if (media.some((item) => !item.alreadyInMediaManifest)) manualFlags.push('image-rights-review');
      if (newProfileVideos.length > 0) manualFlags.push('video-rights-caption-review');
      if (newContextVideos.length > 0) manualFlags.push('video-context-review');
      if (relationships.length > 0) manualFlags.push('relationship-review');
      if (places.length > 0) manualFlags.push('geography-review');
      if (organizations.length > 0) manualFlags.push('organization-review');
      if (!curatedRecord?.approvedSummary) manualFlags.push('summary-approval-needed');

      return {
        inducteeId: inductee.id,
        inducteeName: inductee.name,
        classYear: inductee.classYear,
        region: inductee.region,
        sourceProfileCount: profileSources.length,
        primarySourceProfileUrl: profileSources[0]?.sourceUrl ?? '',
        profileAliasCount: aliases.length,
        newImageReviewCount: media.filter((item) => !item.alreadyInMediaManifest).length,
        existingImageSourceCount: media.filter((item) => item.alreadyInMediaManifest).length,
        newProfileVideoReviewCount: newProfileVideos.length,
        newContextVideoReviewCount: newContextVideos.length,
        existingVideoSourceCount: videos.filter((item) => item.alreadyInMediaManifest).length,
        relationshipReviewCount: relationships.length,
        placeReviewCount: places.length,
        organizationReviewCount: organizations.length,
        primaryStoryLeadCount: stories.filter((item) => item.priority === 'primary-story-lead').length,
        reviewPriority: prioritizeIndexRow({ aliases, media, videos, relationships, places, organizations, stories, manualFlags }),
        manualFlags,
        nextBestAction: nextBestAction(manualFlags),
      };
    })
    .sort((a, b) => priorityRank(a.reviewPriority) - priorityRank(b.reviewPriority) || (b.classYear ?? 0) - (a.classYear ?? 0) || a.inducteeName.localeCompare(b.inducteeName));
}

function buildSummary(packet) {
  return {
    inducteesInCurrentData: inductees.length,
    sourceProfiles: {
      resolved: packet.sourceProfileReferences.length,
      unresolved: packet.unresolvedSourceRecords.length,
      duplicateGroups: packet.duplicateSourceGroups.length,
    },
    profileUrlAliasDrafts: {
      total: packet.profileUrlAliasDrafts.length,
      safeReview: packet.profileUrlAliasDrafts.filter((item) => item.reviewAction === 'safe-profile-alias-review').length,
    },
    mediaReviewDrafts: {
      total: packet.mediaReviewDrafts.length,
      newSources: packet.mediaReviewDrafts.filter((item) => !item.alreadyInMediaManifest).length,
      alreadyInManifest: packet.mediaReviewDrafts.filter((item) => item.alreadyInMediaManifest).length,
      highConfidenceNewSources: packet.mediaReviewDrafts.filter((item) => !item.alreadyInMediaManifest && item.confidence >= 0.84).length,
    },
    videoReviewDrafts: {
      total: packet.videoReviewDrafts.length,
      newSources: packet.videoReviewDrafts.filter((item) => !item.alreadyInMediaManifest).length,
      alreadyInManifest: packet.videoReviewDrafts.filter((item) => item.alreadyInMediaManifest).length,
      newProfileEmbeds: packet.videoReviewDrafts.filter((item) => !item.alreadyInMediaManifest && item.reviewAction === 'review-as-profile-video').length,
    },
    relationshipReviewDrafts: {
      total: packet.relationshipReviewDrafts.length,
      resolvedInductionLinks: packet.relationshipReviewDrafts.filter((item) => item.reviewAction === 'review-as-documented-person-relationship').length,
      unresolvedPresenterLinks: packet.relationshipReviewDrafts.filter((item) => item.reviewAction === 'resolve-presenter-before-relationship').length,
      weakPairCandidates: packet.relationshipReviewDrafts.filter((item) => item.provenanceCandidate !== 'documented-source-candidate').length,
    },
    placeReviewDrafts: {
      total: packet.placeReviewDrafts.length,
      localPlaceHints: packet.placeReviewDrafts.filter((item) => item.placeScopeHint === 'cleveland-or-northeast-ohio').length,
      nonDirectional: packet.placeReviewDrafts.filter((item) => item.migrationDirection === 'not-inferred').length,
    },
    placePhraseReviewDrafts: {
      total: packet.placePhraseReviewDrafts.length,
      likelyFragments: packet.placePhraseReviewDrafts.filter((item) => item.phraseQuality === 'fragment-or-nonplace-likely').length,
    },
    organizationReviewDrafts: {
      total: packet.organizationReviewDrafts.length,
    },
    storySectionReviewDrafts: {
      total: packet.storySectionReviewDrafts.length,
      primaryLeads: packet.storySectionReviewDrafts.filter((item) => item.priority === 'primary-story-lead').length,
    },
    classEvidenceReviewDrafts: {
      total: packet.classEvidenceReviewDrafts.length,
      likelyClassSources: packet.classEvidenceReviewDrafts.filter((item) => item.reviewAction === 'review-as-class-source').length,
    },
  };
}

function writeReviewCsvs(packet) {
  writeCsv(resolve(outputDir, '00-curation-index.csv'), packet.curationIndex, [
    'reviewPriority',
    'inducteeId',
    'inducteeName',
    'classYear',
    'region',
    'sourceProfileCount',
    'primarySourceProfileUrl',
    'profileAliasCount',
    'newImageReviewCount',
    'newProfileVideoReviewCount',
    'newContextVideoReviewCount',
    'relationshipReviewCount',
    'placeReviewCount',
    'organizationReviewCount',
    'primaryStoryLeadCount',
    'manualFlags',
    'nextBestAction',
  ]);
  writeCsv(resolve(outputDir, 'profile-url-aliases-draft.csv'), packet.profileUrlAliasDrafts, [
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'currentProfileUrl',
    'alternateSourceUrl',
    'sourceTitle',
    'matchType',
    'confidence',
    'publishStatus',
  ]);
  writeCsv(resolve(outputDir, 'media-source-review.csv'), packet.mediaReviewDrafts, [
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'roleCandidate',
    'confidence',
    'alreadyInMediaManifest',
    'rightsStatus',
    'sourceUrl',
    'sourcePageUrl',
    'width',
    'height',
    'altText',
    'caption',
  ]);
  writeCsv(resolve(outputDir, 'video-source-review.csv'), packet.videoReviewDrafts, [
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'youtubeVideoId',
    'sourceUrl',
    'assignment',
    'confidence',
    'alreadyInMediaManifest',
    'rightsStatus',
    'sourcePageUrl',
  ]);
  writeCsv(resolve(outputDir, 'relationship-review.csv'), packet.relationshipReviewDrafts, [
    'reviewAction',
    'sourcePersonId',
    'sourcePersonName',
    'targetEntityType',
    'targetEntityId',
    'targetDisplayName',
    'type',
    'displayLabel',
    'provenanceCandidate',
    'confidence',
    'evidenceCount',
    'evidenceTypes',
    'sourcePageUrls',
    'referenceNote',
    'publicUse',
  ]);
  writeCsv(resolve(outputDir, 'place-review.csv'), packet.placeReviewDrafts, [
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'placeLabel',
    'placeScopeHint',
    'confidence',
    'evidenceCount',
    'evidenceTypes',
    'sourcePageUrls',
    'existingCountryTags',
    'inferredCountryTags',
    'safeguardStatus',
    'migrationDirection',
    'publicUse',
  ]);
  writeCsv(resolve(outputDir, 'place-phrase-review.csv'), packet.placePhraseReviewDrafts, [
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'phraseLabel',
    'phraseQuality',
    'confidence',
    'evidenceCount',
    'sourcePageUrls',
    'existingCountryTags',
    'inferredCountryTags',
    'safeguardStatus',
    'migrationDirection',
    'publicUse',
  ]);
  writeCsv(resolve(outputDir, 'organization-review.csv'), packet.organizationReviewDrafts, [
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'organizationName',
    'confidence',
    'evidenceCount',
    'sourcePageUrls',
    'publicUse',
  ]);
  writeCsv(resolve(outputDir, 'story-section-review.csv'), packet.storySectionReviewDrafts, [
    'priority',
    'reviewAction',
    'inducteeId',
    'inducteeName',
    'classYear',
    'suggestedTheme',
    'wordCount',
    'sourcePageUrl',
    'excerpt',
    'candidateUse',
    'copyrightNote',
  ]);
  writeCsv(resolve(outputDir, 'class-evidence-review.csv'), packet.classEvidenceReviewDrafts, [
    'reviewAction',
    'sourceKind',
    'title',
    'sourcePageUrl',
    'primaryClassYearCandidates',
    'allClassYearCandidates',
    'imageCount',
    'attachedMediaCount',
    'youtubeVideoIds',
    'mentionedInducteeCount',
    'confidence',
  ]);
  writeCsv(resolve(outputDir, 'unresolved-source-records.csv'), packet.unresolvedSourceRecords, [
    'reviewAction',
    'wpId',
    'sourceKind',
    'sourceTitle',
    'sourceTitleName',
    'sourceUrl',
    'sourceRegionCandidates',
    'sourceClassYearCandidates',
    'confidence',
    'notes',
  ]);
}

function writeReadme(packet) {
  const readme = [
    '# CIHOF Original Site Pre-Curation Packet',
    '',
    `Generated: ${packet.source.generatedAt}`,
    '',
    'This folder contains deterministic review aids derived from the original CIHOF site harvest. It does not change the public exhibit data.',
    '',
    'Recommended review order:',
    '',
    '1. `00-curation-index.csv` - per-inductee triage and next best action.',
    '2. `profile-url-aliases-draft.csv` - low-risk URL aliases and duplicate profile sources.',
    '3. `video-source-review.csv` and `media-source-review.csv` - rights, captions, transcripts, and media approval review.',
    '4. `relationship-review.csv` - documented or weak connection candidates that need curator labels.',
    '5. `place-review.csv` - geography leads with migration direction deliberately left as `not-inferred`.',
    '6. `place-phrase-review.csv` - exploratory source phrases kept out of the main geography queue.',
    '7. `story-section-review.csv` - short source pointers for curator rewriting.',
    '',
    'Key counts:',
    '',
    `- ${packet.summary.sourceProfiles.resolved} resolved source profiles; ${packet.summary.sourceProfiles.unresolved} unresolved source profiles.`,
    `- ${packet.summary.profileUrlAliasDrafts.safeReview} profile aliases ready for low-risk review.`,
    `- ${packet.summary.mediaReviewDrafts.highConfidenceNewSources} high-confidence new image sources requiring rights review.`,
    `- ${packet.summary.videoReviewDrafts.newProfileEmbeds} new profile-page video embeds requiring rights/caption/transcript review.`,
    `- ${packet.summary.relationshipReviewDrafts.resolvedInductionLinks} resolved inducted-by relationship candidates.`,
    `- ${packet.summary.placeReviewDrafts.total} place leads, all with migration direction set to not-inferred.`,
    `- ${packet.summary.placePhraseReviewDrafts.total} exploratory place phrases kept separate for manual-only review.`,
    '',
  ].join('\n');
  writeFileSync(resolve(outputDir, 'README.md'), `${readme}\n`);
}

function buildCurrentMediaIndex(manifest, records) {
  const imageUrlsByPerson = new Map();
  const youtubeIdsByPerson = new Map();

  for (const inductee of records) {
    const imageUrls = new Set([inductee.primaryImageUrl, ...inductee.imageUrls].filter(Boolean).map(normalizeUrl));
    const youtubeIds = new Set(inductee.youtubeVideoIds ?? []);
    const asset = manifest.assets?.[inductee.id];
    if (asset?.images?.primary?.sourceUrl) imageUrls.add(normalizeUrl(asset.images.primary.sourceUrl));
    for (const image of asset?.images?.gallery ?? []) {
      if (image.sourceUrl) imageUrls.add(normalizeUrl(image.sourceUrl));
    }
    for (const video of asset?.videos ?? []) {
      if (video.youtubeVideoId) youtubeIds.add(video.youtubeVideoId);
    }
    imageUrlsByPerson.set(inductee.id, imageUrls);
    youtubeIdsByPerson.set(inductee.id, youtubeIds);
  }

  return { imageUrlsByPerson, youtubeIdsByPerson };
}

function groupRelationships(records) {
  const groups = new Map();
  records.forEach((record) => {
    addGrouped(groups, record.sourcePersonId, record);
    if (record.targetEntityType === 'person') addGrouped(groups, record.targetEntityId, record);
  });
  return groups;
}

function prioritizeIndexRow({ aliases, media, videos, relationships, places, organizations, stories, manualFlags }) {
  if (manualFlags.includes('no-original-profile-match')) return 'high';
  if (videos.some((item) => !item.alreadyInMediaManifest && item.reviewAction === 'review-as-profile-video') || media.some((item) => !item.alreadyInMediaManifest && item.confidence >= 0.84)) return 'high';
  if (relationships.some((item) => item.reviewAction === 'review-as-documented-person-relationship') || aliases.length > 0) return 'medium';
  if (places.length > 0 || organizations.length > 0 || stories.length > 0) return 'standard';
  return 'low';
}

function nextBestAction(flags) {
  const order = [
    ['no-original-profile-match', 'Resolve unmatched original-site profile.'],
    ['video-rights-caption-review', 'Review new video leads for rights, captions, and transcripts.'],
    ['image-rights-review', 'Review new image leads for rights and portrait suitability.'],
    ['profile-alias-review', 'Confirm alternate source profile URLs.'],
    ['duplicate-source-pages', 'Confirm duplicate profile/source pages.'],
    ['relationship-review', 'Review relationship evidence and labels.'],
    ['geography-review', 'Review place evidence with geography safeguards.'],
    ['organization-review', 'Review organization mentions.'],
    ['video-context-review', 'Review context-only ceremony video leads before assigning to a person.'],
    ['summary-approval-needed', 'Rewrite and approve concise summary/context.'],
  ];
  const hit = order.find(([flag]) => flags.includes(flag));
  return hit?.[1] ?? 'No source-derived action queued.';
}

function priorityRank(value) {
  return { high: 0, medium: 1, standard: 2, low: 3 }[value] ?? 4;
}

function normalizeStoryTheme(value) {
  const theme = String(value ?? '').trim();
  const map = {
    'early-life': 'early_life',
    'life-work': 'work',
    'community-service': 'building_community',
    recognition: 'legacy',
    'biographical-context': 'context',
  };
  return map[theme] ?? (theme.replace(/-/g, '_') || 'context');
}

function storyThemeRank(theme) {
  const rank = {
    early_life: 0,
    education: 1,
    work: 2,
    leadership: 3,
    building_community: 4,
    legacy: 5,
    context: 6,
  };
  return rank[theme] ?? 7;
}

function classifyPlaceScope(value) {
  const normalized = nameKey(value);
  if (/\b(cleveland|cuyahoga|ohio|akron|lakewood|parma|euclid|lorain)\b/.test(normalized)) return 'cleveland-or-northeast-ohio';
  if (/\b(united states|usa|u s)\b/.test(normalized)) return 'united-states';
  if (/\b(asia|africa|europe|south america|middle east)\b/.test(normalized)) return 'region-label';
  return 'needs-review';
}

function isReviewablePlaceLead(candidate, countryKeys) {
  const labelKey = nameKey(candidate.placeLabel);
  const personKey = nameKey(candidate.inducteeName);
  const placeScope = classifyPlaceScope(candidate.placeLabel);
  const genericTagKeys = new Set(['inductee', 'inductees', 'event', 'events', 'news', 'photo gallery']);
  const communityAdjectiveKeys = new Set([
    'arab',
    'arabic',
    'armenian',
    'chinese',
    'croatian',
    'czech',
    'estonian',
    'ethiopian',
    'german',
    'greek',
    'hungarian',
    'indian',
    'irish',
    'italian',
    'jewish',
    'korean',
    'lebanese',
    'lithuanian',
    'mexican',
    'polish',
    'puerto rican',
    'romanian',
    'russian',
    'serbian',
    'slovak',
    'slovenian',
    'syrian',
    'turkish',
    'ukrainian',
    'vietnamese',
  ]);

  if (!labelKey || genericTagKeys.has(labelKey)) return false;
  if (labelKey === personKey) return false;
  if (communityAdjectiveKeys.has(labelKey) && !countryKeys.has(labelKey)) return false;
  if (placeScope === 'region-label') return false;
  if (countryKeys.has(labelKey)) return true;
  if (candidate.evidenceType === 'source-phrase') {
    if (isNoisyPlacePhrase(labelKey)) return false;
    if (placeScope !== 'needs-review') return true;
    return /\b(garden|gardens|city|county|state|republic|kingdom|island|province|village|town|street|avenue|neighborhood)\b/.test(labelKey);
  }
  if (placeScope !== 'needs-review') return true;

  return /\b(city|county|state|republic|kingdom|island|province|village|town|garden|gardens|street|avenue|neighborhood)\b/.test(labelKey);
}

function isNoisyPlacePhrase(labelKey) {
  const words = labelKey.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  if (words.length > 4) return true;
  if (/\bto\b/.test(labelKey)) return true;
  if (/\b(in|on|for|from|gave|his|her|own|then|where|their|the|he|she|wrote|noon|till|have|given|lectures|representative|watching|through|along|dr)\b/.test(labelKey)) return true;
  if (/\b(president|church|school|college|university|medical|medtronics|osu|high)\b/.test(labelKey)) return true;
  return false;
}

function compareByPerson(a, b) {
  return (a.classYear ?? 9999) - (b.classYear ?? 9999) || String(a.inducteeName ?? a.sourcePersonName ?? '').localeCompare(String(b.inducteeName ?? b.sourcePersonName ?? ''));
}

function groupBy(values, keyFn) {
  const groups = new Map();
  values.forEach((value) => addGrouped(groups, keyFn(value), value));
  return groups;
}

function addGrouped(groups, key, value) {
  if (!key) return;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(value);
}

function nameKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return nameKey(value).replace(/\s+/g, '-');
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function trimForReview(value, maxWords) {
  const words = String(value ?? '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function cleanReviewLabel(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
}

function writeCsv(path, rows, fields) {
  const lines = [
    fields.join(','),
    ...rows.map((row) => fields.map((field) => csvCell(formatCell(row[field]))).join(',')),
  ];
  writeFileSync(path, `${lines.join('\n')}\n`);
}

function formatCell(value) {
  if (Array.isArray(value)) return value.join('|');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? '';
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
