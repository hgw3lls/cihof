import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generatedAtFor } from './stable-generated-at.js';
import { loadInductees } from './data-utils.js';

const manifestPath = resolve('data/media_manifest.json');
const reportPath = resolve('public/data/media-report.json');
const args = parseArgs(process.argv.slice(2));
const strict = Boolean(args.strict);
const strictProfile = strict ? args.profile || (args.wall ? 'wall' : 'full') : 'report';

if (strict && !['full', 'wall'].includes(strictProfile)) {
  console.error(`Unknown media strict profile "${strictProfile}". Use full or wall.`);
  process.exit(1);
}

const inductees = loadInductees({ includeMedia: false });
const manifest = loadManifest();
const report = validateMediaManifest(manifest, inductees, { strict, strictProfile });

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Media validation ${strict ? `(strict:${strictProfile})` : '(report)'}: ${report.totalInductees} inductees.`);
console.log(`Schema errors: ${report.validation.errors.length}`);
console.log(`Warnings: ${report.validation.warnings.length}`);
console.log(`Strict failures: ${report.strictFailures.length}`);
console.log(`Primary images wall-ready: ${report.summary.primaryImagesWallReady}/${report.totalInductees}`);
console.log(`Primary images kiosk-ready: ${report.summary.primaryImagesReady}/${report.totalInductees}`);
console.log(`Videos kiosk-ready: ${report.summary.videosReady}/${report.summary.videoItems}`);
console.log(`Audio kiosk-ready: ${report.summary.audioReady}/${report.summary.audioItems}`);
console.log(`Oral histories kiosk-ready: ${report.summary.oralHistoriesReady}/${report.summary.oralHistoryItems}`);
console.log(`Wrote ${reportPath}`);

if (report.validation.errors.length > 0 || report.strictFailures.length > 0) process.exitCode = 1;

function loadManifest() {
  if (!existsSync(manifestPath)) {
    return {
      schemaVersion: 0,
      source: {},
      reviewGuidance: {},
      assets: {},
      missingManifest: true,
    };
  }

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return {
      schemaVersion: 0,
      source: {},
      reviewGuidance: {},
      assets: {},
      parseError: error.message,
    };
  }
}

function validateMediaManifest(manifestData, expectedInductees, options) {
  const errors = [];
  const warnings = [];
  const strictFailures = [];
  const expectedIds = new Set(expectedInductees.map((item) => item.id));
  const assets = manifestData?.assets;

  if (manifestData.missingManifest) errors.push('Missing data/media_manifest.json. Run npm run media:manifest.');
  if (manifestData.parseError) errors.push(`Could not parse data/media_manifest.json: ${manifestData.parseError}`);
  if (typeof manifestData.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) errors.push('Media manifest must contain an assets object.');

  const records = assets && typeof assets === 'object' && !Array.isArray(assets) ? assets : {};
  const imageItems = [];
  const primaryImageItems = [];
  const videoItems = [];
  const audioItems = [];
  const oralHistoryItems = [];

  expectedInductees.forEach((inductee) => {
    const record = records[inductee.id];
    if (!record) {
      const message = `${inductee.id}: missing media manifest record.`;
      errors.push(message);
      return;
    }

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${inductee.id}: media record must be an object.`);
      return;
    }

    if (record.id && record.id !== inductee.id) errors.push(`${inductee.id}: media record id does not match object key.`);
    checkString(record, inductee.id, 'name', errors);
    checkStringArray(record, inductee.id, 'countryTags', errors);
    checkString(record, inductee.id, 'countryTagsSource', errors);
    checkString(record, inductee.id, 'countryTagsNote', errors);
    checkString(record, inductee.id, 'region', errors);
    checkNullableNumber(record, inductee.id, 'classYear', errors);
    checkString(record, inductee.id, 'approvalStatus', errors);
    checkString(record, inductee.id, 'reviewPriority', errors);
    checkStringArray(record, inductee.id, 'notes', errors);

    const images = record.images;
    if (!images || typeof images !== 'object' || Array.isArray(images)) {
      errors.push(`${inductee.id}: images must be an object.`);
    } else {
      if (!images.primary || typeof images.primary !== 'object' || Array.isArray(images.primary)) {
        errors.push(`${inductee.id}: images.primary must be an object.`);
      } else {
        validateImageAsset(images.primary, `${inductee.id}: images.primary`, errors, warnings);
        primaryImageItems.push({ id: inductee.id, asset: images.primary });
        imageItems.push({ id: inductee.id, asset: images.primary, primary: true });
      }

      if (!Array.isArray(images.gallery)) {
        errors.push(`${inductee.id}: images.gallery must be an array.`);
      } else {
        images.gallery.forEach((asset, index) => {
          validateImageAsset(asset, `${inductee.id}: images.gallery[${index}]`, errors, warnings);
          imageItems.push({ id: inductee.id, asset, primary: false });
        });
      }
    }

    if (!Array.isArray(record.videos)) {
      errors.push(`${inductee.id}: videos must be an array.`);
    } else {
      record.videos.forEach((asset, index) => {
        validateVideoAsset(asset, `${inductee.id}: videos[${index}]`, errors, warnings);
        videoItems.push({ id: inductee.id, asset });
      });
      if (inductee.hasVideo && record.videos.length === 0) warnings.push(`${inductee.id}: source data has video, but manifest has no video item.`);
    }

    if (record.audio !== undefined) {
      if (!Array.isArray(record.audio)) {
        errors.push(`${inductee.id}: audio must be an array when present.`);
      } else {
        record.audio.forEach((asset, index) => {
          validateAudioAsset(asset, `${inductee.id}: audio[${index}]`, errors, warnings);
          audioItems.push({ id: inductee.id, asset });
        });
      }
    }

    if (record.oralHistories !== undefined) {
      if (!Array.isArray(record.oralHistories)) {
        errors.push(`${inductee.id}: oralHistories must be an array when present.`);
      } else {
        record.oralHistories.forEach((asset, index) => {
          validateAudioAsset(asset, `${inductee.id}: oralHistories[${index}]`, errors, warnings);
          oralHistoryItems.push({ id: inductee.id, asset });
        });
      }
    }
  });

  Object.keys(records).forEach((id) => {
    if (!expectedIds.has(id)) warnings.push(`${id}: media manifest contains unknown inductee id.`);
  });

  if (options.strict) {
    if (options.strictProfile === 'wall') {
      primaryImageItems.forEach(({ id, asset }) => {
        if (!isWallReadyImage(asset)) strictFailures.push(`${id}: primary image is not wall-ready.`);
      });

      imageItems
        .filter((item) => !item.primary)
        .forEach(({ id, asset }) => {
          if (asset?.approvedForKiosk && !isKioskReadyImage(asset)) {
            strictFailures.push(`${id}: gallery image ${asset.sourceUrl || asset.filePath || 'unknown'} is marked kiosk-approved but is not kiosk-ready.`);
          }
        });

      videoItems.forEach(({ id, asset }) => {
        if (asset?.approvedForKiosk && !isKioskReadyVideo(asset)) {
          strictFailures.push(`${id}: video ${asset.youtubeVideoId || asset.sourceUrl || asset.filePath || 'unknown'} is marked kiosk-approved but is not kiosk-ready.`);
        }
      });

      audioItems.forEach(({ id, asset }) => {
        if (asset?.approvedForKiosk && !isKioskReadyAudio(asset)) {
          strictFailures.push(`${id}: audio ${asset.sourceUrl || asset.filePath || 'unknown'} is marked kiosk-approved but is not kiosk-ready.`);
        }
      });

      oralHistoryItems.forEach(({ id, asset }) => {
        if (asset?.approvedForKiosk && !isKioskReadyAudio(asset)) {
          strictFailures.push(`${id}: oral history ${asset.sourceUrl || asset.filePath || 'unknown'} is marked kiosk-approved but is not kiosk-ready.`);
        }
      });
    } else {
      primaryImageItems.forEach(({ id, asset }) => {
        if (!isKioskReadyImage(asset)) strictFailures.push(`${id}: primary image is not kiosk-ready.`);
      });

      imageItems
        .filter((item) => !item.primary)
        .forEach(({ id, asset }) => {
          if (!isKioskReadyImage(asset)) strictFailures.push(`${id}: gallery image ${asset.sourceUrl || asset.filePath || 'unknown'} is not kiosk-ready.`);
        });

      videoItems.forEach(({ id, asset }) => {
        if (!isKioskReadyVideo(asset)) strictFailures.push(`${id}: video ${asset.youtubeVideoId || asset.sourceUrl || asset.filePath || 'unknown'} is not kiosk-ready.`);
      });

      audioItems.forEach(({ id, asset }) => {
        if (!isKioskReadyAudio(asset)) strictFailures.push(`${id}: audio ${asset.sourceUrl || asset.filePath || 'unknown'} is not kiosk-ready.`);
      });

      oralHistoryItems.forEach(({ id, asset }) => {
        if (!isKioskReadyAudio(asset)) strictFailures.push(`${id}: oral history ${asset.sourceUrl || asset.filePath || 'unknown'} is not kiosk-ready.`);
      });
    }
  }

  return {
    generatedAt: generatedAtFor(reportPath),
    strict: options.strict,
    strictProfile: options.strictProfile,
    source: 'data/media_manifest.json',
    totalInductees: expectedInductees.length,
    validation: { errors, warnings },
    strictFailures,
    summary: {
      mediaRecords: Object.keys(records).length,
      primaryImages: primaryImageItems.length,
      primaryImagesWallReady: primaryImageItems.filter((item) => isWallReadyImage(item.asset)).length,
      primaryImagesReady: primaryImageItems.filter((item) => isKioskReadyImage(item.asset)).length,
      galleryImages: imageItems.filter((item) => !item.primary).length,
      galleryImagesReady: imageItems.filter((item) => !item.primary && isKioskReadyImage(item.asset)).length,
      videoItems: videoItems.length,
      videosReady: videoItems.filter((item) => isKioskReadyVideo(item.asset)).length,
      audioItems: audioItems.length,
      audioReady: audioItems.filter((item) => isKioskReadyAudio(item.asset)).length,
      oralHistoryItems: oralHistoryItems.length,
      oralHistoriesReady: oralHistoryItems.filter((item) => isKioskReadyAudio(item.asset)).length,
      missingPrimaryLocalFiles: primaryImageItems.filter((item) => !item.asset.filePath).map((item) => item.id),
      missingVideoLocalFiles: videoItems.filter((item) => !item.asset.filePath).map((item) => item.id),
      missingAudioLocalFiles: audioItems.filter((item) => !item.asset.filePath).map((item) => item.id),
      missingOralHistoryLocalFiles: oralHistoryItems.filter((item) => !item.asset.filePath).map((item) => item.id),
      missingVideoPosters: videoItems.filter((item) => !item.asset.posterFilePath).map((item) => item.id),
      missingCaptions: videoItems.filter((item) => !item.asset.captionFilePath).map((item) => item.id),
      missingTranscripts: videoItems.filter((item) => !item.asset.transcriptFilePath).map((item) => item.id),
      imageRightsNeedsReview: imageItems.filter((item) => item.asset.rightsStatus !== 'approved').map((item) => item.id),
      videoRightsNeedsReview: videoItems.filter((item) => item.asset.rightsStatus !== 'approved').map((item) => item.id),
      audioRightsNeedsReview: audioItems.filter((item) => item.asset.rightsStatus !== 'approved').map((item) => item.id),
      oralHistoryRightsNeedsReview: oralHistoryItems.filter((item) => item.asset.rightsStatus !== 'approved').map((item) => item.id),
    },
  };
}

