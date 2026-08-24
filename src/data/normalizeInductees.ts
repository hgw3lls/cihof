import { runtimeLogger } from '../app/runtimeLogger';
import type { Inductee, PhysicalWallCoordinates } from './types';

export function normalizeInducteePayload(payload: unknown) {
  if (!Array.isArray(payload)) {
    runtimeLogger.warn('Inductee data payload was not an array.');
    return [];
  }

  const seenIds = new Set<string>();
  const normalized: Inductee[] = [];

  payload.forEach((item, index) => {
    const inductee = normalizeInductee(item, index);
    if (!inductee) return;
    if (seenIds.has(inductee.id)) {
      runtimeLogger.warn('Duplicate inductee id skipped.', { id: inductee.id });
      return;
    }
    seenIds.add(inductee.id);
    normalized.push(inductee);
  });

  return normalized;
}

function normalizeInductee(value: unknown, index: number): Inductee | null {
  if (!isRecord(value)) {
    runtimeLogger.warn('Malformed inductee record skipped.', { index });
    return null;
  }

  const name = readString(value.name, '').trim();
  const id = readString(value.id, '').trim();
  if (!id || !name) {
    runtimeLogger.warn('Inductee record missing required id or name.', { index, id, name });
    return null;
  }

  const classYear = readNullableNumber(value.classYear);
  const primaryImageUrl = readString(value.primaryImageUrl, '');

  return {
    id,
    name,
    classYear,
    decade: readString(value.decade, classYear ? `${Math.floor(classYear / 10) * 10}s` : ''),
    region: readString(value.region, 'Unspecified'),
    profileUrl: readString(value.profileUrl, ''),
    inductedBy: readString(value.inductedBy, ''),
    primaryImageUrl,
    imageUrls: readStringArray(value.imageUrls),
    videoUrls: readStringArray(value.videoUrls),
    youtubeVideoIds: readStringArray(value.youtubeVideoIds),
    localVideoPaths: readStringArray(value.localVideoPaths),
    localImagePaths: readStringArray(value.localImagePaths),
    hasVideo: readBoolean(value.hasVideo, false),
    hasGallery: readBoolean(value.hasGallery, false),
    bioText: readString(value.bioText, ''),
    storySummary: readString(value.storySummary, ''),
    storySummarySource: readString(value.storySummarySource, ''),
    storyHighlights: readStringArray(value.storyHighlights),
    themeTags: readStringArray(value.themeTags),
    themeTagsSource: readString(value.themeTagsSource, ''),
    countryTags: readStringArray(value.countryTags),
    countryTagsSource: readString(value.countryTagsSource, ''),
    countryTagsNote: readString(value.countryTagsNote, ''),
    communityTags: readStringArray(value.communityTags),
    sortName: readString(value.sortName, name),
    imageAltText: readString(value.imageAltText, name),
    approvalStatus: readString(value.approvalStatus, ''),
    reviewPriority: readString(value.reviewPriority, ''),
    featured: readBoolean(value.featured, false),
    featuredCandidate: readBoolean(value.featuredCandidate, false),
    attractPriority: readNumber(value.attractPriority, 0),
    mediaReviewStatus: readString(value.mediaReviewStatus, ''),
    imageRightsStatus: readString(value.imageRightsStatus, ''),
    videoRightsStatus: readString(value.videoRightsStatus, ''),
    relatedIds: readStringArray(value.relatedIds),
    physicalRow: readNullableNumber(value.physicalRow),
    physicalColumn: readNullableNumber(value.physicalColumn),
    physicalPanel: readString(value.physicalPanel, ''),
    wallLabel: readString(value.wallLabel, ''),
    wallCoordinates: readWallCoordinates(value.wallCoordinates),
    physicalPortraitPresent: readBoolean(value.physicalPortraitPresent, false),
    searchText: readString(value.searchText, [name, readString(value.bioText, ''), readString(value.storySummary, '')].join(' ')),
  };
}

function readWallCoordinates(value: unknown): PhysicalWallCoordinates | null {
  if (!isRecord(value)) return null;
  const x = readNumber(value.x, Number.NaN);
  const y = readNumber(value.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const unit = value.unit === 'grid' || value.unit === 'percent' || value.unit === 'pixels' || value.unit === 'inches'
    ? value.unit
    : undefined;

  return {
    x,
    y,
    width: readOptionalNumber(value.width),
    height: readOptionalNumber(value.height),
    unit,
  };
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
