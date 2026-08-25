import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadInductees } from './data-utils.js';

const rawHarvestPath = resolve('data/original-site-harvest/cihof-original-site.raw.json');
const outputPath = resolve('data/original-site-harvest/cihof-source-candidates.json');
const queueDir = resolve('data/original-site-harvest/review-queues');

if (!existsSync(rawHarvestPath)) {
  throw new Error(`Missing raw source harvest. Run npm run source:harvest first: ${rawHarvestPath}`);
}

const generatedAt = new Date().toISOString();
const rawHarvest = JSON.parse(readFileSync(rawHarvestPath, 'utf8'));
const inductees = loadInductees();
const inducteeIndexes = buildInducteeIndexes(inductees);
const profileRecords = rawHarvest.records.filter((record) => ['inductee-profile', 'probable-inductee-profile'].includes(record.sourceKind));
const contentByWpId = new Map(rawHarvest.records.map((record) => [record.wpId, record]));

const profileMatches = resolveProfileMatches(profileRecords);
const profileMatchByWpId = new Map(profileMatches.filter((match) => match.inducteeId).map((match) => [match.wpId, match]));
const groupedProfileMatches = groupBy(profileMatches.filter((match) => match.inducteeId), (match) => match.inducteeId);

const candidates = {
  schemaVersion: 1,
  source: {
    name: 'CIHOF original site deterministic source candidates',
    generatedAt,
    rawHarvestPath: 'data/original-site-harvest/cihof-original-site.raw.json',
    note: 'Derived candidates for review. These are not curator-approved runtime facts.',
  },
  summary: {},
  profileMatches,
  profileAliasCandidates: buildProfileAliasCandidates(groupedProfileMatches),
  unresolvedProfileCandidates: profileMatches.filter((match) => !match.inducteeId),
  duplicateSourceGroups: buildDuplicateSourceGroups(groupedProfileMatches),
  mediaCandidates: buildMediaCandidates(profileMatches, contentByWpId),
  videoCandidates: buildVideoCandidates(rawHarvest.records, profileMatchByWpId),
  inductionRelationshipCandidates: buildInductionRelationshipCandidates(profileMatches, profileMatchByWpId),
  relationshipCandidates: buildRelationshipCandidates(rawHarvest.records, profileMatchByWpId),
  placeCandidates: buildPlaceCandidates(profileMatches),
  organizationCandidates: buildOrganizationCandidates(profileMatches),
  storyBeatCandidates: buildStoryBeatCandidates(profileMatches),
  classEvidenceCandidates: buildClassEvidenceCandidates(rawHarvest.records),
};