function parseArgs(rawArgs) {
  return rawArgs.reduce((parsed, arg, index) => {
    if (arg === '--strict') return { ...parsed, strict: true };
    if (arg === '--wall') return { ...parsed, wall: true, profile: 'wall' };
    if (arg === '--full') return { ...parsed, profile: 'full' };
    if (arg === '--profile') return { ...parsed, profile: rawArgs[index + 1] ?? '' };
    if (arg.startsWith('--profile=')) return { ...parsed, profile: arg.slice('--profile='.length) };
    return parsed;
  }, {});
}

function validateImageAsset(asset, label, errors, warnings) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  checkString(asset, label, 'sourceUrl', errors);
  checkString(asset, label, 'filePath', errors);
  checkString(asset, label, 'runtimePath', errors);
  checkString(asset, label, 'checksumSha256', errors);
  checkNullableNumber(asset, label, 'width', errors);
  checkNullableNumber(asset, label, 'height', errors);
  checkString(asset, label, 'altText', errors);
  checkBoolean(asset, label, 'primary', errors);
  checkString(asset, label, 'rightsStatus', errors);
  checkBoolean(asset, label, 'approvedForKiosk', errors);
  validateAssetPaths(asset, label, ['filePath'], ['runtimePath'], errors, warnings);
}

