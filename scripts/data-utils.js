import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const sourcePath = resolve('data/cihof_kiosk_manifest.csv');
export const curatedMetadataPath = resolve('data/cihof_curated_metadata.json');
export const countryInferencePath = resolve('data/cihof_country_inferences.json');
export const mediaManifestPath = resolve('data/media_manifest.json');
export const physicalWallMetadataPath = resolve('data/physical_wall_positions.json');

export function loadInductees(options = {}) {
  const raw = readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(raw);
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());

  let records = rows.map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
    const name = record.name.trim();
    const classYear = Number.parseInt(record.class_year, 10);
    const region = normalizeRegion(record.region);
    const imageUrls = Array.from(new Set(splitList(record.image_urls).filter((url) => !isGenericImage(url))))
      .sort((a, b) => imageScore(b, name) - imageScore(a, name));
    const rawPrimary = record.primary_image_url.trim();
    const primaryImageUrl = rawPrimary && !isGenericImage(rawPrimary) ? rawPrimary : imageUrls[0] ?? '';
    const videoUrls = Array.from(new Set(splitList(record.video_urls).filter((url) => !url.includes('/results?'))));
    const youtubeVideoIds = Array.from(
      new Set([...splitList(record.youtube_video_ids), ...videoUrls.map(extractYoutubeId)].filter(Boolean)),
    );
    const localVideoPaths = splitList(record.local_video_paths);
    const localImagePaths = splitList(record.local_image_paths);
    const hasVideo = youtubeVideoIds.length > 0 || localVideoPaths.length > 0;
    const hasGallery = imageUrls.length > 1 || localImagePaths.length > 1;
    const bioText = record.bio_text.trim().replace(/\s+/g, ' ');
    const metadataText = [name, region, record.inducted_by, bioText].filter(Boolean).join(' ');
    const themeTags = extractThemeTags(metadataText);
    const countryTags = extractCountryTags(metadataText);
    const storySummary = summarizeText(bioText);
    const storyHighlights = extractHighlights(bioText);

    return {
      id: `${slugify(name)}-${Number.isFinite(classYear) ? classYear : 'unknown'}`,
      name,
      classYear: Number.isFinite(classYear) ? classYear : null,
      decade: getDecade(Number.isFinite(classYear) ? classYear : null),
      region,
      profileUrl: record.profile_url.trim(),
      inductedBy: record.inducted_by.trim(),
      primaryImageUrl,
      imageUrls,
      videoUrls,
      youtubeVideoIds,
      localVideoPaths,
      localImagePaths,
      hasVideo,
      hasGallery,
      bioText,
      storySummary,
      storySummarySource: 'generated',
      documentedContextLine: '',
      honoredForSummary: '',
      lifeWorkSummary: '',
      storyHighlights,
      themeTags,
      themeTagsSource: 'generated',
      countryTags,
      countryTagsSource: countryTags.length > 0 ? 'generated' : 'none',
      countryTagsNote: countryTags.length > 0 ? 'Detected from nationality or heritage phrases in the source profile text.' : '',
      communityTags: [],
      sortName: buildSortName(name),
      pronunciation: '',
      imageAltText: defaultImageAltText(name, Number.isFinite(classYear) ? classYear : null),
      approvalStatus: 'unreviewed',
      reviewPriority: 'standard',
      featured: false,
      featuredCandidate: false,
      attractPriority: 0,
      mediaReviewStatus: hasVideo ? 'unreviewed' : 'no-video-linked',
      imageRightsStatus: 'unreviewed',
      videoRightsStatus: hasVideo ? 'unreviewed' : 'not-applicable',
      relatedIds: [],
      physicalRow: null,
      physicalColumn: null,
      physicalPanel: '',
      wallLabel: '',
      wallCoordinates: null,
      physicalPortraitPresent: false,
      searchText: [name, classYear, region, record.inducted_by, bioText, storySummary, ...themeTags, ...countryTags].filter(Boolean).join(' ').toLowerCase(),
    };
  });

  if (options.includeCurated !== false) {
    const curatedMetadata = loadCuratedMetadata();
    const validation = validateCuratedMetadata(curatedMetadata, records.map((item) => item.id));
    if (validation.errors.length > 0) {
      throw new Error(`Curated metadata validation failed:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`);
    }
    records = records.map((inductee) => applyCuratedMetadata(inductee, curatedMetadata.inductees?.[inductee.id]));
  }

  if (options.includeCountryInferences !== false) {
    const countryInferences = loadCountryInferences();
    const validation = validateCountryInferences(countryInferences, records.map((item) => item.id));
    if (validation.errors.length > 0) {
      throw new Error(`Country inference validation failed:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`);
    }
    records = records.map((inductee) => applyCountryInference(inductee, countryInferences.records?.[inductee.id]));
  }

  if (options.includeMedia !== false) {
    const mediaManifest = loadMediaManifest();
    records = records.map((inductee) => applyMediaManifest(inductee, mediaManifest.assets?.[inductee.id]));
  }

  if (options.includePhysicalWall !== false) {
    const physicalWallMetadata = loadPhysicalWallMetadata();
    const validation = validatePhysicalWallMetadata(physicalWallMetadata, records.map((item) => item.id));
    if (validation.errors.length > 0) {
      throw new Error(`Physical wall metadata validation failed:\n${validation.errors.map((error) => `- ${error}`).join('\n')}`);
    }
    records = records.map((inductee) => applyPhysicalWallMetadata(inductee, physicalWallMetadata.positions?.[inductee.id]));
  }

  return addRelatedIds(records).sort((a, b) => {
    const yearA = a.classYear ?? 9999;
    const yearB = b.classYear ?? 9999;
    return yearA - yearB || a.name.localeCompare(b.name);
  });
}

export function loadCountryInferences(options = {}) {
  const optional = options.optional !== false;
  if (!existsSync(countryInferencePath)) {
    if (optional) return { schemaVersion: 1, source: {}, reviewGuidance: {}, records: {} };
    throw new Error(`Missing country inference file: ${countryInferencePath}`);
  }

  try {
    const metadata = JSON.parse(readFileSync(countryInferencePath, 'utf8'));
    return metadata && typeof metadata === 'object' ? metadata : { schemaVersion: 1, source: {}, reviewGuidance: {}, records: {} };
  } catch (error) {
    throw new Error(`Could not read country inferences: ${error.message}`);
  }
}