candidates.summary = buildSummary(candidates);

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(queueDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(candidates, null, 2)}\n`);
writeReviewQueues(candidates);

console.log(`Generated ${candidates.profileMatches.length} profile match candidates.`);
console.log(`Generated ${candidates.mediaCandidates.length} media candidates and ${candidates.videoCandidates.length} video candidates.`);
console.log(`Generated ${candidates.inductionRelationshipCandidates.length} induction relationship candidates.`);
console.log(`Generated ${candidates.relationshipCandidates.length} relationship candidates.`);
console.log(`Generated ${candidates.placeCandidates.length} place candidates and ${candidates.organizationCandidates.length} organization candidates.`);
console.log(`Generated ${candidates.storyBeatCandidates.length} story beat candidates.`);
console.log(`Wrote ${outputPath}`);
console.log(`Wrote review queues to ${queueDir}`);

function buildInducteeIndexes(records) {
  const byId = new Map();
  const byProfileUrl = new Map();
  const byNameKey = new Map();
  const byLooseNameKey = new Map();
  records.forEach((inductee) => {
    byId.set(inductee.id, inductee);
    if (inductee.profileUrl) byProfileUrl.set(normalizeUrl(inductee.profileUrl), inductee);
    addToIndex(byNameKey, nameKey(inductee.name), inductee);
    nameKeyVariants(inductee.name).forEach((key) => addToIndex(byLooseNameKey, key, inductee));
  });
  return { byId, byProfileUrl, byNameKey, byLooseNameKey };
}

function resolveProfileMatches(records) {
  return records
    .map((record) => {
      const match = resolveProfileMatch(record);
      const classYear = match?.inductee.classYear ?? preferredClassYear(record);
      return {
        wpId: record.wpId,
        sourceKind: record.sourceKind,
        sourceTitle: record.title,
        sourceTitleName: record.titleName,
        sourceUrl: record.link,
        canonicalUrl: record.canonicalUrl,
        sourceModified: record.modified,
        sourceRegionCandidates: record.regionCandidates,
        sourcePrimaryClassYearCandidates: record.primaryClassYearCandidates ?? [],
        sourceClassYearCandidates: record.classYearCandidates,
        matchType: match?.matchType ?? 'unresolved',
        confidence: match?.confidence ?? 0,
        inducteeId: match?.inductee.id ?? null,
        inducteeName: match?.inductee.name ?? null,
        classYear: classYear ?? null,
        currentProfileUrl: match?.inductee.profileUrl ?? '',
        notes: match?.notes ?? unresolvedNotes(record),
      };
    })
    .sort((a, b) => (a.inducteeName ?? a.sourceTitle).localeCompare(b.inducteeName ?? b.sourceTitle) || b.confidence - a.confidence);
}

function resolveProfileMatch(record) {
  const urlMatch = inducteeIndexes.byProfileUrl.get(normalizeUrl(record.link));
  if (urlMatch) return { inductee: urlMatch, matchType: 'profile-url', confidence: 1, notes: ['Exact normalized profile URL match.'] };

  const manifestUrlMatch = record.manifestMatch?.profileUrl ? inducteeIndexes.byProfileUrl.get(normalizeUrl(record.manifestMatch.profileUrl)) : null;
  if (manifestUrlMatch) return { inductee: manifestUrlMatch, matchType: 'harvest-manifest-profile-url', confidence: 0.98, notes: ['Harvest matched the current manifest profile URL.'] };

  const exactNameMatches = inducteeIndexes.byNameKey.get(nameKey(record.titleName)) ?? [];
  const exactClassMatch = pickClassCompatibleMatch(exactNameMatches, record);
  if (exactClassMatch) return { inductee: exactClassMatch, matchType: 'exact-name-class-compatible', confidence: 0.95, notes: ['Normalized title name and class year are compatible.'] };
  if (exactNameMatches.length === 1) return { inductee: exactNameMatches[0], matchType: 'exact-name', confidence: 0.9, notes: ['Normalized title name matched one inductee.'] };

  for (const key of nameKeyVariants(record.titleName)) {
    const looseMatches = inducteeIndexes.byLooseNameKey.get(key) ?? [];
    const looseClassMatch = pickClassCompatibleMatch(looseMatches, record);
    if (looseClassMatch) return { inductee: looseClassMatch, matchType: 'loose-name-class-compatible', confidence: 0.86, notes: ['Honorific-insensitive title name and class year are compatible.'] };
    if (looseMatches.length === 1) return { inductee: looseMatches[0], matchType: 'loose-name', confidence: 0.78, notes: ['Honorific-insensitive title name matched one inductee.'] };
  }

  return null;
}

function buildProfileAliasCandidates(groupedMatches) {
  return Array.from(groupedMatches.entries()).flatMap(([inducteeId, matches]) => {
    const inductee = inducteeIndexes.byId.get(inducteeId);
    return matches
      .filter((match) => normalizeUrl(match.sourceUrl) !== normalizeUrl(inductee.profileUrl))
      .map((match) => ({
        inducteeId,
        inducteeName: inductee.name,
        classYear: inductee.classYear,
        currentProfileUrl: inductee.profileUrl,
        alternateSourceUrl: match.sourceUrl,
        sourceTitle: match.sourceTitle,
        matchType: match.matchType,
        confidence: match.confidence,
        action: match.confidence >= 0.86 ? 'review-as-profile-alias' : 'review-before-alias',
      }));
  });
}

function buildDuplicateSourceGroups(groupedMatches) {
  return Array.from(groupedMatches.entries())
    .filter(([, matches]) => matches.length > 1)
    .map(([inducteeId, matches]) => {
      const inductee = inducteeIndexes.byId.get(inducteeId);
      return {
        inducteeId,
        inducteeName: inductee.name,
        classYear: inductee.classYear,
        sources: matches.map((match) => ({
          wpId: match.wpId,
          sourceUrl: match.sourceUrl,
          sourceTitle: match.sourceTitle,
          matchType: match.matchType,
          confidence: match.confidence,
        })),
      };
    });
}

function buildMediaCandidates(matches) {
  const candidates = [];
  const seen = new Set();
  for (const match of matches) {
    if (!match.inducteeId) continue;
    const record = contentByWpId.get(match.wpId);
    if (!record) continue;

    const imageSources = [
      ...record.images.map((image, index) => ({
        sourceUrl: bestImageUrl(image),
        altText: image.alt,
        caption: '',
        width: image.width,
        height: image.height,
        origin: 'inline-image',
        order: index,
      })),
      ...record.attachedMedia
        .filter((media) => media.mediaType === 'image')
        .map((media, index) => ({
          sourceUrl: media.sourceUrl,
          altText: media.altText,
          caption: media.caption || media.description,
          width: media.width,
          height: media.height,
          origin: 'attached-media',
          order: index,
        })),
    ].filter((image) => image.sourceUrl);

    for (const image of imageSources) {
      const key = `${match.inducteeId}:${normalizeUrl(image.sourceUrl)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const role = classifyImageRole(image, match, record);
      candidates.push({
        inducteeId: match.inducteeId,
        inducteeName: match.inducteeName,
        classYear: match.classYear,
        mediaType: 'image',
        roleCandidate: role.role,
        confidence: role.confidence,
        sourceUrl: image.sourceUrl,
        sourcePageUrl: record.link,
        sourcePageTitle: record.title,
        sourceOrigin: image.origin,
        width: image.width,
        height: image.height,
        altText: image.altText,
        caption: image.caption,
        needsRightsReview: true,
        notes: role.notes,
      });
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.inducteeName.localeCompare(b.inducteeName));
}