function validateVideoAsset(asset, label, errors, warnings) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  checkString(asset, label, 'sourceUrl', errors);
  checkString(asset, label, 'youtubeVideoId', errors);
  checkString(asset, label, 'filePath', errors);
  checkString(asset, label, 'runtimePath', errors);
  checkString(asset, label, 'posterFilePath', errors);
  checkString(asset, label, 'posterRuntimePath', errors);
  checkString(asset, label, 'captionFilePath', errors);
  checkString(asset, label, 'captionRuntimePath', errors);
  checkString(asset, label, 'transcriptFilePath', errors);
  checkString(asset, label, 'transcriptRuntimePath', errors);
  checkString(asset, label, 'checksumSha256', errors);
  checkNullableNumber(asset, label, 'durationSeconds', errors);
  checkString(asset, label, 'codec', errors);
  checkString(asset, label, 'rightsStatus', errors);
  checkString(asset, label, 'captionStatus', errors);
  checkString(asset, label, 'transcriptStatus', errors);
  checkString(asset, label, 'audioDescriptionStatus', errors);
  checkBoolean(asset, label, 'approvedForKiosk', errors);
  validateAssetPaths(
    asset,
    label,
    ['filePath', 'posterFilePath', 'captionFilePath', 'transcriptFilePath'],
    ['runtimePath', 'posterRuntimePath', 'captionRuntimePath', 'transcriptRuntimePath'],
    errors,
    warnings,
  );
}