export function loadCuratedMetadata(options = {}) {
  const optional = options.optional !== false;
  if (!existsSync(curatedMetadataPath)) {
    if (optional) return { schemaVersion: 1, source: {}, reviewGuidance: {}, inductees: {} };
    throw new Error(`Missing curated metadata file: ${curatedMetadataPath}`);
  }

  try {
    const metadata = JSON.parse(readFileSync(curatedMetadataPath, 'utf8'));
    return metadata && typeof metadata === 'object' ? metadata : { schemaVersion: 1, source: {}, reviewGuidance: {}, inductees: {} };
  } catch (error) {
    throw new Error(`Could not read curated metadata: ${error.message}`);
  }
}

export function loadMediaManifest(options = {}) {
  const optional = options.optional !== false;
  if (!existsSync(mediaManifestPath)) {
    if (optional) return { schemaVersion: 1, source: {}, reviewGuidance: {}, assets: {} };
    throw new Error(`Missing media manifest file: ${mediaManifestPath}`);
  }

  try {
    const manifest = JSON.parse(readFileSync(mediaManifestPath, 'utf8'));
    return manifest && typeof manifest === 'object' ? manifest : { schemaVersion: 1, source: {}, reviewGuidance: {}, assets: {} };
  } catch (error) {
    throw new Error(`Could not read media manifest: ${error.message}`);
  }
}

export function loadPhysicalWallMetadata(options = {}) {
  const optional = options.optional !== false;
  if (!existsSync(physicalWallMetadataPath)) {
    if (optional) return emptyPhysicalWallMetadata();
    throw new Error(`Missing physical wall metadata file: ${physicalWallMetadataPath}`);
  }

  try {
    const metadata = JSON.parse(readFileSync(physicalWallMetadataPath, 'utf8'));
    return metadata && typeof metadata === 'object' ? normalizePhysicalWallMetadata(metadata) : emptyPhysicalWallMetadata();
  } catch (error) {
    throw new Error(`Could not read physical wall metadata: ${error.message}`);
  }
}

export function validateCuratedMetadata(metadata, expectedIds = []) {
  const errors = [];
  const warnings = [];
  const records = metadata?.inductees;
  const expectedIdSet = new Set(expectedIds);

  if (!metadata || typeof metadata !== 'object') {
    return { errors: ['Curated metadata must be a JSON object.'], warnings };
  }

  if (typeof metadata.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    errors.push('Curated metadata must contain an inductees object.');
    return { errors, warnings };
  }

  Object.entries(records).forEach(([id, record]) => {
    if (!expectedIdSet.has(id)) warnings.push(`Curated metadata contains unknown inductee id: ${id}`);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${id}: metadata record must be an object.`);
      return;
    }

    if (record.id && record.id !== id) errors.push(`${id}: record id does not match object key.`);
    checkString(record, id, 'approvalStatus', errors);
    checkString(record, id, 'reviewPriority', errors);
    checkString(record, id, 'displayName', errors);
    checkString(record, id, 'sortName', errors);
    checkString(record, id, 'summaryDraft', errors);
    checkString(record, id, 'approvedSummary', errors);
    checkString(record, id, 'documentedContextLine', errors);
    checkString(record, id, 'honoredForSummary', errors);
    checkString(record, id, 'lifeWorkSummary', errors);
    checkStringArray(record, id, 'themeTagCandidates', errors);
    checkStringArray(record, id, 'approvedThemeTags', errors);
    checkStringArray(record, id, 'countryTagCandidates', errors);
    checkStringArray(record, id, 'approvedCountryTags', errors);
    checkString(record, id, 'countryNotes', errors);
    checkStringArray(record, id, 'communityTagCandidates', errors);
    checkStringArray(record, id, 'approvedCommunityTags', errors);
    checkBoolean(record, id, 'featured', errors);
    checkBoolean(record, id, 'featuredCandidate', errors);
    checkNumber(record, id, 'attractPriority', errors);
    checkStringArray(record, id, 'journeySuggestions', errors);
    checkStringArray(record, id, 'curatorNotes', errors);

    if (record.image !== undefined) {
      if (!record.image || typeof record.image !== 'object' || Array.isArray(record.image)) errors.push(`${id}: image must be an object.`);
      else {
        checkString(record.image, id, 'primaryAltText', errors, 'image.primaryAltText');
        checkString(record.image, id, 'focalPoint', errors, 'image.focalPoint');
        checkString(record.image, id, 'rightsStatus', errors, 'image.rightsStatus');
        checkString(record.image, id, 'rightsNotes', errors, 'image.rightsNotes');
        checkString(record.image, id, 'sourceUrl', errors, 'image.sourceUrl');
      }
    }

    if (record.video !== undefined) {
      if (!record.video || typeof record.video !== 'object' || Array.isArray(record.video)) errors.push(`${id}: video must be an object.`);
      else {
        checkBoolean(record.video, id, 'hasVideo', errors, 'video.hasVideo');
        checkString(record.video, id, 'reviewStatus', errors, 'video.reviewStatus');
        checkString(record.video, id, 'captionStatus', errors, 'video.captionStatus');
        checkString(record.video, id, 'transcriptStatus', errors, 'video.transcriptStatus');
        checkString(record.video, id, 'audioDescriptionStatus', errors, 'video.audioDescriptionStatus');
        checkString(record.video, id, 'rightsStatus', errors, 'video.rightsStatus');
        checkStringArray(record.video, id, 'sourceUrls', errors, 'video.sourceUrls');
        checkStringArray(record.video, id, 'youtubeVideoIds', errors, 'video.youtubeVideoIds');
        checkStringArray(record.video, id, 'localVideoPaths', errors, 'video.localVideoPaths');
      }
    }

    if (record.accessibility !== undefined) {
      if (!record.accessibility || typeof record.accessibility !== 'object' || Array.isArray(record.accessibility)) errors.push(`${id}: accessibility must be an object.`);
      else {
        checkString(record.accessibility, id, 'plainLanguageReview', errors, 'accessibility.plainLanguageReview');
        checkString(record.accessibility, id, 'sensitiveContentReview', errors, 'accessibility.sensitiveContentReview');
        checkString(record.accessibility, id, 'imageDescriptionReview', errors, 'accessibility.imageDescriptionReview');
      }
    }
  });

  expectedIds.forEach((id) => {
    if (!records[id]) warnings.push(`No curated metadata record for inductee id: ${id}`);
  });

  return { errors, warnings };
}

export function validateCountryInferences(metadata, expectedIds = []) {
  const errors = [];
  const warnings = [];
  const records = metadata?.records;
  const expectedIdSet = new Set(expectedIds);

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { errors: ['Country inference metadata must be a JSON object.'], warnings };
  }

  if (typeof metadata.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    errors.push('Country inference metadata must contain a records object.');
    return { errors, warnings };
  }

  Object.entries(records).forEach(([id, record]) => {
    if (!expectedIdSet.has(id)) warnings.push(`Country inference metadata contains unknown inductee id: ${id}`);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${id}: country inference record must be an object.`);
      return;
    }

    if (record.id && record.id !== id) errors.push(`${id}: record id does not match object key.`);
    checkStringArray(record, id, 'inferredCountryTags', errors);
    checkString(record, id, 'confidence', errors);
    checkString(record, id, 'evidenceNote', errors);
    if (record.confidence !== undefined && record.confidence !== 'inferred') errors.push(`${id}: confidence must be "inferred".`);
    checkBoolean(record, id, 'overrideGeneratedCountryTags', errors);
  });

  expectedIds.forEach((id) => {
    if (!records[id]) warnings.push(`No inferred country completion record for inductee id: ${id}`);
  });

  return { errors, warnings };
}