function buildVideoCandidates(records, profileMatchByWpId) {
  const candidates = [];
  const seen = new Set();
  for (const record of records) {
    if (!Array.isArray(record.youtubeVideoIds) || record.youtubeVideoIds.length === 0) continue;
    const match = profileMatchByWpId.get(record.wpId);
    const mentionedPeople = record.candidateSignals.mentionedManifestPeople
      .map((person) => resolveMentionedPerson(person))
      .filter(Boolean);

    for (const youtubeVideoId of record.youtubeVideoIds) {
      if (match?.inducteeId) {
        const key = `${match.inducteeId}:${youtubeVideoId}:profile`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push({
            inducteeId: match.inducteeId,
            inducteeName: match.inducteeName,
            classYear: match.classYear,
            youtubeVideoId,
            sourcePageUrl: record.link,
            sourcePageTitle: record.title,
            assignment: 'profile-page-embed',
            confidence: record.youtubeVideoIds.length === 1 ? 0.88 : 0.72,
            alreadyPresent: inducteeHasYoutube(match.inducteeId, youtubeVideoId),
            needsRightsReview: true,
          });
        }
      }

      if (['class-or-ceremony-page', 'photo-gallery', 'news-or-event-post'].includes(record.sourceKind)) {
        for (const person of mentionedPeople) {
          const key = `${person.id}:${youtubeVideoId}:ceremony:${record.wpId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({
            inducteeId: person.id,
            inducteeName: person.name,
            classYear: person.classYear,
            youtubeVideoId,
            sourcePageUrl: record.link,
            sourcePageTitle: record.title,
            assignment: 'class-or-ceremony-page-mention',
            confidence: record.youtubeVideoIds.length === 1 ? 0.48 : 0.32,
            alreadyPresent: inducteeHasYoutube(person.id, youtubeVideoId),
            needsRightsReview: true,
          });
        }
      }
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.inducteeName.localeCompare(b.inducteeName));
}

function buildInductionRelationshipCandidates(matches, profileMatchByWpId) {
  return matches.flatMap((match) => {
    if (!match.inducteeId) return [];
    const record = contentByWpId.get(match.wpId);
    if (!record) return [];
    return record.candidateSignals.inductedBy.map((presenter) => {
      const resolvedPresenter = resolveNameCandidate(presenter);
      return {
        fromInducteeId: match.inducteeId,
        fromName: match.inducteeName,
        relationshipType: 'inducted_by',
        targetName: presenter,
        targetInducteeId: resolvedPresenter?.id ?? null,
        targetInducteeName: resolvedPresenter?.name ?? null,
        confidence: resolvedPresenter ? 0.78 : 0.62,
        evidence: presenter,
        sourcePageUrl: record.link,
        sourcePageTitle: record.title,
        needsReview: true,
        publicUse: 'candidate-only',
      };
    });
  });
}

function buildRelationshipCandidates(records, profileMatchByWpId) {
  const candidates = [];
  const seen = new Set();
  for (const record of records) {
    const sourceMatch = profileMatchByWpId.get(record.wpId);
    const mentioned = record.candidateSignals.mentionedManifestPeople.map(resolveMentionedPerson).filter(Boolean);

    if (sourceMatch?.inducteeId && ['inductee-profile', 'probable-inductee-profile'].includes(record.sourceKind)) {
      for (const person of mentioned) {
        if (person.id === sourceMatch.inducteeId) continue;
        const key = pairKey(sourceMatch.inducteeId, person.id, record.wpId, 'profile-name-mention');
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          personAId: sourceMatch.inducteeId,
          personAName: sourceMatch.inducteeName,
          personBId: person.id,
          personBName: person.name,
          evidenceType: 'profile-name-mention',
          confidence: 0.54,
          sourcePageUrl: record.link,
          sourcePageTitle: record.title,
          needsReview: true,
          publicUse: 'candidate-only',
        });
      }
    }

    if (['class-or-ceremony-page', 'news-or-event-post'].includes(record.sourceKind) && mentioned.length >= 2 && mentioned.length <= 16) {
      for (let index = 0; index < mentioned.length; index += 1) {
        for (let nextIndex = index + 1; nextIndex < mentioned.length; nextIndex += 1) {
          const a = mentioned[index];
          const b = mentioned[nextIndex];
          const key = pairKey(a.id, b.id, record.wpId, 'shared-source-page');
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({
            personAId: a.id,
            personAName: a.name,
            personBId: b.id,
            personBName: b.name,
            evidenceType: 'shared-source-page',
            confidence: 0.34,
            sourcePageUrl: record.link,
            sourcePageTitle: record.title,
            needsReview: true,
            publicUse: 'candidate-only',
          });
        }
      }
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.personAName.localeCompare(b.personAName));
}

function buildPlaceCandidates(matches) {
  const candidates = [];
  const seen = new Set();
  for (const match of matches) {
    if (!match.inducteeId) continue;
    const record = contentByWpId.get(match.wpId);
    if (!record) continue;
    const tagPlaces = record.tags
      .filter((tag) => isLikelyPlaceTag(tag.name))
      .map((tag) => ({ label: tag.name, evidenceType: 'wordpress-tag', confidence: 0.62 }));
    const phrasePlaces = record.candidateSignals.placePhrases.map((label) => ({ label, evidenceType: 'source-phrase', confidence: 0.38 }));

    for (const place of [...tagPlaces, ...phrasePlaces]) {
      const key = `${match.inducteeId}:${place.evidenceType}:${nameKey(place.label)}:${record.wpId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        inducteeId: match.inducteeId,
        inducteeName: match.inducteeName,
        classYear: match.classYear,
        placeLabel: place.label,
        evidenceType: place.evidenceType,
        confidence: place.confidence,
        sourcePageUrl: record.link,
        sourcePageTitle: record.title,
        safeguardStatus: 'needs-geography-review',
        migrationDirection: 'not-inferred',
        publicUse: 'candidate-only',
      });
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.inducteeName.localeCompare(b.inducteeName));
}

function buildOrganizationCandidates(matches) {
  const candidates = [];
  const seen = new Set();
  for (const match of matches) {
    if (!match.inducteeId) continue;
    const record = contentByWpId.get(match.wpId);
    if (!record) continue;
    for (const organizationName of record.candidateSignals.organizationPhrases) {
      const key = `${match.inducteeId}:${nameKey(organizationName)}:${record.wpId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        inducteeId: match.inducteeId,
        inducteeName: match.inducteeName,
        classYear: match.classYear,
        organizationName,
        confidence: 0.48,
        sourcePageUrl: record.link,
        sourcePageTitle: record.title,
        needsReview: true,
        publicUse: 'candidate-only',
      });
    }
  }
  return candidates.sort((a, b) => a.inducteeName.localeCompare(b.inducteeName) || a.organizationName.localeCompare(b.organizationName));
}

function buildStoryBeatCandidates(matches) {
  const candidates = [];
  for (const match of matches) {
    if (!match.inducteeId) continue;
    const record = contentByWpId.get(match.wpId);
    if (!record) continue;
    record.blocks
      .filter((block) => block.kind === 'paragraph' && block.wordCount >= 30)
      .slice(0, 8)
      .forEach((block, index) => {
        candidates.push({
          inducteeId: match.inducteeId,
          inducteeName: match.inducteeName,
          classYear: match.classYear,
          sourcePageUrl: record.link,
          sourcePageTitle: record.title,
          blockIndex: index,
          suggestedTheme: classifyStoryBlock(block.text),
          wordCount: block.wordCount,
          excerpt: excerpt(block.text, 18),
          candidateUse: 'staff-draft-only',
          copyrightNote: 'Use as a source excerpt for curator rewriting; do not publish long copied source text automatically.',
        });
      });
  }
  return candidates;
}

function buildClassEvidenceCandidates(records) {
  return records
    .filter((record) => ['class-or-ceremony-page', 'photo-gallery', 'news-or-event-post'].includes(record.sourceKind))
    .map((record) => ({
      wpId: record.wpId,
      sourceKind: record.sourceKind,
      title: record.title,
      sourcePageUrl: record.link,
      primaryClassYearCandidates: record.primaryClassYearCandidates ?? [],
      allClassYearCandidates: record.classYearCandidates,
      imageCount: record.images.length,
      attachedMediaCount: record.attachedMedia.length,
      youtubeVideoIds: record.youtubeVideoIds,
      mentionedInductees: record.candidateSignals.mentionedManifestPeople.map((person) => person.name),
      confidence: record.primaryClassYearCandidates?.length === 1 ? 0.78 : 0.44,
      needsReview: true,
    }));
}

function buildSummary(document) {
  return {
    profileMatches: document.profileMatches.length,
    resolvedProfileMatches: document.profileMatches.filter((candidate) => candidate.inducteeId).length,
    unresolvedProfileCandidates: document.unresolvedProfileCandidates.length,
    profileAliasCandidates: document.profileAliasCandidates.length,
    duplicateSourceGroups: document.duplicateSourceGroups.length,
    mediaCandidates: document.mediaCandidates.length,
    highConfidenceMediaCandidates: document.mediaCandidates.filter((candidate) => candidate.confidence >= 0.78).length,
    videoCandidates: document.videoCandidates.length,
    profileVideoCandidates: document.videoCandidates.filter((candidate) => candidate.assignment === 'profile-page-embed').length,
    newVideoCandidates: document.videoCandidates.filter((candidate) => !candidate.alreadyPresent).length,
    inductionRelationshipCandidates: document.inductionRelationshipCandidates.length,
    relationshipCandidates: document.relationshipCandidates.length,
    placeCandidates: document.placeCandidates.length,
    organizationCandidates: document.organizationCandidates.length,
    storyBeatCandidates: document.storyBeatCandidates.length,
    classEvidenceCandidates: document.classEvidenceCandidates.length,
    automaticImportSafe: {
      profileAliases: document.profileAliasCandidates.filter((candidate) => candidate.confidence >= 0.95).length,
      videosAlreadyOnProfilePages: document.videoCandidates.filter((candidate) => candidate.assignment === 'profile-page-embed' && candidate.confidence >= 0.88).length,
      note: 'Even high-confidence candidates should be routed through existing media/curation approval before public use.',
    },
  };
}

function writeReviewQueues(document) {
  writeCsv(resolve(queueDir, 'profile-matches.csv'), document.profileMatches, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'sourceTitle',
    'sourceUrl',
    'matchType',
    'confidence',
    'currentProfileUrl',
  ]);
  writeCsv(resolve(queueDir, 'profile-aliases.csv'), document.profileAliasCandidates, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'alternateSourceUrl',
    'sourceTitle',
    'matchType',
    'confidence',
    'action',
  ]);
  writeCsv(resolve(queueDir, 'media-candidates.csv'), document.mediaCandidates, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'roleCandidate',
    'confidence',
    'sourceUrl',
    'sourcePageUrl',
    'width',
    'height',
    'altText',
    'needsRightsReview',
  ]);
  writeCsv(resolve(queueDir, 'video-candidates.csv'), document.videoCandidates, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'youtubeVideoId',
    'assignment',
    'confidence',
    'alreadyPresent',
    'sourcePageUrl',
    'needsRightsReview',
  ]);
  writeCsv(resolve(queueDir, 'induction-relationship-candidates.csv'), document.inductionRelationshipCandidates, [
    'fromInducteeId',
    'fromName',
    'relationshipType',
    'targetName',
    'targetInducteeId',
    'targetInducteeName',
    'confidence',
    'sourcePageUrl',
    'needsReview',
  ]);
  writeCsv(resolve(queueDir, 'relationship-candidates.csv'), document.relationshipCandidates, [
    'personAId',
    'personAName',
    'personBId',
    'personBName',
    'evidenceType',
    'confidence',
    'sourcePageUrl',
    'needsReview',
  ]);
  writeCsv(resolve(queueDir, 'place-candidates.csv'), document.placeCandidates, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'placeLabel',
    'evidenceType',
    'confidence',
    'sourcePageUrl',
    'safeguardStatus',
    'migrationDirection',
  ]);
  writeCsv(resolve(queueDir, 'organization-candidates.csv'), document.organizationCandidates, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'organizationName',
    'confidence',
    'sourcePageUrl',
    'needsReview',
  ]);
  writeCsv(resolve(queueDir, 'story-beat-candidates.csv'), document.storyBeatCandidates, [
    'inducteeId',
    'inducteeName',
    'classYear',
    'suggestedTheme',
    'wordCount',
    'sourcePageUrl',
    'excerpt',
    'candidateUse',
  ]);
  writeCsv(resolve(queueDir, 'class-evidence-candidates.csv'), document.classEvidenceCandidates, [
    'sourceKind',
    'title',
    'sourcePageUrl',
    'primaryClassYearCandidates',
    'allClassYearCandidates',
    'imageCount',
    'attachedMediaCount',
    'youtubeVideoIds',
    'confidence',
  ]);
}

function writeCsv(path, rows, fields) {
  const lines = [
    fields.join(','),
    ...rows.map((row) => fields.map((field) => csvCell(Array.isArray(row[field]) ? row[field].join('|') : row[field] ?? '')).join(',')),
  ];
  writeFileSync(path, `${lines.join('\n')}\n`);
}

function pickClassCompatibleMatch(matches, record) {
  if (matches.length === 0) return null;
  const primaryYears = new Set(record.primaryClassYearCandidates ?? []);
  if (primaryYears.size > 0) {
    const classMatches = matches.filter((inductee) => primaryYears.has(inductee.classYear));
    if (classMatches.length === 1) return classMatches[0];
  }
  return null;
}

function preferredClassYear(record) {
  if (record.primaryClassYearCandidates?.length === 1) return record.primaryClassYearCandidates[0];
  if (record.classYearCandidates?.length === 1) return record.classYearCandidates[0];
  return null;
}

function unresolvedNotes(record) {
  const notes = ['No deterministic current-inductee match.'];
  if ((record.primaryClassYearCandidates ?? []).length === 0) notes.push('No title, slug, or tag class year.');
  if ((record.regionCandidates ?? []).length === 0) notes.push('No region category.');
  return notes;
}

function classifyImageRole(image, match, record) {
  const personTokens = nameKey(match.inducteeName).split(' ').filter((token) => token.length > 2);
  const haystack = nameKey([image.sourceUrl, image.altText, image.caption].filter(Boolean).join(' '));
  const tokenHits = personTokens.filter((token) => haystack.includes(token)).length;
  const area = (image.width ?? 0) * (image.height ?? 0);
  if (tokenHits >= Math.min(2, personTokens.length) && area >= 60000) {
    return { role: 'portrait-or-person-specific', confidence: 0.84, notes: ['Image source, alt text, or caption matches person name tokens.'] };
  }
  if (record.sourceKind === 'inductee-profile' && image.origin === 'inline-image' && image.order <= 1) {
    return { role: 'profile-inline-image', confidence: 0.72, notes: ['Early inline image on matched profile page.'] };
  }
  if (record.sourceKind === 'inductee-profile') {
    return { role: 'profile-gallery-image', confidence: 0.56, notes: ['Image appears on matched profile page.'] };
  }
  return { role: 'source-image', confidence: 0.36, notes: ['Image requires manual interpretation.'] };
}

function bestImageUrl(image) {
  const srcset = Array.isArray(image.srcset) ? image.srcset : [];
  const candidates = [srcset.find((src) => /-scaled\./.test(src)), ...srcset.slice().reverse(), image.src].filter(Boolean);
  return candidates.find(isImageAssetUrl) ?? '';
}

function isImageAssetUrl(value) {
  return /\.(?:jpg|jpeg|png|gif|webp)(?:\?|$)/i.test(value);
}

function resolveMentionedPerson(person) {
  return resolveNameCandidate(person.name, Number.parseInt(person.classYear, 10));
}

function resolveNameCandidate(value, classYear = null) {
  const exactMatches = inducteeIndexes.byNameKey.get(nameKey(value)) ?? [];
  const exactClassMatch = Number.isFinite(classYear) ? exactMatches.find((inductee) => inductee.classYear === classYear) : null;
  if (exactClassMatch) return exactClassMatch;
  if (exactMatches.length === 1) return exactMatches[0];
  for (const key of nameKeyVariants(value)) {
    const looseMatches = inducteeIndexes.byLooseNameKey.get(key) ?? [];
    const looseClassMatch = Number.isFinite(classYear) ? looseMatches.find((inductee) => inductee.classYear === classYear) : null;
    if (looseClassMatch) return looseClassMatch;
    if (looseMatches.length === 1) return looseMatches[0];
  }
  return null;
}

function inducteeHasYoutube(inducteeId, youtubeVideoId) {
  const inductee = inducteeIndexes.byId.get(inducteeId);
  return Boolean(inductee?.youtubeVideoIds?.includes(youtubeVideoId));
}

function isLikelyPlaceTag(value) {
  const normalized = nameKey(value);
  if (!normalized || /^\d{4}/.test(normalized)) return false;
  const nonPlaces = new Set(['event', 'architect', 'city council']);
  if (nonPlaces.has(normalized)) return false;
  return true;
}

function classifyStoryBlock(text) {
  if (/\b(born|raised|childhood|family|immigrated|came to|arrived)\b/i.test(text)) return 'early-life';
  if (/\b(school|college|university|degree|student|teacher|professor|education)\b/i.test(text)) return 'education';
  if (/\b(founded|career|served as|director|president|business|company|professional)\b/i.test(text)) return 'life-work';
  if (/\b(community|civic|volunteer|cultural|heritage|foundation|organization)\b/i.test(text)) return 'community-service';
  if (/\b(award|honor|recognized|legacy|achievement)\b/i.test(text)) return 'recognition';
  return 'biographical-context';
}

function excerpt(text, maxWords) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const clipped = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? `${clipped}...` : clipped;
}

function nameKeyVariants(value) {
  const base = nameKey(value);
  const strippedHonorific = nameKey(value.replace(/\b(?:dr|doctor|rev|reverend|fr|father|hon|honorable|judge|mayor|senator|bishop|ambassador|sister|councilman|councilwoman)\.?\s+/gi, ''));
  const strippedSuffix = strippedHonorific.replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
  const strippedMiddleInitials = strippedSuffix.replace(/\b([a-z])\b/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(new Set([base, strippedHonorific, strippedSuffix, strippedMiddleInitials].filter(Boolean)));
}

function nameKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bclass of\s+\d{4}\b/g, ' ')
    .replace(/\b20[1-2][0-9]\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function addToIndex(index, key, value) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

function groupBy(values, keyFn) {
  const groups = new Map();
  values.forEach((value) => {
    const key = keyFn(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  });
  return groups;
}

function pairKey(a, b, sourceId, type) {
  return [a, b].sort().join('|') + `:${sourceId}:${type}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