function validateAudioAsset(asset, label, errors, warnings) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  checkString(asset, label, 'sourceUrl', errors);
  checkString(asset, label, 'filePath', errors);
  checkString(asset, label, 'runtimePath', errors);
  checkString(asset, label, 'posterFilePath', errors);
  checkString(asset, label, 'posterRuntimePath', errors);
  checkString(asset, label, 'captionFilePath', errors);
  checkString(asset, label, 'captionRuntimePath', errors);
  checkString(asset, label, 'transcriptFilePath', errors);
  checkString(asset, label, 'transcriptRuntimePath', errors);
  checkString(asset, label, 'checksumSha256', errors);
  checkNullableNumber(asset, label, 'durationSeconds', errors);
  checkString(asset, label, 'codec', errors);
  checkString(asset, label, 'rightsStatus', errors);
  checkString(asset, label, 'captionStatus', errors);
  checkString(asset, label, 'transcriptStatus', errors);
  checkString(asset, label, 'audioDescriptionStatus', errors);
  checkBoolean(asset, label, 'approvedForKiosk', errors);
  validateInlineTranscript(asset.transcript, `${label}: transcript`, errors);
  validateAssetPaths(
    asset,
    label,
    ['filePath', 'posterFilePath', 'captionFilePath', 'transcriptFilePath'],
    ['runtimePath', 'posterRuntimePath', 'captionRuntimePath', 'transcriptRuntimePath'],
    errors,
    warnings,
  );
}