export function validatePhysicalWallMetadata(metadata, expectedIds = []) {
  const errors = [];
  const warnings = [];
  const records = metadata?.positions;
  const expectedIdSet = new Set(expectedIds);
  const seenCells = new Map();

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { errors: ['Physical wall metadata must be a JSON object.'], warnings };
  }

  if (typeof metadata.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    errors.push('Physical wall metadata must contain a positions object.');
    return { errors, warnings };
  }

  Object.entries(records).forEach(([id, record]) => {
    if (!expectedIdSet.has(id)) warnings.push(`Physical wall metadata contains unknown inductee id: ${id}`);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${id}: physical wall record must be an object.`);
      return;
    }

    if (record.id && record.id !== id) errors.push(`${id}: record id does not match object key.`);
    checkPositiveInteger(record, id, 'physicalRow', errors);
    checkPositiveInteger(record, id, 'physicalColumn', errors);
    checkString(record, id, 'physicalPanel', errors);
    checkString(record, id, 'wallLabel', errors);
    checkBoolean(record, id, 'physicalPortraitPresent', errors);
    validateWallCoordinates(record.wallCoordinates, `${id}: wallCoordinates`, errors);

    if (record.physicalPortraitPresent && !record.physicalRow && !record.physicalColumn && !record.physicalPanel) {
      warnings.push(`${id}: physicalPortraitPresent is true but no row, column, or panel is set.`);
    }

    if (record.physicalRow && record.physicalColumn) {
      const cellKey = [record.physicalPanel || 'unpaneled', record.physicalRow, record.physicalColumn].join(':');
      const previousId = seenCells.get(cellKey);
      if (previousId) warnings.push(`${id}: shares physical wall cell ${cellKey} with ${previousId}.`);
      else seenCells.set(cellKey, id);
    }
  });

  return { errors, warnings };
}

export function buildCurationReport(inductees, curatedMetadata, validation) {
  const records = Object.values(curatedMetadata?.inductees ?? {});
  const recordById = curatedMetadata?.inductees ?? {};
  const byPriority = countBy(inductees.map((item) => item.reviewPriority || 'unreviewed'), 'priority');
  const byApproval = countBy(inductees.map((item) => item.approvalStatus || 'unreviewed'), 'status');

  return {
    source: 'data/cihof_curated_metadata.json',
    totalInductees: inductees.length,
    curatedRecords: records.length,
    validation,
    approvalStatus: byApproval,
    reviewPriority: byPriority,
    summaries: {
      approved: inductees.filter((item) => item.storySummarySource === 'curated').length,
      draftOnly: inductees.filter((item) => item.storySummarySource !== 'curated').map((item) => item.id),
      truncatedDrafts: records.filter((record) => String(record.summaryDraft ?? '').endsWith('...')).map((record) => record.id),
    },
    themes: {
      approved: inductees.filter((item) => item.themeTagsSource === 'curated').length,
      candidateOnly: inductees.filter((item) => item.themeTagsSource !== 'curated').map((item) => item.id),
    },
    countries: {
      detected: inductees.filter((item) => item.countryTags.length > 0).length,
      approved: inductees.filter((item) => item.countryTagsSource === 'curated').length,
      inferred: inductees.filter((item) => item.countryTagsSource === 'inferred').length,
      generatedOnly: inductees.filter((item) => item.countryTags.length > 0 && item.countryTagsSource !== 'curated').map((item) => item.id),
      missing: inductees.filter((item) => item.countryTags.length === 0).map((item) => item.id),
      sources: countBy(inductees.map((item) => item.countryTagsSource || 'none'), 'source'),
    },
    communities: {
      approved: inductees.filter((item) => item.communityTags.length > 0).length,
      candidateOnly: records.filter((record) => toStringArray(record.communityTagCandidates).length > 0 && toStringArray(record.approvedCommunityTags).length === 0).map((record) => record.id),
    },
    featured: {
      approved: inductees.filter((item) => item.featured).map((item) => item.id),
      candidates: inductees.filter((item) => item.featuredCandidate).map((item) => item.id),
      candidateNotFeatured: inductees.filter((item) => item.featuredCandidate && !item.featured).map((item) => item.id),
    },
    media: {
      videoRecords: inductees.filter((item) => item.hasVideo).length,
      captionTranscriptReviewNeeded: inductees
        .filter((item) => item.hasVideo)
        .filter((item) => {
          const record = recordById[item.id];
          const captionStatus = record?.video?.captionStatus ?? '';
          const transcriptStatus = record?.video?.transcriptStatus ?? '';
          return captionStatus !== 'approved' || transcriptStatus !== 'approved';
        })
        .map((item) => item.id),
      videoRightsReviewNeeded: inductees
        .filter((item) => item.hasVideo && item.videoRightsStatus !== 'approved' && item.videoRightsStatus !== 'not-applicable')
        .map((item) => item.id),
      imageRightsReviewNeeded: inductees
        .filter((item) => item.imageRightsStatus !== 'approved')
        .map((item) => item.id),
      noVideoLinked: inductees.filter((item) => !item.hasVideo).map((item) => item.id),
    },
    accessibility: {
      plainLanguageReviewNeeded: records.filter((record) => record.accessibility?.plainLanguageReview !== 'approved').map((record) => record.id),
      sensitiveContentReviewNeeded: records.filter((record) => record.accessibility?.sensitiveContentReview !== 'approved').map((record) => record.id),
      imageDescriptionReviewNeeded: records.filter((record) => record.accessibility?.imageDescriptionReview !== 'approved').map((record) => record.id),
    },
    priorities: {
      high: inductees.filter((item) => item.reviewPriority === 'high').map((item) => item.id),
      medium: inductees.filter((item) => item.reviewPriority === 'medium').map((item) => item.id),
      standard: inductees.filter((item) => item.reviewPriority === 'standard').map((item) => item.id),
    },
  };
}

export function buildReport(inductees) {
  const regions = Array.from(new Set(inductees.map((item) => item.region))).sort((a, b) => a.localeCompare(b));
  const years = inductees.map((item) => item.classYear).filter((year) => typeof year === 'number');
  const duplicateIds = Array.from(
    inductees.reduce((counts, item) => counts.set(item.id, (counts.get(item.id) ?? 0) + 1), new Map()),
  )
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  return {
    source: 'data/cihof_kiosk_manifest.csv',
    totalInductees: inductees.length,
    regions: regions.map((region) => ({
      region,
      count: inductees.filter((item) => item.region === region).length,
    })),
    decades: countBy(inductees.map((item) => item.decade).filter(Boolean), 'decade'),
    themes: countBy(inductees.flatMap((item) => item.themeTags), 'theme'),
    countries: countBy(inductees.flatMap((item) => item.countryTags), 'country'),
    communities: countBy(inductees.flatMap((item) => item.communityTags), 'community'),
    years: Array.from(new Set(years)).sort((a, b) => a - b).map((year) => ({
      year,
      count: inductees.filter((item) => item.classYear === year).length,
    })),
    yearRange: {
      min: Math.min(...years),
      max: Math.max(...years),
    },
    missing: {
      classYear: inductees.filter((item) => item.classYear === null).map((item) => item.id),
      primaryImage: inductees.filter((item) => !item.primaryImageUrl).map((item) => item.id),
      bioText: inductees.filter((item) => !item.bioText).map((item) => item.id),
      video: inductees.filter((item) => item.youtubeVideoIds.length === 0 && item.localVideoPaths.length === 0).map((item) => item.id),
    },
    media: {
      withPrimaryImage: inductees.filter((item) => item.primaryImageUrl).length,
      withGalleryImages: inductees.filter((item) => item.hasGallery).length,
      withVideo: inductees.filter((item) => item.hasVideo).length,
      withoutVideo: inductees.filter((item) => !item.hasVideo).length,
      completeness: countBy(inductees.map(mediaCompleteness), 'score'),
    },
    content: {
      shortBio: inductees.filter((item) => item.bioText.length < 320).map((item) => item.id),
      withoutThemeTags: inductees.filter((item) => item.themeTags.length === 0).map((item) => item.id),
      withoutCountryTags: inductees.filter((item) => item.countryTags.length === 0).map((item) => item.id),
    },
    curation: {
      approvalStatus: countBy(inductees.map((item) => item.approvalStatus), 'status'),
      reviewPriority: countBy(inductees.map((item) => item.reviewPriority), 'priority'),
      approvedSummaries: inductees.filter((item) => item.storySummarySource === 'curated').length,
      approvedThemeTags: inductees.filter((item) => item.themeTagsSource === 'curated').length,
      approvedCountryTags: inductees.filter((item) => item.countryTagsSource === 'curated').length,
      inferredCountryTags: inductees.filter((item) => item.countryTagsSource === 'inferred').length,
      approvedCommunityTags: inductees.filter((item) => item.communityTags.length > 0).length,
      featured: inductees.filter((item) => item.featured).map((item) => item.id),
      featuredCandidates: inductees.filter((item) => item.featuredCandidate).map((item) => item.id),
      mediaNeedsReview: inductees
        .filter((item) => item.mediaReviewStatus && !['approved', 'no-video-linked', 'not-applicable'].includes(item.mediaReviewStatus))
        .map((item) => item.id),
      imageRightsNeedsReview: inductees.filter((item) => item.imageRightsStatus !== 'approved').map((item) => item.id),
      videoRightsNeedsReview: inductees
        .filter((item) => item.videoRightsStatus !== 'approved' && item.videoRightsStatus !== 'not-applicable')
        .map((item) => item.id),
    },
    relationships: {
      averageRelatedCount: round(
        inductees.reduce((total, item) => total + item.relatedIds.length, 0) / Math.max(inductees.length, 1),
      ),
      withoutRelated: inductees.filter((item) => item.relatedIds.length === 0).map((item) => item.id),
    },
    physicalWall: {
      mapped: inductees.filter(hasPhysicalWallMetadata).length,
      physicalPortraitPresent: inductees.filter((item) => item.physicalPortraitPresent).length,
      panels: countBy(inductees.map((item) => item.physicalPanel).filter(Boolean), 'panel'),
      withoutPhysicalPortrait: inductees.filter((item) => hasPhysicalWallMetadata(item) && !item.physicalPortraitPresent).map((item) => item.id),
      presentWithoutGridPosition: inductees
        .filter((item) => item.physicalPortraitPresent && (!item.physicalRow || !item.physicalColumn))
        .map((item) => item.id),
      presentWithoutCoordinates: inductees.filter((item) => item.physicalPortraitPresent && !item.wallCoordinates).map((item) => item.id),
    },
    duplicateIds,
    suspicious: {
      genericImageCandidates: inductees.flatMap((item) => [item.primaryImageUrl, ...item.imageUrls].filter(isGenericImage).map((url) => ({ id: item.id, url }))),
      emptyProfileUrl: inductees.filter((item) => !item.profileUrl).map((item) => item.id),
      emptyUrlFields: inductees.filter((item) => [item.primaryImageUrl, item.profileUrl].some((url) => url.includes(' '))).map((item) => item.id),
    },
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

export function splitList(value) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyCuratedMetadata(inductee, curated) {
  if (!curated) return inductee;

  const name = cleanString(curated.displayName) || inductee.name;
  const sortName = cleanString(curated.sortName) || buildSortName(name);
  const pronunciation = cleanString(curated.pronunciation);
  const approvedSummary = cleanString(curated.approvedSummary);
  const documentedContextLine = cleanString(curated.documentedContextLine);
  const honoredForSummary = cleanString(curated.honoredForSummary);
  const lifeWorkSummary = cleanString(curated.lifeWorkSummary);
  const approvedThemeTags = toStringArray(curated.approvedThemeTags);
  const approvedCountryTags = toStringArray(curated.approvedCountryTags);
  const countryNotes = cleanString(curated.countryNotes);
  const approvedCommunityTags = toStringArray(curated.approvedCommunityTags);
  const storySummary = approvedSummary || inductee.storySummary;
  const themeTags = approvedThemeTags.length > 0 ? approvedThemeTags : inductee.themeTags;
  const countryTags = approvedCountryTags.length > 0 ? approvedCountryTags : inductee.countryTags;
  const communityTags = approvedCommunityTags;
  const imageAltText = cleanString(curated.image?.primaryAltText) || defaultImageAltText(name, inductee.classYear);
  const mediaReviewStatus = cleanString(curated.video?.reviewStatus) || inductee.mediaReviewStatus;
  const imageRightsStatus = cleanString(curated.image?.rightsStatus) || inductee.imageRightsStatus;
  const videoRightsStatus = cleanString(curated.video?.rightsStatus) || inductee.videoRightsStatus;

  return {
    ...inductee,
    name,
    sortName,
    pronunciation,
    storySummary,
    storySummarySource: approvedSummary ? 'curated' : 'generated',
    documentedContextLine,
    honoredForSummary,
    lifeWorkSummary,
    themeTags,
    themeTagsSource: approvedThemeTags.length > 0 ? 'curated' : 'generated',
    countryTags,
    countryTagsSource: approvedCountryTags.length > 0 ? 'curated' : inductee.countryTagsSource,
    countryTagsNote: approvedCountryTags.length > 0 ? countryNotes || 'Curator-approved nationality or heritage metadata.' : inductee.countryTagsNote,
    communityTags,
    imageAltText,
    approvalStatus: cleanString(curated.approvalStatus) || inductee.approvalStatus,
    reviewPriority: cleanString(curated.reviewPriority) || inductee.reviewPriority,
    featured: Boolean(curated.featured),
    featuredCandidate: Boolean(curated.featuredCandidate),
    attractPriority: typeof curated.attractPriority === 'number' && Number.isFinite(curated.attractPriority) ? curated.attractPriority : 0,
    mediaReviewStatus,
    imageRightsStatus,
    videoRightsStatus,
    searchText: [name, pronunciation, inductee.classYear, inductee.region, inductee.inductedBy, inductee.bioText, storySummary, documentedContextLine, honoredForSummary, lifeWorkSummary, ...themeTags, ...countryTags, ...communityTags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

function applyCountryInference(inductee, countryRecord) {
  const canOverrideGeneratedTags = countryRecord?.overrideGeneratedCountryTags === true && inductee.countryTagsSource !== 'curated';
  if (!countryRecord || (inductee.countryTags.length > 0 && !canOverrideGeneratedTags)) return inductee;

  const countryTags = toStringArray(countryRecord.inferredCountryTags);
  if (countryTags.length === 0 && !canOverrideGeneratedTags) return inductee;

  const countryTagsNote = cleanString(countryRecord.evidenceNote) || 'Inferred country completion from current profile data; needs curatorial review.';

  return {
    ...inductee,
    countryTags,
    countryTagsSource: countryTags.length > 0 ? 'inferred' : 'none',
    countryTagsNote,
    searchText: buildInducteeSearchText({ ...inductee, countryTags, countryTagsNote }),
  };
}

function buildInducteeSearchText(inductee) {
  return [
    inductee.name,
    inductee.pronunciation,
    inductee.classYear,
    inductee.region,
    inductee.inductedBy,
    inductee.bioText,
    inductee.storySummary,
    inductee.documentedContextLine,
    inductee.honoredForSummary,
    inductee.lifeWorkSummary,
    ...inductee.themeTags,
    ...inductee.countryTags,
    ...inductee.communityTags,
    inductee.countryTagsNote,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function applyMediaManifest(inductee, mediaRecord) {
  if (!mediaRecord) return inductee;

  const primaryImage = mediaRecord.images?.primary;
  const galleryImages = Array.isArray(mediaRecord.images?.gallery) ? mediaRecord.images.gallery : [];
  const localPrimary = usableRuntimeAsset(primaryImage);
  const localGallery = galleryImages.map(usableRuntimeAsset).filter(Boolean);
  const localVideos = Array.isArray(mediaRecord.videos) ? mediaRecord.videos.map(usableRuntimeAsset).filter(Boolean) : [];
  const imageUrls = localPrimary
    ? Array.from(new Set([localPrimary, ...localGallery]))
    : Array.from(new Set([...inductee.imageUrls]));
  const primaryImageUrl = localPrimary || inductee.primaryImageUrl;

  return {
    ...inductee,
    primaryImageUrl,
    imageUrls,
    localImagePaths: localPrimary ? [localPrimary, ...localGallery].map((path) => path.replace(/^\/+/, '')) : inductee.localImagePaths,
    localVideoPaths: localVideos.map((path) => path.replace(/^\/+/, '')),
    hasGallery: imageUrls.length > 1 || localGallery.length > 0 || inductee.localImagePaths.length > 1,
    hasVideo: inductee.hasVideo || localVideos.length > 0,
  };
}

function applyPhysicalWallMetadata(inductee, wallRecord) {
  if (!wallRecord) return inductee;

  const physicalPanel = cleanString(wallRecord.physicalPanel);
  const wallLabel = cleanString(wallRecord.wallLabel);
  const wallCoordinates = normalizeWallCoordinates(wallRecord.wallCoordinates);

  return {
    ...inductee,
    physicalRow: positiveIntegerOrNull(wallRecord.physicalRow),
    physicalColumn: positiveIntegerOrNull(wallRecord.physicalColumn),
    physicalPanel,
    wallLabel,
    wallCoordinates,
    physicalPortraitPresent: Boolean(wallRecord.physicalPortraitPresent),
    searchText: [inductee.searchText, physicalPanel, wallLabel].filter(Boolean).join(' ').toLowerCase(),
  };
}

function emptyPhysicalWallMetadata() {
  return {
    schemaVersion: 1,
    source: {},
    positions: {},
  };
}

function normalizePhysicalWallMetadata(metadata) {
  const positions = metadata.positions && typeof metadata.positions === 'object' && !Array.isArray(metadata.positions)
    ? metadata.positions
    : {};

  return {
    ...metadata,
    positions,
  };
}

function normalizeWallCoordinates(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.y !== 'number' || !Number.isFinite(value.y)) return null;

  return {
    x: value.x,
    y: value.y,
    ...(typeof value.width === 'number' && Number.isFinite(value.width) ? { width: value.width } : {}),
    ...(typeof value.height === 'number' && Number.isFinite(value.height) ? { height: value.height } : {}),
    ...(typeof value.unit === 'string' && value.unit.trim() ? { unit: value.unit.trim() } : {}),
  };
}

function positiveIntegerOrNull(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function usableRuntimeAsset(asset) {
  if (!asset?.filePath || !asset?.runtimePath) return '';
  if (!existsSync(resolve(asset.filePath))) return '';
  return cleanString(asset.runtimePath);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function defaultImageAltText(name, classYear) {
  return `Portrait or archival image of ${name}, ${classYear ? `Class of ${classYear}` : 'Cleveland International Hall of Fame inductee'}.`;
}

function buildSortName(name) {
  const cleaned = name
    .replace(/^(ambassador|bishop|dr\.?|father|former mayor|fr\.?|hon\.?|mayor|reverend|rev\.?|senator|sister)\s+/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return cleaned;
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'ph.d.', 'm.d.']);
  const withoutSuffix = suffixes.has(parts.at(-1)?.toLowerCase() ?? '') ? parts.slice(0, -1) : parts;
  if (withoutSuffix.length <= 1) return cleaned;
  return `${withoutSuffix.at(-1)}, ${withoutSuffix.slice(0, -1).join(' ')}`;
}

function checkString(record, id, path, errors, label = path) {
  const value = getPath(record, path);
  if (value !== undefined && typeof value !== 'string') errors.push(`${id}: ${label} must be a string.`);
}

function checkStringArray(record, id, path, errors, label = path) {
  const value = getPath(record, path);
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
    errors.push(`${id}: ${label} must be an array of strings.`);
  }
}

function checkBoolean(record, id, path, errors, label = path) {
  const value = getPath(record, path);
  if (value !== undefined && typeof value !== 'boolean') errors.push(`${id}: ${label} must be a boolean.`);
}

function checkNumber(record, id, path, errors, label = path) {
  const value = getPath(record, path);
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${id}: ${label} must be a finite number.`);
}