function validateInlineTranscript(transcript, label, errors) {
  if (transcript === undefined) return;
  if (!transcript || typeof transcript !== 'object' || Array.isArray(transcript)) {
    errors.push(`${label} must be an object when present.`);
    return;
  }

  checkString(transcript, label, 'label', errors);
  checkString(transcript, label, 'runtimePath', errors);
  checkString(transcript, label, 'text', errors);
  checkString(transcript, label, 'status', errors);
}

function validateAssetPaths(asset, label, fileKeys, runtimeKeys, errors, warnings) {
  fileKeys.forEach((key) => {
    const path = asset[key];
    if (!path) return;
    if (path.startsWith('/') || path.includes('..')) {
      errors.push(`${label}: ${key} must be a repo-relative path without traversal.`);
      return;
    }
    if (!path.startsWith('public/media/')) warnings.push(`${label}: ${key} should usually live under public/media/.`);
    if (!existsSync(resolve(path))) warnings.push(`${label}: ${key} does not exist yet: ${path}`);
  });

  runtimeKeys.forEach((key) => {
    const path = asset[key];
    if (!path) return;
    if (!path.startsWith('/')) errors.push(`${label}: ${key} must start with /.`);
    if (!path.startsWith('/media/')) warnings.push(`${label}: ${key} should usually start with /media/.`);
  });
}

function isKioskReadyImage(asset) {
  return Boolean(
    asset?.approvedForKiosk &&
      asset.rightsStatus === 'approved' &&
      asset.filePath &&
      asset.runtimePath &&
      existsSync(resolve(asset.filePath)),
  );
}

function isWallReadyImage(asset) {
  return Boolean(
    asset?.filePath &&
      asset.runtimePath &&
      asset.altText &&
      asset.runtimePath.startsWith('/media/') &&
      existsSync(resolve(asset.filePath)),
  );
}

function isKioskReadyVideo(asset) {
  return Boolean(
    asset?.approvedForKiosk &&
      asset.rightsStatus === 'approved' &&
      asset.captionStatus === 'approved' &&
      asset.transcriptStatus === 'approved' &&
      asset.filePath &&
      asset.runtimePath &&
      asset.posterFilePath &&
      asset.posterRuntimePath &&
      asset.captionFilePath &&
      asset.captionRuntimePath &&
      asset.transcriptFilePath &&
      asset.transcriptRuntimePath &&
      existsSync(resolve(asset.filePath)) &&
      existsSync(resolve(asset.posterFilePath)) &&
      existsSync(resolve(asset.captionFilePath)) &&
      existsSync(resolve(asset.transcriptFilePath)),
  );
}

function isKioskReadyAudio(asset) {
  return Boolean(
    asset?.approvedForKiosk &&
      asset.rightsStatus === 'approved' &&
      asset.transcriptStatus === 'approved' &&
      asset.filePath &&
      asset.runtimePath &&
      asset.transcriptFilePath &&
      asset.transcriptRuntimePath &&
      existsSync(resolve(asset.filePath)) &&
      existsSync(resolve(asset.transcriptFilePath)),
  );
}

function checkString(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && typeof value !== 'string') errors.push(`${label}: ${path} must be a string.`);
}

function checkStringArray(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
    errors.push(`${label}: ${path} must be an array of strings.`);
  }
}

function checkBoolean(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && typeof value !== 'boolean') errors.push(`${label}: ${path} must be a boolean.`);
}

function checkNullableNumber(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
    errors.push(`${label}: ${path} must be a finite number or null.`);
  }
}