function checkPositiveInteger(record, id, path, errors, label = path) {
  const value = getPath(record, path);
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) errors.push(`${id}: ${label} must be a positive integer.`);
}

function validateWallCoordinates(value, label, errors) {
  if (value === undefined || value === null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object when present.`);
    return;
  }

  ['x', 'y'].forEach((field) => {
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) errors.push(`${label}.${field} must be a finite number.`);
  });
  ['width', 'height'].forEach((field) => {
    if (value[field] !== undefined && (typeof value[field] !== 'number' || !Number.isFinite(value[field]))) {
      errors.push(`${label}.${field} must be a finite number when present.`);
    }
  });
  if (value.unit !== undefined && !['grid', 'percent', 'pixels', 'inches'].includes(value.unit)) {
    errors.push(`${label}.unit must be one of grid, percent, pixels, inches.`);
  }
}

function getPath(record, path) {
  return path.split('.').reduce((current, part) => (current && typeof current === 'object' ? current[part] : undefined), record);
}

const themeRules = [
  {
    tag: 'Civic Leadership',
    keywords: [
      'mayor',
      'senator',
      'council',
      'public service',
      'public affairs',
      'government',
      'civic',
      'city of cleveland',
      'neighborhood',
      'policy',
      'legislative',
    ],
  },
  {
    tag: 'Arts and Culture',
    keywords: [
      'art',
      'artist',
      'arts',
      'music',
      'musician',
      'dance',
      'film',
      'festival',
      'cultural',
      'culture',
      'heritage',
      'museum',
      'theater',
      'performing',
    ],
  },
  {
    tag: 'Business and Entrepreneurship',
    keywords: [
      'business',
      'entrepreneur',
      'company',
      'corporation',
      'founder',
      'executive',
      'industry',
      'commerce',
      'bank',
      'real estate',
      'economic',
    ],
  },
  {
    tag: 'Education',
    keywords: ['education', 'educator', 'school', 'teacher', 'professor', 'university', 'college', 'student', 'academic', 'scholarship'],
  },
  {
    tag: 'Medicine and Health',
    keywords: ['medicine', 'medical', 'health', 'hospital', 'physician', 'nurse', 'healthcare', 'clinic', 'patient'],
  },
  {
    tag: 'Law and Justice',
    keywords: ['law', 'lawyer', 'attorney', 'judge', 'justice', 'legal', 'court', 'immigration law', 'rights'],
  },
  {
    tag: 'Faith and Service',
    keywords: ['faith', 'church', 'clergy', 'reverend', 'bishop', 'priest', 'sister', 'ministry', 'religious', 'parish'],
  },
  {
    tag: 'Immigrant Advocacy',
    keywords: ['immigrant', 'immigration', 'refugee', 'newcomer', 'diaspora', 'ethnic', 'nationality', 'naturalization'],
  },
  {
    tag: 'Diplomacy and Global Affairs',
    keywords: ['ambassador', 'diplomacy', 'diplomatic', 'international', 'global', 'consul', 'foreign', 'world affairs'],
  },
  {
    tag: 'Media and Storytelling',
    keywords: ['journalism', 'journalist', 'media', 'broadcast', 'radio', 'television', 'newspaper', 'publisher', 'writer', 'author'],
  },
  {
    tag: 'Science and Technology',
    keywords: ['science', 'scientist', 'engineering', 'engineer', 'technology', 'research', 'innovation', 'inventor', 'laboratory'],
  },
  {
    tag: 'Philanthropy',
    keywords: ['philanthropy', 'philanthropist', 'foundation', 'donor', 'charity', 'charitable', 'fundraising', 'endowment'],
  },
  {
    tag: 'Community Organizing',
    keywords: ['community', 'organizer', 'advocacy', 'volunteer', 'nonprofit', 'grassroots', 'service', 'social services'],
  },
  {
    tag: 'Public Safety and Military',
    keywords: ['police', 'firefighter', 'military', 'veteran', 'army', 'navy', 'air force', 'public safety'],
  },
];

const stopWords = new Set([
  'about',
  'after',
  'also',
  'among',
  'been',
  'being',
  'cleveland',
  'from',
  'have',
  'hall',
  'into',
  'more',
  'most',
  'than',
  'that',
  'their',
  'there',
  'this',
  'through',
  'with',
  'work',
  'years',
]);

const highValueThemeKeywords = new Set([
  'artist',
  'attorney',
  'bishop',
  'doctor',
  'educator',
  'engineer',
  'entrepreneur',
  'filmmaker',
  'founder',
  'judge',
  'lawyer',
  'mayor',
  'musician',
  'nurse',
  'philanthropist',
  'physician',
  'priest',
  'professor',
  'publisher',
  'refugee',
  'reverend',
  'scientist',
  'senator',
  'teacher',
  'veteran',
]);

function extractThemeTags(text) {
  const lower = text.toLowerCase();
  const tags = themeRules
    .map((rule) => ({ tag: rule.tag, score: themeScore(lower, rule.keywords) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .map((item) => item.tag);

  return tags.length > 0 ? tags.slice(0, 5) : ['Community Leadership'];
}

const countryRules = [
  { country: 'Albanian', keywords: ['albania', 'albanian'] },
  { country: 'Armenian', keywords: ['armenia', 'armenian'] },
  { country: 'Austrian', keywords: ['austria', 'austrian'] },
  { country: 'Belarusian', keywords: ['belarus', 'belarusian'] },
  { country: 'Bosnian', keywords: ['bosnia', 'bosnian', 'herzegovina'] },
  { country: 'Brazilian', keywords: ['brazil', 'brazilian'] },
  { country: 'Bulgarian', keywords: ['bulgaria', 'bulgarian'] },
  { country: 'Canadian', keywords: ['canada', 'canadian'] },
  { country: 'Chilean', keywords: ['chile', 'chilean'] },
  { country: 'Chinese', keywords: ['china', 'chinese'] },
  { country: 'Colombian', keywords: ['colombia', 'colombian'] },
  { country: 'Croatian', keywords: ['croatia', 'croatian'] },
  { country: 'Cuban', keywords: ['cuba', 'cuban'] },
  { country: 'Czech', keywords: ['czech republic', 'czechia', 'czech'] },
  { country: 'Dominican', keywords: ['dominican republic', 'dominican'] },
  { country: 'Egyptian', keywords: ['egypt', 'egyptian'] },
  { country: 'Salvadoran', keywords: ['el salvador', 'salvadoran'] },
  { country: 'Eritrean', keywords: ['eritrea', 'eritrean'] },
  { country: 'Estonian', keywords: ['estonia', 'estonian'] },
  { country: 'Ethiopian', keywords: ['ethiopia', 'ethiopian'] },
  { country: 'Finnish', keywords: ['finland', 'finnish'] },
  { country: 'French', keywords: ['france', 'french'] },
  { country: 'Georgian', keywords: ['republic of georgia', 'georgian republic'] },
  { country: 'German', keywords: ['germany', 'german'] },
  { country: 'Ghanaian', keywords: ['ghana', 'ghanaian'] },
  { country: 'Greek', keywords: ['greece', 'greek'] },
  { country: 'Guatemalan', keywords: ['guatemala', 'guatemalan'] },
  { country: 'Haitian', keywords: ['haiti', 'haitian'] },
  { country: 'Honduran', keywords: ['honduras', 'honduran'] },
  { country: 'Hungarian', keywords: ['hungary', 'hungarian'] },
  { country: 'Indian', keywords: ['india', 'asian indian', 'indian american'] },
  { country: 'Iranian', keywords: ['iran', 'iranian', 'persia', 'persian'] },
  { country: 'Iraqi', keywords: ['iraq', 'iraqi'] },
  { country: 'Irish', keywords: ['ireland', 'irish'] },
  { country: 'Israeli', keywords: ['israel', 'israeli'] },
  { country: 'Italian', keywords: ['italy', 'italian'] },
  { country: 'Japanese', keywords: ['japan', 'japanese'] },
  { country: 'Jordanian', keywords: ['jordan', 'jordanian'] },
  { country: 'Kenyan', keywords: ['kenya', 'kenyan'] },
  { country: 'Lebanese', keywords: ['lebanon', 'lebanese'] },
  { country: 'Lithuanian', keywords: ['lithuania', 'lithuanian'] },
  { country: 'Mexican', keywords: ['mexico', 'mexican'] },
  { country: 'Moroccan', keywords: ['morocco', 'moroccan'] },
  { country: 'Dutch', keywords: ['netherlands', 'dutch'] },
  { country: 'Nigerian', keywords: ['nigeria', 'nigerian'] },
  { country: 'Macedonian', keywords: ['north macedonia', 'macedonia', 'macedonian'] },
  { country: 'Norwegian', keywords: ['norway', 'norwegian'] },
  { country: 'Pakistani', keywords: ['pakistan', 'pakistani'] },
  { country: 'Palestinian', keywords: ['palestine', 'palestinian'] },
  { country: 'Peruvian', keywords: ['peru', 'peruvian'] },
  { country: 'Filipino', keywords: ['philippines', 'philippine', 'filipino', 'filipina'] },
  { country: 'Polish', keywords: ['poland', 'polish'] },
  { country: 'Portuguese', keywords: ['portugal', 'portuguese'] },
  { country: 'Puerto Rican', keywords: ['puerto rico', 'puerto rican'] },
  { country: 'Romanian', keywords: ['romania', 'romanian'] },
  { country: 'Russian', keywords: ['russia', 'russian'] },
  { country: 'Serbian', keywords: ['serbia', 'serbian'] },
  { country: 'Slovak', keywords: ['slovakia', 'slovak'] },
  { country: 'Slovenian', keywords: ['slovenia', 'slovenian'] },
  { country: 'South African', keywords: ['south africa', 'south african'] },
  { country: 'Korean', keywords: ['south korea', 'korea', 'korean'] },
  { country: 'Spanish', keywords: ['spain', 'spanish'] },
  { country: 'Sri Lankan', keywords: ['sri lanka', 'sri lankan'] },
  { country: 'Sudanese', keywords: ['sudan', 'sudanese'] },
  { country: 'Swedish', keywords: ['sweden', 'swedish'] },
  { country: 'Swiss', keywords: ['switzerland', 'swiss'] },
  { country: 'Syrian', keywords: ['syria', 'syrian'] },
  { country: 'Taiwanese', keywords: ['taiwan', 'taiwanese', 'taipei'] },
  { country: 'Thai', keywords: ['thailand', 'thai'] },
  { country: 'Turkish', keywords: ['turkey', 'turkish'] },
  { country: 'Ukrainian', keywords: ['ukraine', 'ukrainian'] },
  { country: 'British', keywords: ['united kingdom', 'british', 'england', 'scotland', 'scottish', 'wales', 'welsh'] },
  { country: 'Vietnamese', keywords: ['vietnam', 'vietnamese'] },
];

export function extractCountryTags(text) {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const countryTags = countryRules
    .map((rule) => ({
      country: rule.country,
      evidence: rule.keywords
        .map((keyword) => countryEvidence(lower, keyword))
        .sort((a, b) => b.score - a.score)[0] ?? { score: 0, direct: false },
    }))
    .filter((item) => item.evidence.score >= 4);

  const directCountryTags = countryTags.filter((item) => item.evidence.direct);
  const selectedCountryTags = directCountryTags.length > 0 ? directCountryTags : countryTags;

  return Array.from(
    new Set(
      selectedCountryTags
        .sort((a, b) => b.evidence.score - a.evidence.score || a.country.localeCompare(b.country))
        .map((item) => item.country),
    ),
  ).slice(0, 3);
}

function countryEvidence(text, keyword) {
  if (!containsKeyword(text, keyword)) return { score: 0, direct: false };

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const country = `(?:${escaped})`;
  const strongOriginBefore = new RegExp(
    `\\b(born|native|immigrated|emigrated|migrated|came|arrived|fled|escaped|resettled|deported)\\b[^.]{0,90}\\b${country}\\b`,
    'i',
  );
  const strongOriginAfter = new RegExp(
    `\\b${country}\\b[^.]{0,90}\\b(born|native|immigrant|emigrant|descent|nationality)\\b`,
    'i',
  );
  const familyOrigin = new RegExp(
    `\\b(parents|father|mother|family|families|grandparents|ancestors)\\b[^.]{0,120}\\bfrom\\b\\s+(?:(?:the|a|an)\\s+)?(?:(?:village|city|town|region|province|country)\\s+of\\s+)?(?:[^.]{0,35}\\bin\\s+)?\\b${country}\\b`,
    'i',
  );
  const communityEvidence = new RegExp(
    `\\b${country}\\b[^.]{0,70}\\b(american|association|community|communities|culture|cultural|descent|diaspora|heritage|immigrant|immigrants|nationality|society|tradition|traditions)\\b`,
    'i',
  );
  const communityMatch = text.match(communityEvidence);
  const communitySnippet = communityMatch?.index === undefined ? '' : text.slice(communityMatch.index, communityMatch.index + 120);
  const keywordIndex = text.search(new RegExp(`\\b${country}\\b`, 'i'));

  let score = 1;
  let direct = false;
  if (strongOriginBefore.test(text)) score = Math.max(score, 8);
  if (familyOrigin.test(text)) score = Math.max(score, 8);
  if (strongOriginBefore.test(text) || familyOrigin.test(text)) direct = true;
  if (strongOriginAfter.test(text)) {
    score = Math.max(score, 6);
    direct = true;
  }
  if (keywordIndex >= 0 && keywordIndex <= 1200 && communityMatch && !isEventOrProgramContext(communitySnippet)) {
    score = Math.max(score, 5);
  }
  return { score, direct };
}

function isEventOrProgramContext(snippet) {
  return /\b(award|awards|church|churches|day|days|event|events|exhibition|fellowship|garden|gardens|month|program|programs|tour|trade|trip)\b/i.test(snippet);
}

function themeScore(text, keywords) {
  return keywords.reduce((score, keyword) => {
    if (!containsKeyword(text, keyword)) return score;
    return score + keywordWeight(keyword);
  }, 0);
}

function keywordWeight(keyword) {
  if (keyword.includes(' ')) return 2;
  if (highValueThemeKeywords.has(keyword)) return 2;
  return 1;
}

function containsKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function summarizeText(text, limit = 245) {
  if (!text || text.length <= limit) return text;
  const slice = text.slice(0, limit + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (sentenceEnd >= 120) return `${slice.slice(0, sentenceEnd + 1).trim()}`;

  const wordEnd = slice.lastIndexOf(' ');
  return `${slice.slice(0, wordEnd > 120 ? wordEnd : limit).trim()}...`;
}

function extractHighlights(text) {
  return splitSentences(text)
    .filter((sentence) => sentence.length >= 45)
    .slice(0, 4)
    .map((sentence) => summarizeText(sentence, 150));
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getDecade(year) {
  if (typeof year !== 'number') return '';
  return `${Math.floor(year / 10) * 10}s`;
}

function addRelatedIds(inductees) {
  const tokenSets = new Map(inductees.map((item) => [item.id, tokenize(item.searchText)]));

  return inductees.map((item) => {
    const relatedIds = inductees
      .filter((candidate) => candidate.id !== item.id)
      .map((candidate) => ({
        candidate,
        score: relationshipScore(item, candidate, tokenSets.get(item.id) ?? new Set(), tokenSets.get(candidate.id) ?? new Set()),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        const yearDistanceA = yearDistance(item, a.candidate);
        const yearDistanceB = yearDistance(item, b.candidate);
        return b.score - a.score || yearDistanceA - yearDistanceB || a.candidate.name.localeCompare(b.candidate.name);
      })
      .slice(0, 8)
      .map((entry) => entry.candidate.id);

    return { ...item, relatedIds };
  });
}

function relationshipScore(a, b, aTokens, bTokens) {
  let score = 0;
  if (a.classYear !== null && a.classYear === b.classYear) score += 8;
  if (a.region === b.region) score += 5;
  if (a.decade && a.decade === b.decade) score += 2;

  const sharedThemes = a.themeTags.filter((tag) => b.themeTags.includes(tag));
  score += sharedThemes.length * 7;

  const sharedTerms = countSharedTerms(aTokens, bTokens);
  score += Math.min(sharedTerms, 8);

  if (a.hasVideo && b.hasVideo) score += 1;
  return score;
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 4 && !stopWords.has(token)),
  );
}

function countSharedTerms(aTokens, bTokens) {
  let count = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) count += 1;
  });
  return count;
}

function yearDistance(a, b) {
  if (a.classYear === null || b.classYear === null) return 9999;
  return Math.abs(a.classYear - b.classYear);
}

function countBy(values, keyName) {
  const counts = values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
  return Array.from(counts.entries())
    .map(([value, count]) => ({ [keyName]: value, count }))
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function hasPhysicalWallMetadata(inductee) {
  return Boolean(
    inductee.physicalPortraitPresent ||
      inductee.physicalRow ||
      inductee.physicalColumn ||
      inductee.physicalPanel ||
      inductee.wallLabel ||
      inductee.wallCoordinates,
  );
}

function mediaCompleteness(inductee) {
  let score = 0;
  if (inductee.primaryImageUrl) score += 1;
  if (inductee.hasGallery) score += 1;
  if (inductee.hasVideo) score += 1;
  return String(score);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

export function isGenericImage(url) {
  const lower = url.toLowerCase();
  const file = lower.split('/').pop() ?? lower;
  return [
    'facebook',
    'twitter',
    'youtube-fix',
    'youtube.png',
    'cle_int_hof-lo',
    'cle-int-hof',
    'logo',
    'icon',
    'button',
    'share',
    'rss',
    'linkedin',
    'instagram',
  ].some((token) => lower.includes(token)) || /^\d+x\d+\./.test(file);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeRegion(value) {
  const region = value.trim().replace(/\s+/g, ' ');
  if (!region) return 'Unknown Region';
  if (region.toLowerCase() === 'n america') return 'North America';
  return region;
}

function imageScore(url, name) {
  const lower = url.toLowerCase();
  const nameTokens = slugify(name).split('-').filter((token) => token.length > 2);
  let score = 0;

  if (lower.includes('wp-content/uploads')) score += 5;
  if (lower.includes('clevelandpeople.com/images/hof')) score += 4;
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) score += 3;
  if (lower.endsWith('.png')) score += 1;
  if (lower.includes('-500') || lower.includes('/s-') || lower.includes('/p-')) score += 2;
  if (nameTokens.some((token) => lower.includes(token))) score += 6;
  if (lower.includes('ambassador') || lower.includes('award') || lower.includes('table')) score -= 1;

  return score;
}

function extractYoutubeId(url) {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('/results?')) return '';

  const patterns = [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return '';
}
